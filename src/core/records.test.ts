import { beforeEach, describe, expect, it } from 'vitest';
import { readBestIndex, submitIndex } from './records';

/** Минимальный localStorage: тесты идут в node-окружении, где его нет. */
function stubStorage(initial: Record<string, string> = {}): void {
  const data = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      clear: () => data.clear(),
    },
  });
}

describe('рекорд индекса чистоты', () => {
  beforeEach(() => stubStorage());

  it('первая партия рекордом не считается, но сохраняется', () => {
    const result = submitIndex(42);
    expect(result.previous).toBeNull();
    expect(result.isRecord).toBe(false);
    expect(result.best).toBe(42);
    expect(readBestIndex()).toBe(42);
  });

  it('результат выше прежнего становится рекордом', () => {
    submitIndex(42);
    const result = submitIndex(71);
    expect(result.previous).toBe(42);
    expect(result.isRecord).toBe(true);
    expect(result.best).toBe(71);
    expect(readBestIndex()).toBe(71);
  });

  it('слабая партия рекорд не перезаписывает', () => {
    submitIndex(71);
    const result = submitIndex(30);
    expect(result.isRecord).toBe(false);
    expect(result.best).toBe(71);
    expect(readBestIndex()).toBe(71);
  });

  it('повтор прежнего результата рекордом не считается', () => {
    submitIndex(50);
    expect(submitIndex(50).isRecord).toBe(false);
  });

  it('мусор в хранилище читается как «рекорда нет»', () => {
    stubStorage({ 'red-flag:best-index': 'ерунда' });
    expect(readBestIndex()).toBeNull();
    stubStorage({ 'red-flag:best-index': '150' });
    expect(readBestIndex()).toBeNull();
  });

  it('без localStorage игра не падает', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    expect(readBestIndex()).toBeNull();
    expect(submitIndex(60)).toEqual({ previous: null, isRecord: false, best: 60 });
  });
});
