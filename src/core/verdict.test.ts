import { describe, expect, it } from 'vitest';
import { buildVerdict, levelFor, scaleTo10, verdictSummary } from './verdict';
import type { Totals } from './types';

function totals(patch: Partial<Totals> = {}): Totals {
  return {
    score: 0,
    found: 0,
    missed: 0,
    falsePositives: 0,
    correctDecisions: 0,
    roundsPlayed: 10,
    timedOutRounds: 0,
    totalFlags: 20,
    elapsedMs: 0,
    purityIndex: 0,
    accuracy: 0,
    bestStreak: 0,
    hintsUsed: 0,
    ...patch,
  };
}

describe('levelFor', () => {
  it('делит шкалу по объявленным порогам', () => {
    expect(levelFor(0)).toBe('low');
    expect(levelFor(5)).toBe('low');
    expect(levelFor(6)).toBe('mid');
    expect(levelFor(7)).toBe('mid');
    expect(levelFor(8)).toBe('high');
    expect(levelFor(10)).toBe('high');
  });
});

describe('scaleTo10', () => {
  it('приводит долю к десятибалльной шкале', () => {
    expect(scaleTo10(5, 10)).toBe(5);
    expect(scaleTo10(3, 20)).toBe(2);
    expect(scaleTo10(20, 20)).toBe(10);
  });

  it('не делит на ноль', () => {
    expect(scaleTo10(0, 0)).toBe(0);
  });
});

describe('buildVerdict', () => {
  it('разбирает партию на три качества', () => {
    const sections = buildVerdict(totals());
    expect(sections.map((section) => section.id)).toEqual(['decisions', 'detection', 'caution']);
  });

  it('пороги решений совпадают с обещанными: 0–5, 6–7, 8–10', () => {
    const levelAt = (correct: number) =>
      buildVerdict(totals({ correctDecisions: correct })).find((s) => s.id === 'decisions')?.band.level;

    expect(levelAt(0)).toBe('low');
    expect(levelAt(5)).toBe('low');
    expect(levelAt(6)).toBe('mid');
    expect(levelAt(7)).toBe('mid');
    expect(levelAt(8)).toBe('high');
    expect(levelAt(10)).toBe('high');
  });

  it('внимательность считается по доле найденных признаков', () => {
    const section = buildVerdict(totals({ found: 18, totalFlags: 20 })).find(
      (s) => s.id === 'detection',
    );
    expect(section?.score).toBe(9);
    expect(section?.band.level).toBe('high');
  });

  it('документ без признаков риска не портит внимательность', () => {
    const section = buildVerdict(totals({ found: 0, totalFlags: 0 })).find(
      (s) => s.id === 'detection',
    );
    expect(section?.score).toBe(10);
  });

  it('аккуратность падает с каждой лишней отметкой', () => {
    const scoreAt = (falsePositives: number) =>
      buildVerdict(totals({ falsePositives })).find((s) => s.id === 'caution')?.score ?? -1;

    expect(scoreAt(0)).toBe(10);
    expect(scoreAt(0)).toBeGreaterThan(scoreAt(3));
    expect(scoreAt(3)).toBeGreaterThan(scoreAt(8));
    expect(scoreAt(30)).toBe(0);
  });

  it('лишние отметки считаются на десять документов', () => {
    const short = buildVerdict(totals({ roundsPlayed: 5, falsePositives: 5 })).find(
      (s) => s.id === 'caution',
    );
    const full = buildVerdict(totals({ roundsPlayed: 10, falsePositives: 10 })).find(
      (s) => s.id === 'caution',
    );
    expect(short?.score).toBe(full?.score);
  });

  it('у каждой оценки есть вывод и совет', () => {
    for (const section of buildVerdict(totals({ correctDecisions: 7, found: 10 }))) {
      expect(section.band.title.length).toBeGreaterThan(0);
      expect(section.band.meaning.length).toBeGreaterThan(0);
      expect(section.band.advice.length).toBeGreaterThan(0);
    }
  });

  it('не падает на партии без раундов', () => {
    expect(() => buildVerdict(totals({ roundsPlayed: 0, totalFlags: 0 }))).not.toThrow();
  });
});

describe('verdictSummary', () => {
  it('называет самое слабое место', () => {
    const sections = buildVerdict(totals({ correctDecisions: 10, found: 2, totalFlags: 20 }));
    expect(verdictSummary(sections)).toContain('нимательность'.toLowerCase());
  });

  it('на высоких оценках слабых мест не называет', () => {
    const sections = buildVerdict(
      totals({ correctDecisions: 10, found: 20, totalFlags: 20, falsePositives: 0 }),
    );
    expect(verdictSummary(sections)).toContain('Слабых мест');
  });
});
