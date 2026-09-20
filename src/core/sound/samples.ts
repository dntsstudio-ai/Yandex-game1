/**
 * Записанные звуковые эффекты.
 *
 * Файлы лежат в `public/media/sfx/<имя>.mp3` и необязательны: для звука,
 * которого нет, играет синтезированная замена. Поэтому набор можно
 * пополнять по одному файлу.
 */
import { assetUrl, findAsset } from '../assets';

/** Пик, к которому приводятся все сэмплы: присланные файлы сведены
    по-разному, и без выравнивания один звук глушит другой. */
const TARGET_PEAK = 0.7;

/** Короткий спад в конце: часть файлов обрывается на громком месте,
    и без него в колонках слышен щелчок. */
const FADE_OUT = 0.012;

interface Sample {
  buffer: AudioBuffer;
  /** Множитель громкости, выравнивающий пик к TARGET_PEAK. */
  gain: number;
}

const samples = new Map<string, Sample>();
let loading: Promise<void> | null = null;

/** Пиковая амплитуда по всем каналам. */
function peakOf(buffer: AudioBuffer): number {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      const value = Math.abs(data[i]);
      if (value > peak) peak = value;
    }
  }
  return peak;
}

async function loadOne(context: AudioContext, name: string): Promise<void> {
  // Через findAsset, а не прямым запросом: он сверяется со списком файлов,
  // собранным при сборке, и не сыплет ошибками 404 на каждый звук,
  // которого ещё нет.
  const path = await findAsset(`media/sfx/${name}.mp3`, 'audio');
  if (!path) return;

  try {
    const response = await fetch(assetUrl(path));
    if (!response.ok) return;
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    const peak = peakOf(buffer);
    samples.set(name, { buffer, gain: peak > 0.001 ? TARGET_PEAK / peak : 1 });
  } catch {
    // битый или неподдерживаемый файл — останется синтезированная замена
  }
}

/**
 * Загружает все доступные файлы. Вызывается один раз; повторные вызовы
 * возвращают ту же работу.
 */
export function loadSamples(context: AudioContext, names: readonly string[]): Promise<void> {
  if (!loading) {
    loading = Promise.all(names.map((name) => loadOne(context, name))).then(() => undefined);
  }
  return loading;
}

export function hasSample(name: string): boolean {
  return samples.has(name);
}

/** Проигрывает сэмпл. Возвращает false, если файла нет. */
export function playSample(context: AudioContext, bus: AudioNode, name: string): boolean {
  const sample = samples.get(name);
  if (!sample) return false;

  const source = context.createBufferSource();
  source.buffer = sample.buffer;

  const gain = context.createGain();
  const now = context.currentTime;
  const duration = sample.buffer.duration;
  const fade = Math.min(FADE_OUT, duration / 3);

  gain.gain.setValueAtTime(sample.gain, now);
  gain.gain.setValueAtTime(sample.gain, now + duration - fade);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  source.connect(gain);
  gain.connect(bus);
  source.start(now);
  source.stop(now + duration);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  return true;
}
