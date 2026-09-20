/**
 * Озвучка реплик.
 *
 * Играет через <audio> + Web Audio: элемент даёт честную паузу и
 * продолжение с того же места, а усилитель поднимает уровень — запись
 * сведена тихо (пик около 0,2 против 0,9 у эффектов).
 *
 * Реплика может быть отдельным файлом или отрезком длинного файла:
 * в озвучке обучения все фразы записаны подряд, и резать их на десяток
 * маленьких mp3 без перекодирования нельзя — вместо этого запоминаются
 * границы.
 */
import { assetUrl, findAsset } from '../assets';
import { settings } from '../settings';
import { audioContext, masterBus } from './context';

/** Отрезок озвучки. */
export interface VoiceClip {
  /** Путь внутри media, без расширения не обойтись: `voice/intro-1.mp3`. */
  src: string;
  /** Начало отрезка в секундах; 0 — с начала файла. */
  start?: number;
  /** Конец отрезка; не задан — до конца файла. */
  end?: number;
}

export type VoiceState = 'idle' | 'playing' | 'paused';

type Listener = (state: VoiceState) => void;

/** Уровень озвучки: запись тихая, поэтому поднимаем. */
const VOICE_GAIN = 3.2;

/** Как часто сверяемся с границей отрезка. */
const WATCH_MS = 40;

class VoiceEngine {
  private element: HTMLAudioElement | null = null;
  private watch = 0;
  private current: VoiceClip | null = null;
  private state: VoiceState = 'idle';
  private listeners = new Set<Listener>();
  private known = new Map<string, string | null>();

  /** Подписка на состояние: кнопка повтора включается и гаснет по нему. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): VoiceState {
    return this.state;
  }

  /** Есть ли что повторить. */
  hasClip(): boolean {
    return this.current !== null;
  }

  /**
   * Начать реплику с начала. Если та же реплика уже звучит, ничего не
   * происходит: перезапускать её нельзя, можно только поставить паузу.
   */
  async play(clip: VoiceClip): Promise<void> {
    if (!settings.get().voice) {
      this.current = clip;
      return;
    }
    if (this.state === 'playing' && this.current?.src === clip.src && this.current?.start === clip.start) {
      return;
    }

    this.stop();
    this.current = clip;

    const found = await this.resolve(clip.src);
    if (!found) return;
    // пока файл искался, реплику могли сменить
    if (this.current !== clip) return;

    const element = this.ensureElement();
    if (element.src !== found) element.src = found;

    const start = clip.start ?? 0;
    try {
      if (Number.isFinite(element.duration) || element.readyState >= 1) {
        element.currentTime = start;
      } else {
        await new Promise<void>((resolve) => {
          element.addEventListener('loadedmetadata', () => resolve(), { once: true });
          window.setTimeout(resolve, 2500);
        });
        element.currentTime = start;
      }
      await element.play();
      this.setState('playing');
      this.startWatch();
    } catch {
      // автозапуск ещё не разрешён — реплика просто не прозвучит
      this.setState('idle');
    }
  }

  /** Повторить текущую реплику с начала. */
  replay(): void {
    const clip = this.current;
    if (!clip) return;
    this.stop();
    void this.play(clip);
  }

  /** Пауза и продолжение с того же места. */
  toggle(): void {
    if (!this.element) return;
    if (this.state === 'playing') {
      this.element.pause();
      this.stopWatch();
      this.setState('paused');
    } else if (this.state === 'paused') {
      void this.element.play().then(() => {
        this.setState('playing');
        this.startWatch();
      });
    }
  }

  /** Оборвать реплику: игрок пролистал текст. */
  stop(): void {
    this.stopWatch();
    if (this.element) {
      this.element.pause();
    }
    if (this.state !== 'idle') this.setState('idle');
  }

  /** Полный сброс при уходе со сцены. */
  dispose(): void {
    this.stop();
    this.current = null;
    if (this.element) {
      this.element.src = '';
      this.element = null;
    }
  }

  // ---------- внутреннее ----------

  private setState(next: VoiceState): void {
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }

  private startWatch(): void {
    this.stopWatch();
    const clip = this.current;
    const element = this.element;
    if (!clip || !element) return;

    this.watch = window.setInterval(() => {
      const end = clip.end;
      if (end !== undefined && element.currentTime >= end) {
        element.pause();
        this.stopWatch();
        this.setState('idle');
        return;
      }
      if (element.ended) {
        this.stopWatch();
        this.setState('idle');
      }
    }, WATCH_MS);
  }

  private stopWatch(): void {
    window.clearInterval(this.watch);
    this.watch = 0;
  }

  /** Проверяет наличие файла один раз на путь. */
  private async resolve(src: string): Promise<string | null> {
    if (!this.known.has(src)) {
      const found = await findAsset(`media/${src}`, 'audio');
      this.known.set(src, found ? assetUrl(found) : null);
    }
    return this.known.get(src) ?? null;
  }

  private ensureElement(): HTMLAudioElement {
    if (this.element) return this.element;

    const element = new Audio();
    element.preload = 'auto';
    element.crossOrigin = 'anonymous';
    this.element = element;

    // Усилитель: без него озвучку не слышно на фоне музыки.
    const ctx = audioContext();
    const bus = masterBus();
    if (ctx && bus) {
      try {
        const source = ctx.createMediaElementSource(element);
        const gain = ctx.createGain();
        gain.gain.value = VOICE_GAIN;
        source.connect(gain);
        gain.connect(bus);
      } catch {
        // браузер не дал подключить элемент — играем как есть
        element.volume = 1;
      }
    }

    return element;
  }
}

export const voice = new VoiceEngine();
