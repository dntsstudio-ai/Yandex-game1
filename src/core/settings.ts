/**
 * Пользовательские настройки: музыка, звуки, громкость, режим игры.
 * Хранятся в localStorage, чтобы выбор игрока сохранялся между партиями.
 */

/**
 * Режим проверки.
 *
 * `young` — решение принимается сразу по нажатию кнопки.
 * `mature` — ответы сначала выбираются, затем подтверждаются: между
 * выбором и зачётом даётся время передумать.
 */
export type GameMode = 'young' | 'mature';

export const GAME_MODES: readonly GameMode[] = ['young', 'mature'];

export interface Settings {
  music: boolean;
  sound: boolean;
  /** Озвучка реплик инспектора: слушать или читать молча. */
  voice: boolean;
  /** Общая громкость, 0…1. */
  volume: number;
  /** Режим проверки. */
  mode: GameMode;
}

const STORAGE_KEY = 'red-flag:settings';

const DEFAULTS: Settings = {
  music: true,
  sound: true,
  voice: true,
  volume: 0.7,
  mode: 'young',
};

type Listener = (settings: Settings) => void;

class SettingsStore {
  private current: Settings = { ...DEFAULTS, ...read() };
  private listeners = new Set<Listener>();

  get(): Readonly<Settings> {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  update(patch: Partial<Settings>): Settings {
    this.current = { ...this.current, ...patch };
    write(this.current);
    for (const listener of this.listeners) listener(this.current);
    return this.current;
  }

  toggle(key: 'music' | 'sound'): boolean {
    const next = !this.current[key];
    this.update({ [key]: next } as Partial<Settings>);
    return next;
  }
}

/**
 * Разбор сохранённых настроек.
 *
 * Каждое поле проверяется отдельно: в хранилище может лежать запись
 * от старой версии игры, где половины полей ещё не было.
 */
export function parseSettings(raw: unknown): Partial<Settings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const data = raw as Partial<Settings>;
  const result: Partial<Settings> = {};

  // Ключи с значением undefined тоже перекрывают значения по умолчанию
  // при слиянии объектов, поэтому непрошедшие проверку поля не пишутся вовсе.
  if (typeof data.music === 'boolean') result.music = data.music;
  if (typeof data.sound === 'boolean') result.sound = data.sound;
  if (typeof data.voice === 'boolean') result.voice = data.voice;
  if (typeof data.volume === 'number' && Number.isFinite(data.volume)) {
    result.volume = Math.min(1, Math.max(0, data.volume));
  }
  if (data.mode === 'young' || data.mode === 'mature') result.mode = data.mode;

  return result;
}

function read(): Partial<Settings> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return parseSettings(JSON.parse(raw));
  } catch {
    return {};
  }
}

function write(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // приватный режим браузера — просто играем без сохранения
  }
}

export const settings = new SettingsStore();
