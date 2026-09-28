import { describe, expect, it } from 'vitest';
import { CONFIRM_MS, confirmLine } from './screens/game';

describe('подтверждение ответа в режиме для зрелых', () => {
  it('на «передумать» даётся десять секунд', () => {
    expect(CONFIRM_MS).toBe(10_000);
  });

  it('подпись меняется по ходу отсчёта', () => {
    const lines = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(confirmLine);
    expect(new Set(lines).size).toBeGreaterThanOrEqual(4);
  });

  it('в начале отсчёта напоминает, что ещё можно передумать', () => {
    expect(confirmLine(10)).toMatch(/передумать/i);
  });

  it('в середине спрашивает об уверенности', () => {
    expect(confirmLine(8)).toMatch(/уверен/i);
  });

  it('в конце предупреждает о фиксации ответа', () => {
    expect(confirmLine(1)).toMatch(/фиксир/i);
    expect(confirmLine(0)).toMatch(/фиксир/i);
  });

  it('подпись есть на любой секунде, в том числе за границами отсчёта', () => {
    for (const seconds of [-5, 0, 3, 10, 99]) {
      expect(confirmLine(seconds).length).toBeGreaterThan(0);
    }
  });
});
