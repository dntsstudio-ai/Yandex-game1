/**
 * Движок в части времени документа.
 *
 * Тесты идут в окружении без window, поэтому кадровый таймер не
 * запускается — проверяется то, что от него не зависит: какое время
 * движок объявляет и какое решение он зачтёт.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { roundDuration } from './rules';
import type { Scenario } from './types';

function scenario(id: string, timeLimitMs?: number): Scenario {
  return {
    id,
    title: id,
    kind: 'memo',
    source: '',
    brief: '',
    blocks: [{ type: 'lines', lines: [{ text: '{{a}} и {{b}}' }] }],
    hotspots: [
      { id: 'a', text: 'риск', suspicious: true, note: 'потому что риск' },
      { id: 'b', text: 'норма', suspicious: false, note: 'потому что норма' },
    ],
    correctDecision: 'stop',
    timeLimitMs,
    explanation: 'разбор',
  };
}

const deck = [scenario('one', 30_000), scenario('two', 40_000)];

describe('время документа', () => {
  it('по умолчанию у документа есть лимит из ситуации', () => {
    const engine = new GameEngine(deck);
    engine.start();
    expect(engine.isTimed()).toBe(true);
    expect(engine.getState().roundDurationMs).toBe(roundDuration(deck[0]));
  });

  it('лимит можно выключить на всю партию', () => {
    const engine = new GameEngine(deck);
    engine.setTimed(false);
    engine.start();
    expect(engine.isTimed()).toBe(false);
  });
});

describe('окно на «передумать»', () => {
  it('до выбора его нет', () => {
    const engine = new GameEngine(deck);
    engine.setTimed(false);
    engine.start();
    expect(engine.getArmed()).toBeNull();
  });

  it('выбор задаёт остаток времени равным окну', () => {
    const engine = new GameEngine(deck);
    engine.setTimed(false);
    engine.start();
    engine.armDecision('pass', 10_000);

    expect(engine.getArmed()).toBe('pass');
    expect(engine.getState().timeLeftMs).toBe(10_000);
    // шкала должна показывать полное окно, а не остаток лимита документа
    expect(engine.getState().roundDurationMs).toBe(10_000);
  });

  it('повторный выбор окно не перезапускает', () => {
    const engine = new GameEngine(deck);
    engine.start();
    engine.armDecision('stop', 10_000);
    engine.armDecision('pass', 10_000);
    expect(engine.getArmed()).toBe('stop');
  });

  it('отмена возвращает документ к его лимиту', () => {
    const engine = new GameEngine(deck);
    engine.setTimed(false);
    engine.start();
    engine.armDecision('stop', 10_000);
    engine.disarmDecision();

    expect(engine.getArmed()).toBeNull();
    expect(engine.getState().roundDurationMs).toBe(roundDuration(deck[0]));
  });

  it('отмена без выбора ничего не делает', () => {
    const engine = new GameEngine(deck);
    engine.start();
    const before = engine.getState().timeLeftMs;
    engine.disarmDecision();
    expect(engine.getState().timeLeftMs).toBe(before);
  });

  it('зачёт решения снимает выбор', () => {
    const engine = new GameEngine(deck);
    engine.start();
    engine.armDecision('stop', 10_000);
    engine.decide('stop');

    expect(engine.getArmed()).toBeNull();
    expect(engine.getState().phase).toBe('round-result');
    expect(engine.getState().lastResult?.decisionCorrect).toBe(true);
  });

  it('переход к следующему документу снимает выбор', () => {
    const engine = new GameEngine(deck);
    engine.start();
    engine.armDecision('stop', 10_000);
    engine.decide('stop');
    engine.next();

    expect(engine.getArmed()).toBeNull();
    expect(engine.getState().index).toBe(1);
    expect(engine.getState().roundDurationMs).toBe(roundDuration(deck[1]));
  });

  it('вне партии окно не открывается', () => {
    const engine = new GameEngine(deck);
    engine.armDecision('stop', 10_000);
    expect(engine.getArmed()).toBeNull();
  });
});

describe('раздача колоды', () => {
  it('меняет набор до старта партии', () => {
    const engine = new GameEngine(deck);
    engine.deal([scenario('three')]);
    expect(engine.getScenarios()).toHaveLength(1);
  });

  it('не меняет набор посреди партии', () => {
    const engine = new GameEngine(deck);
    engine.start();
    engine.deal([scenario('three')]);
    expect(engine.getScenarios()).toHaveLength(2);
  });

  it('пустую колоду не принимает', () => {
    const engine = new GameEngine(deck);
    expect(() => engine.deal([])).toThrow();
  });
});
