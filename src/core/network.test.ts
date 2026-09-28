import { describe, expect, it } from 'vitest';
import { decideState } from './network';

describe('decideState', () => {
  it('быстрый ответ — связь в порядке', () => {
    expect(decideState({ latency: 120, failures: 0 })).toBe('online');
  });

  it('одна осечка партию не прерывает', () => {
    expect(decideState({ latency: 4000, failures: 1 })).toBe('online');
  });

  it('две медленные проверки подряд — слабая связь', () => {
    expect(decideState({ latency: 4000, failures: 2 })).toBe('weak');
  });

  it('первый неотвеченный запрос уже повод остановиться', () => {
    expect(decideState({ latency: null, failures: 1 })).toBe('weak');
  });

  it('два неотвеченных запроса — связи нет', () => {
    expect(decideState({ latency: null, failures: 2 })).toBe('offline');
  });

  it('вернувшийся быстрый ответ снимает блокировку', () => {
    expect(decideState({ latency: 80, failures: 0 })).toBe('online');
  });
});
