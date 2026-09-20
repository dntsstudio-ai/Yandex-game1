/**
 * Лучший результат игрока. Хранится в браузере, чтобы на итоговом экране
 * было с чем сравнить новую партию.
 */
const STORAGE_KEY = 'red-flag:best-index';

export interface RecordResult {
  /** Лучший индекс чистоты до этой партии; null, если партий ещё не было. */
  previous: number | null;
  /** Побит ли рекорд текущей партией. */
  isRecord: boolean;
  /** Лучший индекс с учётом текущей партии. */
  best: number;
}

export function readBestIndex(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
  } catch {
    return null;
  }
}

/** Сохраняет результат партии и сообщает, стал ли он рекордом. */
export function submitIndex(index: number): RecordResult {
  const previous = readBestIndex();
  const rounded = Math.round(index);
  // Первая партия рекордом не считается: сравнивать ещё не с чем.
  const isRecord = previous !== null && rounded > previous;
  const best = previous === null ? rounded : Math.max(previous, rounded);

  if (typeof localStorage !== 'undefined' && (previous === null || rounded > previous)) {
    try {
      localStorage.setItem(STORAGE_KEY, String(rounded));
    } catch {
      // приватный режим — рекорд просто не сохранится
    }
  }

  return { previous, isRecord, best };
}
