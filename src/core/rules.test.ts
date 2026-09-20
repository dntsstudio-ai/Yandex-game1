import { describe, expect, it } from 'vitest';
import { scenarios } from '../data/scenarios';
import {
  ROUND_DURATION_MS,
  SCORING,
  clickPoints,
  computeTotals,
  RANKS,
  STREAK,
  liveAccuracy,
  nextRank,
  purityBreakdown,
  purityIndex,
  rankFor,
  resolveRound,
  roundDuration,
  streakBonus,
  suspiciousIds,
} from './rules';
import { GameEngine, createInitialState } from './engine';
import type { Scenario } from './types';

const demo: Scenario = {
  id: 'demo',
  title: 'Тестовый документ',
  kind: 'email',
  source: 'тест',
  brief: 'тест',
  blocks: [{ type: 'lines', lines: [{ text: '{{bad-1}} {{bad-2}} {{ok-1}} {{ok-2}}' }] }],
  hotspots: [
    { id: 'bad-1', text: 'наличные', suspicious: true, note: '' },
    { id: 'bad-2', text: 'без конкурса', suspicious: true, note: '' },
    { id: 'ok-1', text: 'срок поставки', suspicious: false, note: '' },
    { id: 'ok-2', text: 'НДС', suspicious: false, note: '' },
  ],
  correctDecision: 'stop',
  explanation: 'тест',
};

const clean: Scenario = {
  ...demo,
  id: 'demo-clean',
  hotspots: [
    { id: 'ok-1', text: 'три предложения', suspicious: false, note: '' },
    { id: 'ok-2', text: 'согласовано', suspicious: false, note: '' },
  ],
  correctDecision: 'pass',
};

/** Пять признаков риска подряд — чтобы проверить серию до ×5. */
const long: Scenario = {
  ...demo,
  id: 'demo-long',
  hotspots: [
    { id: 'f1', text: '1', suspicious: true, note: '' },
    { id: 'f2', text: '2', suspicious: true, note: '' },
    { id: 'f3', text: '3', suspicious: true, note: '' },
    { id: 'f4', text: '4', suspicious: true, note: '' },
    { id: 'f5', text: '5', suspicious: true, note: '' },
    { id: 'ok', text: 'норма', suspicious: false, note: '' },
  ],
};

describe('очки за клики', () => {
  it('верный клик даёт +100, ошибочный −100', () => {
    expect(clickPoints(demo, 'bad-1')).toBe(SCORING.hit);
    expect(clickPoints(demo, 'ok-1')).toBe(SCORING.falsePositive);
  });

  it('неизвестный элемент не меняет счёт', () => {
    expect(clickPoints(demo, 'нет-такого')).toBe(0);
  });
});

describe('итог раунда', () => {
  it('безупречный раунд: 2 признака + верное решение + бонус', () => {
    const result = resolveRound(demo, ['bad-1', 'bad-2'], 'stop');
    expect(result.found).toEqual(['bad-1', 'bad-2']);
    expect(result.missed).toEqual([]);
    expect(result.falsePositives).toEqual([]);
    expect(result.points).toBe(200 + SCORING.decisionBonus + SCORING.perfectBonus); // 500
  });

  it('ложное срабатывание снимает очки и лишает бонуса', () => {
    const result = resolveRound(demo, ['bad-1', 'bad-2', 'ok-1'], 'stop');
    expect(result.falsePositives).toEqual(['ok-1']);
    expect(result.points).toBe(200 - 100 + SCORING.decisionBonus); // 300
  });

  it('пропущенный признак и неверное решение: штраф', () => {
    const result = resolveRound(demo, ['bad-1'], 'pass');
    expect(result.missed).toEqual(['bad-2']);
    expect(result.decisionCorrect).toBe(false);
    expect(result.points).toBe(100 + SCORING.decisionPenalty); // -100
  });

  it('чистый документ без кликов: решение «пропустить» + бонус', () => {
    const result = resolveRound(clean, [], 'pass');
    expect(result.points).toBe(SCORING.decisionBonus + SCORING.perfectBonus); // 300
  });

  it('клики по чистому документу наказываются', () => {
    const result = resolveRound(clean, ['ok-1', 'ok-2'], 'stop');
    expect(result.points).toBe(-200 + SCORING.decisionPenalty); // -400
  });

  it('повторные клики по одному элементу считаются один раз', () => {
    const result = resolveRound(demo, ['bad-1', 'bad-1', 'bad-1'], 'stop');
    expect(result.found).toEqual(['bad-1']);
    expect(result.points).toBe(100 + SCORING.decisionBonus); // 300
  });
});

