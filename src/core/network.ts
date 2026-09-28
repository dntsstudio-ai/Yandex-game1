/**
 * Наблюдение за связью.
 *
 * Игра целиком живёт в браузере, но её материалы — музыка, озвучка,
 * текстуры, шрифты — подгружаются по сети. Если связь пропала или стала
 * слишком медленной, продолжать проверку нечестно: таймер идёт, а звук
 * и картинки до игрока не доезжают. Поэтому партия встаёт на паузу,
 * пока соединение не вернётся.
 *
 * `navigator.onLine` сам по себе не показатель: он говорит лишь о том,
 * что сетевой интерфейс поднят, и остаётся true за неработающим Wi-Fi.
 * Поэтому связь ещё и проверяется запросом небольшого файла.
 */
import { assetUrl } from './assets';

export type NetworkState = 'online' | 'weak' | 'offline';

/** Через сколько медленный ответ считается плохой связью. */
const SLOW_MS = 2500;
/** Через сколько запрос считается неотвеченным. */
const TIMEOUT_MS = 6000;
/** Пауза между проверками при нормальной связи. */
const IDLE_PROBE_MS = 20_000;
/** Пауза между проверками, пока связь не восстановилась. */
const RETRY_PROBE_MS = 3000;
/**
 * Сколько подряд неудачных проверок нужно, чтобы остановить игру.
 * Одна осечка бывает и на здоровой сети — прерывать из-за неё партию
 * хуже, чем подождать лишние три секунды.
 */
const FAILURES_TO_STOP = 2;

type Listener = (state: NetworkState) => void;

export interface NetworkMonitor {
  getState: () => NetworkState;
  subscribe: (listener: Listener) => () => void;
  /** Внеплановая проверка — например, по кнопке «Проверить снова». */
  check: () => void;
  /** Сообщить о сбое загрузки: повод проверить связь немедленно. */
  reportFailure: () => void;
  stop: () => void;
}

export interface MonitorOptions {
  /** Запрос-проба; подменяется в тестах. */
  probe?: () => Promise<number>;
  /** Файл, которым проверяется связь. */
  url?: string;
}

/**
 * Решение о состоянии связи по результату проверки.
 * Вынесено отдельно от таймеров и сети, чтобы поведение можно было
 * проверить тестом.
 */
export function decideState(params: {
  /** Время ответа, мс; null — ответа не было. */
  latency: number | null;
  /** Сколько неудач подряд уже накопилось, включая текущую. */
  failures: number;
}): NetworkState {
  const { latency, failures } = params;
  if (latency === null) return failures >= FAILURES_TO_STOP ? 'offline' : 'weak';
  if (latency >= SLOW_MS) return failures >= FAILURES_TO_STOP ? 'weak' : 'online';
  return 'online';
}

export function createNetworkMonitor(options: MonitorOptions = {}): NetworkMonitor {
  const listeners = new Set<Listener>();
  let state: NetworkState = 'online';
  let failures = 0;
  let timer = 0;
  let running = true;
  let inFlight = false;

  const url = options.url ?? assetUrl('favicon.svg');
  const probe = options.probe ?? (() => defaultProbe(url));

  const setState = (next: NetworkState) => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener(state);
  };

  const schedule = (delay: number) => {
    if (!running || typeof window === 'undefined') return;
    window.clearTimeout(timer);
    timer = window.setTimeout(run, delay);
  };

  const run = async () => {
    if (!running || inFlight) return;

    // Браузер прямо говорит, что сети нет, — проверять нечего.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      failures = FAILURES_TO_STOP;
      setState('offline');
      schedule(RETRY_PROBE_MS);
      return;
    }

    inFlight = true;
    let latency: number | null = null;
    try {
      latency = await probe();
    } catch {
      latency = null;
    } finally {
      inFlight = false;
    }

    if (!running) return;

    const bad = latency === null || latency >= SLOW_MS;
    failures = bad ? failures + 1 : 0;
    setState(decideState({ latency, failures }));
    schedule(state === 'online' ? IDLE_PROBE_MS : RETRY_PROBE_MS);
  };

  const onOffline = () => {
    failures = FAILURES_TO_STOP;
    setState('offline');
    schedule(RETRY_PROBE_MS);
  };

  const onOnline = () => {
    failures = 0;
    schedule(0);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    schedule(IDLE_PROBE_MS);
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    check() {
      failures = 0;
      schedule(0);
    },
    reportFailure() {
      failures += 1;
      if (failures >= FAILURES_TO_STOP) setState('offline');
      schedule(0);
    },
    stop() {
      running = false;
      if (typeof window !== 'undefined') {
        window.clearTimeout(timer);
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('online', onOnline);
      }
      listeners.clear();
    },
  };
}

/** Проба: маленький файл со сбитым кэшем. Возвращает время ответа в мс. */
async function defaultProbe(url: string): Promise<number> {
  const controller = new AbortController();
  const cutoff = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const response = await fetch(`${url}?ping=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Тело нужно дочитать: иначе замеряется только время заголовков.
    await response.arrayBuffer();
    return performance.now() - startedAt;
  } finally {
    clearTimeout(cutoff);
  }
}
