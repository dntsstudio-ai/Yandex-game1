import { describe, expect, it } from 'vitest';
import { MIN_PER_DECISION, ROUND_COUNT, pickDeck } from './deck';
import { scenarios } from '../data/scenarios';
import type { Decision, Scenario } from './types';

/** Минимальная ситуация: колоде важны только id и верное решение. */
function make(id: string, decision: Decision): Scenario {
  return {
    id,
    title: id,
    kind: 'memo',
    source: '',
    brief: '',
    blocks: [],
    hotspots: [],
    correctDecision: decision,
    explanation: '',
  };
}

/** Предсказуемый «случай»: всегда первый элемент — порядок не меняется. */
const noShuffle = () => 0;

describe('pickDeck', () => {
  it('раздаёт ровно столько документов, сколько просили', () => {
    const deck = pickDeck(scenarios);
    expect(deck).toHaveLength(ROUND_COUNT);
  });

  it('не повторяет ситуации внутри партии', () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const deck = pickDeck(scenarios);
      expect(new Set(deck.map((item) => item.id)).size).toBe(deck.length);
    }
  });

  it('держит оба решения представленными', () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const deck = pickDeck(scenarios);
      const stop = deck.filter((item) => item.correctDecision === 'stop').length;
      expect(stop).toBeGreaterThanOrEqual(MIN_PER_DECISION);
      expect(deck.length - stop).toBeGreaterThanOrEqual(MIN_PER_DECISION);
    }
  });

  it('сначала берёт то, чего игрок ещё не видел', () => {
    const pool = [
      make('a', 'stop'),
      make('b', 'pass'),
      make('c', 'stop'),
      make('d', 'pass'),
    ];
    const deck = pickDeck(pool, { count: 2, seen: ['a', 'b'], random: noShuffle });
    expect(deck.map((item) => item.id).sort()).toEqual(['c', 'd']);
  });

  it('добирает уже показанные, если свежих не хватает', () => {
    const pool = [make('a', 'stop'), make('b', 'pass'), make('c', 'stop')];
    const deck = pickDeck(pool, { count: 3, seen: ['a', 'b', 'c'], random: noShuffle });
    expect(deck).toHaveLength(3);
  });

  it('не отдаёт больше, чем есть в наборе', () => {
    const pool = [make('a', 'stop'), make('b', 'pass')];
    expect(pickDeck(pool, { count: 10, random: noShuffle })).toHaveLength(2);
  });

  it('добирает колоду, даже если решения в наборе перекошены', () => {
    const pool = Array.from({ length: 12 }, (_, index) => make(`s${index}`, 'stop'));
    const deck = pickDeck(pool, { count: 10, random: noShuffle });
    expect(deck).toHaveLength(10);
  });

  it('меняет состав от партии к партии', () => {
    const first = pickDeck(scenarios).map((item) => item.id).join();
    const second = pickDeck(scenarios).map((item) => item.id).join();
    const third = pickDeck(scenarios).map((item) => item.id).join();
    expect(new Set([first, second, third]).size).toBeGreaterThan(1);
  });

  it('на пустом наборе отдаёт пустую колоду', () => {
    expect(pickDeck([], { count: 5 })).toEqual([]);
  });
});