describe('истечение времени на документ', () => {
  it('решение не принято: найденное засчитано, но штраф как за ошибку', () => {
    const result = resolveRound(demo, ['bad-1'], null);
    expect(result.decision).toBeNull();
    expect(result.decisionCorrect).toBe(false);
    expect(result.found).toEqual(['bad-1']);
    expect(result.missed).toEqual(['bad-2']);
    expect(result.points).toBe(100 + SCORING.decisionPenalty); // -100
  });

  it('безупречный бонус не даётся без решения', () => {
    const result = resolveRound(demo, ['bad-1', 'bad-2'], null);
    expect(result.points).toBe(200 + SCORING.decisionPenalty); // 0
  });

  it('просроченные документы попадают в статистику', () => {
    const timedOut = resolveRound(demo, [], null);
    const solved = resolveRound(clean, [], 'pass');
    const totals = computeTotals(
      { score: 0, results: [timedOut, solved] },
      [demo, clean],
      12_000,
    );
    expect(totals.timedOutRounds).toBe(1);
    expect(totals.roundsPlayed).toBe(2);
    expect(totals.correctDecisions).toBe(1);
  });
});

describe('индекс чистоты', () => {
  it('идеальная партия — 100%', () => {
    expect(
      purityIndex({ found: 10, totalFlags: 10, correctDecisions: 5, roundsPlayed: 5, falsePositives: 0 }),
    ).toBe(100);
  });

  it('пустая партия — 0%', () => {
    expect(
      purityIndex({ found: 0, totalFlags: 0, correctDecisions: 0, roundsPlayed: 0, falsePositives: 0 }),
    ).toBe(0);
  });

  it('половина найденного и половина верных решений — около 50%', () => {
    expect(
      purityIndex({ found: 5, totalFlags: 10, correctDecisions: 2, roundsPlayed: 4, falsePositives: 0 }),
    ).toBe(50);
  });

  it('ложные срабатывания снижают индекс, но не ниже нуля', () => {
    const withFp = purityIndex({
      found: 10,
      totalFlags: 10,
      correctDecisions: 5,
      roundsPlayed: 5,
      falsePositives: 4,
    });
    expect(withFp).toBe(80);
    expect(
      purityIndex({ found: 0, totalFlags: 10, correctDecisions: 0, roundsPlayed: 5, falsePositives: 20 }),
    ).toBe(0);
  });
});

describe('сводная статистика', () => {
  it('суммирует раунды и считает точность', () => {
    const first = resolveRound(demo, ['bad-1', 'bad-2'], 'stop');
    const second = resolveRound(clean, ['ok-1'], 'stop');
    const totals = computeTotals(
      { score: first.points + second.points, results: [first, second] },
      [demo, clean],
      30_000,
    );

    expect(totals.found).toBe(2);
    expect(totals.missed).toBe(0);
    expect(totals.falsePositives).toBe(1);
    expect(totals.correctDecisions).toBe(1);
    expect(totals.totalFlags).toBe(2);
    expect(totals.accuracy).toBe(67);
    expect(totals.score).toBe(500 + (-100 + SCORING.decisionPenalty));
  });

  it('точность по ходу партии учитывает текущие клики', () => {
    const state = { results: [], clicked: ['bad-1', 'ok-1'] };
    expect(liveAccuracy(state, demo)).toBe(50);
    expect(liveAccuracy({ results: [], clicked: [] })).toBe(100);
  });
});

