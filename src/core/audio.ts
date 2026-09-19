/**
 * Минимальные звуковые эффекты на Web Audio API.
 * Никаких файлов и библиотек — только синтез коротких сигналов.
 */
type SoundName = 'hit' | 'miss' | 'decision' | 'good' | 'bad' | 'tick' | 'final';

const PRESETS: Record<SoundName, { freq: number; to: number; dur: number; type: OscillatorType; gain: number }> = {
  hit: { freq: 660, to: 990, dur: 0.12, type: 'triangle', gain: 0.16 },
  miss: { freq: 220, to: 120, dur: 0.18, type: 'sawtooth', gain: 0.12 },
  decision: { freq: 420, to: 520, dur: 0.1, type: 'sine', gain: 0.12 },
  good: { freq: 520, to: 880, dur: 0.22, type: 'sine', gain: 0.16 },
  bad: { freq: 300, to: 140, dur: 0.3, type: 'square', gain: 0.1 },
  tick: { freq: 880, to: 880, dur: 0.05, type: 'sine', gain: 0.07 },
  final: { freq: 392, to: 784, dur: 0.5, type: 'triangle', gain: 0.16 },
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /** Первый вызов должен произойти по действию пользователя. */
  unlock(): void {
    this.ensureContext()?.resume().catch(() => undefined);
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const preset = PRESETS[name];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = preset.type;
    osc.frequency.setValueAtTime(preset.freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, preset.to), now + preset.dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + preset.dur + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }
}

export const audio = new AudioEngine();
