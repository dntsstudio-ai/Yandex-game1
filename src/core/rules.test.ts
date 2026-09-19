import { describe, expect, it } from 'vitest';
import { scenarios } from '../data/scenarios';
import {
  ROUND_DURATION_MS,
  SCORING,
  clickPoints,
  computeTotals,
  liveAccuracy,
  purityIndex,
  rankFor,
  resolveRound,
  roundDuration,
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