describe('движок', () => {
  it('начисляет очки за клики и решение без двойного учёта', () => {
    const engine = new GameEngine([demo]);
    engine.start();

    expect(engine.clickHotspot('bad-1').points).toBe(100);
    expect(engine.getState().score).toBe(100);

    // повторный клик игнорируется
    expect(engine.clickHotspot('bad-1').accepted).toBe(false);
    expect(engine.getState().score).toBe(100);

    expect(engine.clickHotspot('ok-1').points).toBe(-100);
    expect(engine.getState().score).toBe(0);

    engine.decide('stop');
    // 100 − 100 + 200 за верное решение (бонус не даётся: есть пропуск и ошибка)
    expect(engine.getState().score).toBe(200);
    expect(engine.getState().phase).toBe('round-result');
    expect(engine.getState().results).toHaveLength(1);
  });

  it('после последней ситуации переходит к финалу', () => {
    const engine = new GameEngine([demo]);
    engine.start();
    engine.decide('stop');
    engine.next();
    expect(engine.getState().phase).toBe('final');
    expect(engine.getState().finishReason).toBe('complete');
  });

  it('идеальное прохождение двух ситуаций даёт сумму бонусов', () => {
    const engine = new GameEngine([demo, clean]);
    engine.start();
    engine.clickHotspot('bad-1');
    engine.clickHotspot('bad-2');
    engine.decide('stop');
    engine.next();
    engine.decide('pass');
    expect(engine.getState().score).toBe(500 + 300);
    expect(engine.getTotals().purityIndex).toBe(100);
  });

  it('таймер задаётся на каждый документ отдельно', () => {
    expect(createInitialState().timeLeftMs).toBe(ROUND_DURATION_MS);

    const engine = new GameEngine([
      { ...demo, timeLimitMs: 20_000 },
      { ...clean, timeLimitMs: 40_000 },
    ]);
    engine.start();
    expect(engine.getState().timeLeftMs).toBe(20_000);
    expect(engine.getState().roundDurationMs).toBe(20_000);

    // после разбора таймер сбрасывается под следующий документ
    engine.decide('stop');
    engine.next();
    expect(engine.getState().timeLeftMs).toBe(40_000);
    expect(engine.getState().roundDurationMs).toBe(40_000);
  });

  it('время на документ берётся из ситуации, иначе — значение по умолчанию', () => {
    expect(roundDuration(demo)).toBe(ROUND_DURATION_MS);
    expect(roundDuration({ ...demo, timeLimitMs: 12_000 })).toBe(12_000);
  });
});

describe('звания', () => {
  it('зависят от индекса чистоты', () => {
    expect(rankFor(100).title).toBe('КОМПЛАЕНС-ЭКСПЕРТ');
    expect(rankFor(70).title).toBe('ВНИМАТЕЛЬНЫЙ СОТРУДНИК');
    expect(rankFor(10).title).toBe('ЗОНА РИСКА');
  });
});

describe('контент', () => {
  it('в игре 10 ситуаций с уникальными id', () => {
    expect(scenarios).toHaveLength(10);
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(10);
  });

  it('всего не меньше 30 интерактивных элементов', () => {
    const total = scenarios.reduce((acc, s) => acc + s.hotspots.length, 0);
    expect(total).toBeGreaterThanOrEqual(30);
  });

  it('в каждой ситуации от 0 до 4 признаков риска и есть обычные элементы', () => {
    for (const scenario of scenarios) {
      const flags = suspiciousIds(scenario);
      expect(flags.length).toBeLessThanOrEqual(4);
      expect(scenario.hotspots.length).toBeGreaterThan(flags.length);
      expect(scenario.explanation.length).toBeGreaterThan(10);
    }
  });

  it('у каждой ситуации разумный лимит времени', () => {
    for (const scenario of scenarios) {
      const limit = roundDuration(scenario);
      expect(limit).toBeGreaterThanOrEqual(20_000);
      expect(limit).toBeLessThanOrEqual(60_000);
    }
  });

  it('время на документ не уменьшается по ходу игры', () => {
    const limits = scenarios.map(roundDuration);
    for (let i = 1; i < limits.length; i += 1) {
      expect(limits[i]).toBeGreaterThanOrEqual(limits[i - 1]);
    }
  });

  it('есть ситуация без нарушений', () => {
    const clear = scenarios.filter((s) => suspiciousIds(s).length === 0);
    expect(clear.length).toBeGreaterThanOrEqual(1);
    for (const scenario of clear) expect(scenario.correctDecision).toBe('pass');
  });

  it('ситуации с признаками риска требуют решения «остановить»', () => {
    for (const scenario of scenarios) {
      if (suspiciousIds(scenario).length > 0) expect(scenario.correctDecision).toBe('stop');
    }
  });

  it('каждый элемент размечен в тексте ровно один раз, id уникальны', () => {
    for (const scenario of scenarios) {
      const markers = JSON.stringify(scenario.blocks).match(/\{\{([a-z0-9-]+)\}\}/gi) ?? [];
      const used = markers.map((m) => m.slice(2, -2));
      const ids = scenario.hotspots.map((h) => h.id);

      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(used).size).toBe(used.length);
      expect([...ids].sort()).toEqual([...used].sort());
      for (const hotspot of scenario.hotspots) expect(hotspot.note.length).toBeGreaterThan(5);
    }
  });
});

