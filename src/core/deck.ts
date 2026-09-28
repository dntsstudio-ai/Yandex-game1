/**
 * Раздача документов на партию.
 *
 * Ситуаций в наборе намного больше, чем игрок видит за одну проверку,
 * поэтому колода собирается заново перед каждой партией. Две задачи:
 * не показывать подряд одно и то же и не дать угадывать решение —
 * если в колоде окажутся почти одни «остановить», игрок перестанет
 * читать документы и начнёт жать одну кнопку.
 */
import { roundDuration, suspiciousIds } from './rules';
import type { Scenario } from './types';

/** Сколько документов игрок проверяет за партию. */
export const ROUND_COUNT = 10;

/**
 * Сколько документов каждого верного решения должно быть в колоде.
 * Остальные добираются как придётся.
 */
export const MIN_PER_DECISION = 4;

const SEEN_KEY = 'red-flag:seen';

export interface DeckOptions {
  count?: number;
  /** Идентификаторы ситуаций из прошлых партий — берутся в последнюю очередь. */
  seen?: readonly string[];
  /** Источник случайности; подменяется в тестах. */
  random?: () => number;
}

/**
 * Собирает колоду на партию.
 *
 * Сначала идут ситуации, которых игрок ещё не видел, и только когда они
 * кончаются — уже показанные. Внутри каждой группы порядок случайный.
 */
export function pickDeck(pool: readonly Scenario[], options: DeckOptions = {}): Scenario[] {
  const count = Math.min(options.count ?? ROUND_COUNT, pool.length);
  if (count <= 0) return [];

  const random = options.random ?? Math.random;
  const seen = new Set(options.seen ?? []);

  const fresh = shuffle(pool.filter((item) => !seen.has(item.id)), random);
  const old = shuffle(pool.filter((item) => seen.has(item.id)), random);
  const ordered = [...fresh, ...old];

  // Потолок на одно решение: столько документов одного ответа в колоде
  // допустимо, всё сверх — пропускаем в пользу противоположных.
  const limit = Math.max(count - MIN_PER_DECISION, Math.ceil(count / 2));
  const taken: Scenario[] = [];
  const used = new Set<string>();
  const counts = { pass: 0, stop: 0 };

  for (const scenario of ordered) {
    if (taken.length === count) break;
    if (counts[scenario.correctDecision] >= limit) continue;
    taken.push(scenario);
    used.add(scenario.id);
    counts[scenario.correctDecision] += 1;
  }

  // Квота не сошлась (в наборе перекос по решениям) — добираем чем есть,
  // иначе партия окажется короче обещанной.
  if (taken.length < count) {
    for (const scenario of ordered) {
      if (taken.length === count) break;
      if (used.has(scenario.id)) continue;
      taken.push(scenario);
      used.add(scenario.id);
    }
  }

  return order(taken);
}

/**
 * Порядок внутри партии: от простого к сложному.
 *
 * Раздача случайна, а последовательность — нет. Первый документ должен
 * быть коротким: игрок ещё привыкает к интерфейсу, и длинный договор
 * на старте читается как наказание. Время на документ и служит мерой
 * сложности — оно назначено под объём текста.
 */
function order(deck: readonly Scenario[]): Scenario[] {
  return [...deck].sort((a, b) => {
    const byTime = roundDuration(a) - roundDuration(b);
    if (byTime !== 0) return byTime;

    const byFlags = suspiciousIds(a).length - suspiciousIds(b).length;
    if (byFlags !== 0) return byFlags;

    // Последняя ступень — по количеству кликабельных мест: так порядок
    // не зависит от того, в каком виде пришёл массив.
    return a.hotspots.length - b.hotspots.length;
  });
}

/** Что игрок уже видел: список хранится в браузере и растёт до размера набора. */
export function readSeen(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Запоминает раздачу. Когда просмотрено уже почти всё, список
 * сбрасывается: иначе «свежих» ситуаций не останется и порядок
 * перестанет обновляться.
 */
export function rememberSeen(deck: readonly Scenario[], poolSize: number): string[] {
  const merged = Array.from(new Set([...readSeen(), ...deck.map((item) => item.id)]));
  const next = merged.length >= poolSize ? deck.map((item) => item.id) : merged;

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // приватный режим — колода просто будет повторяться чаще
    }
  }
  return next;
}

/** Перемешивание Фишера — Йетса: копия, исходный массив не трогаем. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
