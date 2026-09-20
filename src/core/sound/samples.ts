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

/** Уровень, ниже которого считаем, что звука нет (−42 dB). */
const SILENCE_LEVEL = 0.008;

/**
 * Пауза, после которой звук считается законченным.
 *
 * Присланные файлы — это дорожки: в `click` три щелчка подряд, в `tick`
 * тридцать четыре тика. Игра же проигрывает такой звук на каждое
 * нажатие и каждую секунду таймера, поэтому берётся только первое
 * событие. Порог 0,1 с выбран по всему набору: при 0,08 с обрезался бы
 * `miss`, у которого внутри есть короткий провал.
 */
const MAX_GAP = 0.1;

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

/**
 * Отрезает тишину в начале и всё после первой заметной паузы.
 *
 * Начальная тишина — это задержка отклика: у `stamp` её 128 мс, и удар
 * штампа раздавался бы заметно позже нажатия.
 */
function trim(context: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    channels.push(buffer.getChannelData(channel));
  }

  const amplitude = (index: number): number => {
    let peak = 0;
    for (const data of channels) {
      const value = Math.abs(data[index]);
      if (value > peak) peak = value;
    }
    return peak;
  };

  const length = buffer.length;
  let start = 0;
  while (start < length && amplitude(start) < SILENCE_LEVEL) start += 1;
  if (start >= length) return buffer;

  const gapLength = Math.round(MAX_GAP * buffer.sampleRate);
  let end = start;
  let quiet = 0;
  for (let i = start; i < length; i += 1) {
    if (amplitude(i) < SILENCE_LEVEL) {
      quiet += 1;
      if (quiet >= gapLength) break;
    } else {
      quiet = 0;
      end = i;
    }
  }

  const size = end - start + 1;
  if (size >= length) return buffer;

  const trimmed = context.createBuffer(buffer.numberOfChannels, size, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    trimmed.getChannelData(channel).set(channels[channel].subarray(start, start + size));
  }
  return trimmed;
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
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    const buffer = trim(context, decoded);
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
