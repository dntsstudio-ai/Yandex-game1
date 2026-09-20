/**
 * Звуковые эффекты.
 *
 * Если в `public/media/sfx/<имя>.mp3` лежит файл, играет он; для
 * остальных звуков синтезируется замена. Набор файлов можно пополнять
 * по одному — недостающие просто остаются синтезированными.
 */
import { settings } from '../settings';
import { audioContext, masterBus, noiseBuffer, reverbBus, setMasterVolume, unlockAudio } from './context';
import { loadSamples, playSample } from './samples';

export type SoundName =
  | 'hit'
  | 'miss'
  | 'click'
  | 'paper'
  | 'stamp'
  | 'good'
  | 'bad'
  | 'timeout'
  | 'tick'
  | 'count'
  | 'final';

/** Все имена: по ним же ищутся файлы в public/media/sfx. */
export const SOUND_NAMES: readonly SoundName[] = [
  'hit',
  'miss',
  'click',
  'paper',
  'stamp',
  'good',
  'bad',
  'timeout',
  'tick',
  'count',
  'final',
];

class SfxEngine {
  private unlocked = false;

  /** Вызывается по первому действию пользователя. */
  unlock(): void {
    unlockAudio();
    setMasterVolume(settings.get().volume);
    this.unlocked = true;

    // Файлы подгружаются в фоне: до их появления играет синтез.
    const ctx = audioContext();
    if (ctx) void loadSamples(ctx, SOUND_NAMES);
  }

  play(name: SoundName): void {
    if (!settings.get().sound) return;
    const ctx = audioContext();
    const bus = masterBus();
    if (!ctx || !bus) return;
    if (!this.unlocked) this.unlock();

    // Записанный звук имеет приоритет над синтезированным.
    if (playSample(ctx, bus, name)) return;

    switch (name) {
      case 'hit':
        this.tone(660, 990, 0.14, 'triangle', 0.18);
        this.tone(1320, 1560, 0.1, 'sine', 0.06, 0.04);
        break;
      case 'miss':
        this.tone(200, 110, 0.2, 'sawtooth', 0.12);
        break;
      case 'click':
        this.tone(520, 620, 0.07, 'sine', 0.1);
        break;
      case 'paper':
        this.noise(0.26, 2600, 0.12);
        break;
      case 'stamp':
        this.noise(0.12, 900, 0.22);
        this.tone(140, 70, 0.22, 'square', 0.12);
        break;
      case 'good':
        this.arp([523.25, 659.25, 783.99], 0.16, 'sine', 0.14);
        break;
      case 'bad':
        this.arp([392, 329.63, 261.63], 0.2, 'triangle', 0.14);
        break;
      case 'timeout':
        this.tone(440, 220, 0.5, 'sawtooth', 0.12);
        this.noise(0.4, 1200, 0.08);
        break;
      case 'tick':
        this.tone(1040, 1040, 0.05, 'sine', 0.08);
        break;
      case 'count':
        this.tone(880, 880, 0.03, 'sine', 0.04);
        break;
      case 'final':
        this.arp([392, 523.25, 659.25, 783.99], 0.5, 'triangle', 0.16, 0.12);
        break;
    }
  }

  /** Тон с плавным затуханием. */
  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    delay = 0,
  ): void {
    const ctx = audioContext();
    const bus = masterBus();
    if (!ctx || !bus) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(bus);
    const reverb = reverbBus();
    if (reverb) gain.connect(reverb);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  /** Шум через фильтр — шелест бумаги, удар штампа. */
  private noise(duration: number, cutoff: number, gainValue: number): void {
    const ctx = audioContext();
    const bus = masterBus();
    if (!ctx || !bus) return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter).connect(gain);
    gain.connect(bus);
    const reverb = reverbBus();
    if (reverb) gain.connect(reverb);

    source.start(now);
    source.stop(now + duration);
  }

  /** Короткая последовательность нот. */
  private arp(
    frequencies: number[],
    duration: number,
    type: OscillatorType,
    gainValue: number,
    step = 0.07,
  ): void {
    frequencies.forEach((frequency, index) => {
      this.tone(frequency, frequency, duration, type, gainValue, index * step);
    });
  }
}

export const sfx = new SfxEngine();
