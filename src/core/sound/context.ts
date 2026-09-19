/**
 * Общий аудиоконтекст для эффектов и музыки: один граф, одна точка громкости.
 * Браузеры запускают звук только после действия пользователя, поэтому
 * контекст создаётся лениво и «разблокируется» по первому клику.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Общая шина: сюда подключаются и эффекты, и музыка. */
export function masterBus(): GainNode | null {
  const context = audioContext();
  if (!context) return null;
  if (!master) {
    master = context.createGain();
    master.gain.value = 0.7;
    master.connect(context.destination);
  }
  return master;
}

export function setMasterVolume(volume: number): void {
  const bus = masterBus();
  if (bus) bus.gain.value = Math.min(1, Math.max(0, volume));
}

/** Небольшой зал: делает звук объёмнее и «дороже». */
export function reverbBus(): ConvolverNode | null {
  const context = audioContext();
  const bus = masterBus();
  if (!context || !bus) return null;
  if (!reverb) {
    reverb = context.createConvolver();
    reverb.buffer = impulseResponse(context, 2.6, 2.6);
    const wet = context.createGain();
    wet.gain.value = 0.32;
    reverb.connect(wet).connect(bus);
  }
  return reverb;
}

export function unlockAudio(): void {
  const context = audioContext();
  if (context && context.state === 'suspended') {
    context.resume().catch(() => undefined);
  }
}

/** Синтезированный импульсный отклик — реверберация без внешних файлов. */
function impulseResponse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(2, length, rate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

/** Короткий буфер белого шума — основа «бумажных» и ударных звуков. */
export function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
