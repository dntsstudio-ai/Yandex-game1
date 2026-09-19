/**
 * Правила подсчёта очков. Чистые функции без обращения к DOM и таймерам —
 * именно они покрыты тестами (src/core/rules.test.ts).
 */
import type { Decision, GameState, RoundResult, Scenario, Totals } from './types';

/** Баланс игры. Менять здесь — движок и UI подхватывают автоматически. */
export const SCORING = {
  /** Клик по настоящему признаку риска. */
  hit: 100,
  /** Клик по нормальному элементу. */
  falsePositive: -100,
  /** Верное решение «пропустить/остановить». */
  decisionBonus: 200,
  /** Неверное решение. */
  decisionPenalty: -200,
  /** Бонус за раунд, где найдены все признаки и решение верное. */
  perfectBonus: 100,
} as const;

/** Длительность партии, мс. */
export const GAME_DURATION_MS = 90_000;

/** Признаки риска внутри ситуации. */
export function suspiciousIds(scenario: Scenario): string[] {
  return scenario.hotspots.filter((h) => h.suspicious).map((h) => h.id);
}

/** Очки за клик по элементу ситуации. */
export function clickPoints(scenario: Scenario, hotspotId: string): number {
  const hotspot = scenario.hotspots.find((h) => h.id === hotspotId);
  if (!hotspot) return 0;
  return hotspot.suspicious ? SCORING.hit : SCORING.falsePositive;
}

/**
 * Итог раунда: что найдено, что пропущено, сколько ложных срабатываний
 * и сколько очков это принесло.
 */
export function resolveRound(
  scenario: Scenario,
  clicked: readonly string[],
  decision: Decision,
): RoundResult {
  const unique = Array.from(new Set(clicked));
  const flags = suspiciousIds(scenario);
  const found = unique.filter((id) => flags.includes(id));
  const missed = flags.filter((id) => !unique.includes(id));
  const falsePositives = unique.filter(
    (id) => !flags.includes(id) && scenario.hotspots.some((h) => h.id === id),
  );
  const decisionCorrect = decision === scenario.correctDecision;

  let points =
    found.length * SCORING.hit +
    falsePositives.length * SCORING.falsePositive +
    (decisionCorrect ? SCORING.decisionBonus : SCORING.decisionPenalty);

  if (decisionCorrect && missed.length === 0 && falsePositives.length === 0) {
    points += SCORING.perfectBonus;
  }

  return {
    scenarioId: scenario.id,
    found,
    missed,
    falsePositives,
    decision,
    decisionCorrect,
    points,
  };
}

/**
 * ИНДЕКС ЧИСТОТЫ, 0–100%.
 * Учитывает три составляющие: доля найденных признаков (55%),
 * доля верных решений (45%) и штраф за ложные срабатывания (по 5% за каждое).
 */
export function purityIndex(params: {
  found: number;
  totalFlags: number;
  correctDecisions: number;
  roundsPlayed: number;
  falsePositives: number;
}): number {
  const { found, totalFlags, correctDecisions, roundsPlayed, falsePositives } = params;
  if (roundsPlayed === 0) return 0;

  const detection = totalFlags > 0 ? found / totalFlags : 1;
  const decisions = correctDecisions / roundsPlayed;
  const penalty = Math.min(0.5, falsePositives * 0.05);
  const raw = 0.55 * detection + 0.45 * decisions - penalty;

  return clamp(Math.round(raw * 100), 0, 100);
}

/** Сводная статистика партии. */
export function computeTotals(
  state: Pick<GameState, 'score' | 'results'>,
  scenarios: readonly Scenario[],
  elapsedMs: number,
): Totals {
  const results = state.results;
  const found = sum(results, (r) => r.found.length);
  const missed = sum(results, (r) => r.missed.length);
  const falsePositives = sum(results, (r) => r.falsePositives.length);
  const correctDecisions = results.filter((r) => r.decisionCorrect).length;
  const roundsPlayed = results.length;

  const totalFlags = results.reduce((acc, r) => {
    const scenario = scenarios.find((s) => s.id === r.scenarioId);
    return acc + (scenario ? suspiciousIds(scenario).length : 0);
  }, 0);

  const totalClicks = found + falsePositives;

  return {
    score: state.score,
    found,
    missed,
    falsePositives,
    correctDecisions,
    roundsPlayed,
    totalFlags,
    elapsedMs,
    purityIndex: purityIndex({
      found,
      totalFlags,
      correctDecisions,
      roundsPlayed,
      falsePositives,
    }),
    accuracy: totalClicks === 0 ? 0 : Math.round((found / totalClicks) * 100),
  };
}

/** Точность игрока по ходу партии: доля верных кликов среди всех кликов. */
export function liveAccuracy(state: Pick<GameState, 'results' | 'clicked'>, current?: Scenario): number {
  let hits = sum(state.results, (r) => r.found.length);
  let misses = sum(state.results, (r) => r.falsePositives.length);

  if (current) {
    const flags = suspiciousIds(current);
    for (const id of state.clicked) {
      if (flags.includes(id)) hits += 1;
      else misses += 1;
    }
  }

  const total = hits + misses;
  return total === 0 ? 100 : Math.round((hits / total) * 100);
}

/** Итоговое звание по индексу чистоты. */
export function rankFor(index: number): { title: string; caption: string } {
  if (index >= 85) return { title: 'КОМПЛАЕНС-ЭКСПЕРТ', caption: 'Вы видите риск там, где другие видят формальность.' };
  if (index >= 65) return { title: 'ВНИМАТЕЛЬНЫЙ СОТРУДНИК', caption: 'Хороший результат: большинство рисков остановлено вовремя.' };
  if (index >= 45) return { title: 'СТАЖЁР ПРОВЕРКИ', caption: 'Основное замечено, но часть сигналов прошла мимо.' };
  if (index >= 25) return { title: 'ФОРМАЛЬНЫЙ ПОДХОД', caption: 'Документы просмотрены, но не прочитаны.' };
  return { title: 'ЗОНА РИСКА', caption: 'Такую проверку легко обойти. Попробуйте ещё раз.' };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sum<T>(items: readonly T[], get: (item: T) => number): number {
  return items.reduce((acc, item) => acc + get(item), 0);
}