describe('разбор индекса чистоты', () => {
  const full = {
    found: 10,
    totalFlags: 10,
    correctDecisions: 5,
    roundsPlayed: 5,
    falsePositives: 0,
  };

  it('безупречная проверка даёт 100 и полные доли', () => {
    const breakdown = purityBreakdown(full);
    expect(breakdown.index).toBe(100);
    expect(breakdown.detectionPoints + breakdown.decisionsPoints).toBe(100);
    expect(breakdown.penaltyPoints).toBe(0);
    expect(breakdown.detectionRatio).toBe(1);
    expect(breakdown.decisionsRatio).toBe(1);
  });

  it('доли складываются в тот же индекс, что и purityIndex', () => {
    const cases = [
      full,
      { found: 3, totalFlags: 10, correctDecisions: 2, roundsPlayed: 5, falsePositives: 4 },
      { found: 0, totalFlags: 0, correctDecisions: 1, roundsPlayed: 3, falsePositives: 0 },
      { found: 7, totalFlags: 9, correctDecisions: 9, roundsPlayed: 10, falsePositives: 30 },
    ];
    for (const input of cases) {
      const breakdown = purityBreakdown(input);
      expect(breakdown.index).toBe(purityIndex(input));
      const sum =
        breakdown.detectionPoints + breakdown.decisionsPoints - breakdown.penaltyPoints;
      expect(Math.abs(breakdown.index - Math.min(100, Math.max(0, sum)))).toBeLessThanOrEqual(1);
    }
  });

  it('штраф за ложные срабатывания ограничен половиной шкалы', () => {
    const many = purityBreakdown({ ...full, falsePositives: 999 });
    expect(many.penaltyPoints).toBe(50);
    expect(many.penaltyRatio).toBe(1);
    expect(many.index).toBe(50);
  });

  it('несыгранная партия даёт нули, а не деление на ноль', () => {
    const empty = purityBreakdown({
      found: 0,
      totalFlags: 0,
      correctDecisions: 0,
      roundsPlayed: 0,
      falsePositives: 0,
    });
    expect(empty.index).toBe(0);
    expect(Number.isNaN(empty.detectionRatio)).toBe(false);
  });

  it('индекс никогда не выходит за 0..100', () => {
    for (let found = 0; found <= 10; found += 1) {
      for (const falsePositives of [0, 5, 40]) {
        const value = purityIndex({ ...full, found, falsePositives });
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('звания', () => {
  it('пороги идут по убыванию и заканчиваются нулём', () => {
    for (let i = 1; i < RANKS.length; i += 1) {
      expect(RANKS[i].min).toBeLessThan(RANKS[i - 1].min);
    }
    expect(RANKS[RANKS.length - 1].min).toBe(0);
  });

  it('звание соответствует порогу', () => {
    for (const rank of RANKS) {
      expect(rankFor(rank.min).title).toBe(rank.title);
    }
    expect(rankFor(0).title).toBe(RANKS[RANKS.length - 1].title);
    expect(rankFor(100).title).toBe(RANKS[0].title);
  });

  it('следующее звание — ближайшее сверху, с остатком до него', () => {
    const ahead = nextRank(41);
    expect(ahead?.rank.min).toBe(45);
    expect(ahead?.need).toBe(4);
    // 41 находится между 25 и 45 — это 80 % пути
    expect(ahead?.progress).toBeCloseTo(0.8, 5);
  });

  it('на высшем звании расти некуда', () => {
    expect(nextRank(85)).toBeNull();
    expect(nextRank(100)).toBeNull();
  });

  it('прогресс всегда в пределах 0..1', () => {
    for (let index = 0; index < 85; index += 1) {
      const ahead = nextRank(index);
      expect(ahead).not.toBeNull();
      expect(ahead!.progress).toBeGreaterThanOrEqual(0);
      expect(ahead!.progress).toBeLessThanOrEqual(1);
      expect(ahead!.need).toBeGreaterThan(0);
    }
  });
});

describe('серия верных отметок', () => {
  it('бонус даётся только на пороге, а не на каждой отметке', () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(0);
    expect(streakBonus(3)).toBe(STREAK.bonuses[0].points);
    expect(streakBonus(4)).toBe(0);
    expect(streakBonus(5)).toBe(STREAK.bonuses[1].points);
    expect(streakBonus(6)).toBe(0);
  });

  it('растёт на признаках риска и рвётся ошибочной отметкой', () => {
    const engine = new GameEngine([long]);
    engine.start();

    expect(engine.clickHotspot('f1').streak).toBe(1);
    expect(engine.clickHotspot('f2').streak).toBe(2);
    const third = engine.clickHotspot('f3');
    expect(third.streak).toBe(3);
    expect(third.streakBonus).toBe(STREAK.bonuses[0].points);

    const wrong = engine.clickHotspot('ok');
    expect(wrong.streak).toBe(0);
    expect(wrong.streakBonus).toBe(0);
  });

  it('лучшая серия запоминается даже после обрыва', () => {
    const engine = new GameEngine([long]);
    engine.start();
    for (const id of ['f1', 'f2', 'f3', 'f4', 'f5']) engine.clickHotspot(id);
    expect(engine.getState().streak).toBe(5);
    engine.clickHotspot('ok');
    expect(engine.getState().streak).toBe(0);
    expect(engine.getState().bestStreak).toBe(5);
  });

  it('бонус за порог попадает в счёт', () => {
    const engine = new GameEngine([long]);
    engine.start();
    engine.clickHotspot('f1');
    engine.clickHotspot('f2');
    const before = engine.getState().score;
    engine.clickHotspot('f3');
    expect(engine.getState().score).toBe(before + SCORING.hit + STREAK.bonuses[0].points);
  });

  it('неверное решение рвёт серию', () => {
    const engine = new GameEngine([long]);
    engine.start();
    engine.clickHotspot('f1');
    engine.clickHotspot('f2');
    expect(engine.getState().streak).toBe(2);
    engine.decide('pass'); // верное решение — stop
    expect(engine.getState().streak).toBe(0);
  });
});

describe('подсказка', () => {
  it('указывает на ненайденный признак и стоит очков', () => {
    const engine = new GameEngine([demo]);
    engine.start();
    const before = engine.getState().score;

    expect(engine.canHint()).toBe(true);
    const hint = engine.useHint();
    expect(hint.hotspotId).toBe('bad-1');
    expect(hint.cost).toBe(SCORING.hintCost);
    expect(engine.getState().score).toBe(before + SCORING.hintCost);
  });

  it('вторая подсказка на том же документе не даётся', () => {
    const engine = new GameEngine([demo]);
    engine.start();
    engine.useHint();
    expect(engine.canHint()).toBe(false);
    expect(engine.useHint().hotspotId).toBeNull();
    expect(engine.getState().hintsUsed).toBe(1);
  });

  it('не указывает на уже найденный признак', () => {
    const engine = new GameEngine([demo]);
    engine.start();
    engine.clickHotspot('bad-1');
    expect(engine.useHint().hotspotId).toBe('bad-2');
  });

  it('на документе без нарушений подсказки нет', () => {
    const engine = new GameEngine([clean]);
    engine.start();
    expect(engine.canHint()).toBe(false);
    expect(engine.useHint().hotspotId).toBeNull();
  });

  it('взятая подсказка попадает в итог раунда и партии', () => {
    const engine = new GameEngine([demo]);
    engine.start();
    engine.useHint();
    engine.decide('stop');
    expect(engine.getState().lastResult?.hints).toBe(1);
    expect(engine.getTotals().hintsUsed).toBe(1);
  });
});
