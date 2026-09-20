/**
 * Фоновая музыка.
 *
 * Если в проект добавлен файл `public/media/music/theme.mp3`, играет он
 * (зацикленно). Если файла нет — звучит синтезированная тема: спокойный
 * минорный эмбиент из четырёх аккордов с арпеджио и мягким басом.
 * Выключается в настройках.
 */
import { MEDIA, assetUrl, findAsset } from '../assets';
import { settings } from '../settings';
import { audioContext, masterBus, reverbBus, unlockAudio } from './context';

/** Ноты аккордов (частоты, Гц): Am9 → Fmaj7 → Dm7 → E7. */
const PROGRESSION: number[][] = [
  [110.0, 164.81, 196.0, 246.94, 329.63],
  [87.31, 130.81, 164.81, 220.0, 349.23],
  [73.42, 110.0, 174.61, 220.0, 293.66],
  [82.41, 123.47, 164.81, 207.65, 311.13],
];

/** Длительность одного аккорда, с. */
const CHORD_SECONDS = 4;

/** Общий уровень музыки: фон, который не спорит со звуковыми эффектами. */
const MUSIC_LEVEL = 0.38;

class MusicEngine {
  private element: HTMLAudioElement | null = null;
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private chordIndex = 0;
  private nextChordAt = 0;
  private playing = false;
  private useFile: boolean | null = null;
  private filePath: string | null = null;

  /** Запуск музыки (только после действия пользователя). */
  async start(): Promise<void> {
    if (this.playing) return;
    this.playing = true;

    if (this.useFile === null) {
      this.filePath = await findAsset(MEDIA.musicTheme, 'audio');
      this.useFile = this.filePath !== null;
    }

    if (!settings.get().music) {
      this.playing = false;
      return;
    }

    if (this.useFile) this.startFile();
    else this.startSynth();
  }

  stop(): void {
    this.playing = false;
    if (this.element) {
      this.element.pause();
      this.element.currentTime = 0;
    }
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.gain) {
      const ctx = audioContext();
      if (ctx) {
        this.gain.gain.cancelScheduledValues(ctx.currentTime);
        this.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
      }
    }
  }

  /** Реакция на переключатель в настройках. */
  setEnabled(enabled: boolean): void {
    if (enabled) void this.start();
    else this.stop();
  }

  setVolume(volume: number): void {
    if (this.element) this.element.volume = 0.42 * volume;
    if (this.gain) this.gain.gain.value = MUSIC_LEVEL * volume;
  }

  /** Приглушение на экранах разбора — музыка не мешает читать. */
  duck(active: boolean): void {
    const level = active ? 0.45 : 1;
    if (this.element) this.element.volume = 0.42 * settings.get().volume * level;
    const ctx = audioContext();
    if (this.gain && ctx) {
      this.gain.gain.setTargetAtTime(MUSIC_LEVEL * settings.get().volume * level, ctx.currentTime, 0.4);
    }
  }

  // ---------- воспроизведение готового файла ----------

  private startFile(): void {
    if (!this.element) {
      this.element = new Audio(assetUrl(this.filePath ?? MEDIA.musicTheme));
      this.element.loop = true;
      this.element.preload = 'auto';
      // файл повреждён или недоступен — переходим на синтезированную тему
      this.element.addEventListener('error', () => {
        this.useFile = false;
        this.element = null;
        if (this.playing) this.startSynth();
      });
    }
    this.element.volume = 0.42 * settings.get().volume;
    void this.element.play().catch(() => {
      // автозапуск запрещён — попробуем ещё раз при следующем действии
      this.playing = false;
    });
  }

  // ---------- синтезированная тема ----------

  private startSynth(): void {
    unlockAudio();
    const ctx = audioContext();
    const bus = masterBus();
    if (!ctx || !bus) {
      this.playing = false;
      return;
    }

    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.connect(bus);
      const reverb = reverbBus();
      if (reverb) this.gain.connect(reverb);
    }
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gain.gain.setTargetAtTime(MUSIC_LEVEL * settings.get().volume, ctx.currentTime, 1.2);

    this.nextChordAt = ctx.currentTime + 0.15;
    this.scheduleLoop();
  }

  /** Планировщик: держит очередь на один аккорд вперёд. */
  private scheduleLoop = (): void => {
    const ctx = audioContext();
    if (!ctx || !this.playing) return;

    while (this.nextChordAt < ctx.currentTime + CHORD_SECONDS) {
      this.scheduleChord(PROGRESSION[this.chordIndex % PROGRESSION.length], this.nextChordAt);
      this.chordIndex += 1;
      this.nextChordAt += CHORD_SECONDS;
    }

    this.timer = window.setTimeout(this.scheduleLoop, CHORD_SECONDS * 500);
  };

  private scheduleChord(chord: number[], at: number): void {
    const [root, ...rest] = chord;

    // Бас: мягкий импульс в начале аккорда и на его середине.
    this.voice(root / 2, at, 2.4, 'sine', 0.3, 640);
    this.voice(root / 2, at + CHORD_SECONDS / 2, 1.6, 'sine', 0.12, 520);

    // Подложка: выдержанные ноты аккорда.
    rest.slice(0, 3).forEach((frequency, index) => {
      this.voice(frequency, at + index * 0.05, CHORD_SECONDS * 1.05, 'triangle', 0.13, 1500);
    });

    // Арпеджио: верхние ноты аккорда с равным шагом.
    const top = chord[chord.length - 1];
    const pattern = [top, top * 1.5, top, top * 1.25];
    pattern.forEach((frequency, index) => {
      this.voice(frequency, at + index * (CHORD_SECONDS / pattern.length), 0.9, 'sine', 0.07, 2600);
    });
  }

  /** Одна нота с мягкой атакой и затуханием. */
  private voice(
    frequency: number,
    at: number,
    duration: number,
    type: OscillatorType,
    level: number,
    cutoff: number,
  ): void {
    const ctx = audioContext();
    if (!ctx || !this.gain) return;

    const osc = ctx.createOscillator();
    const detuned = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    detuned.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    detuned.frequency.setValueAtTime(frequency, at);
    detuned.detune.setValueAtTime(6, at);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);

    const attack = Math.min(0.9, duration * 0.35);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + attack);
    gain.gain.setTargetAtTime(0.0001, at + attack, duration * 0.35);

    osc.connect(filter);
    detuned.connect(filter);
    filter.connect(gain).connect(this.gain);

    osc.start(at);
    detuned.start(at);
    osc.stop(at + duration + 0.6);
    detuned.stop(at + duration + 0.6);
  }
}

export const music = new MusicEngine();
