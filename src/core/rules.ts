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
  /** Цена подсказки. Выбрана одна на всю игру — очки, а не секунды:
      таймер документа и без того жёсткий, а на коротком документе
      пять секунд отнимали бы вшестеро больше, чем на длинном. */
  hintCost: -50,
} as const;

/**
 * Серия верных отметок подряд. Бонус даётся один раз при достижении
 * порога, а не на каждой следующей отметке: это поощрение за внимательность,
 * а не прогрессия.
 */
export const STREAK = {
  /** С какой серии показывать индикатор. */
  showFrom: 2,
  /** Пороги и бонусы к ним. */
  bonuses: [
    { at: 3, points: 150 },
    { at: 5, points: 400 },
  ],
} as const;

/** Бонус за достижение порога серии; 0 — порог не достигнут. */
export function streakBonus(streak: number): number {
  return STREAK.bonuses.find((step) => step.at === streak)?.points ?? 0;
}

/** Время на один документ по умолчанию, мс. Сбрасывается в начале каждого раунда. */
export const ROUND_DURATION_MS = 35_000;

/** Время на конкретный документ: ситуация может задать своё значение. */
export function roundDuration(scenario: Scenario): number {
  return scenario.timeLimitMs ?? ROUND_DURATION_MS;
}

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
  decision: Decision | null,
  hints = 0,
): RoundResult {
  const unique = Array.from(new Set(clicked));
  const flags = suspiciousIds(scenario);
  const found = unique.filter((id) => flags.includes(id));
  const missed = flags.filter((id) => !unique.includes(id));
  const falsePositives = unique.filter(
    (id) => !flags.includes(id) && scenario.hotspots.some((h) => h.id === id),
  );
  // decision === null означает, что время на документ вышло: решение не принято.
  const decisionCorrect = decision !== null && decision === scenario.correctDecision;

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
    hints,
  };
}

/** Вес составляющих индекса чистоты. */
export const PURITY_WEIGHTS = {
  /** Доля найденных признаков. */
  detection: 0.55,
  /** Доля верных решений. */
  decisions: 0.45,
  /** Штраф за каждое ложное срабатывание. */
  falsePositive: 0.05,
  /** Предел штрафа. */
  penaltyLimit: 0.5,
} as const;

export interface PurityInput {
  found: number;
  totalFlags: number;
  correctDecisions: number;
  roundsPlayed: number;
  falsePositives: number;
}

export interface PurityBreakdown {
  /** Доли 0…1 — для шкал. */
  detectionRatio: number;
  decisionsRatio: number;
  penaltyRatio: number;
  /** Вклад каждой составляющей в проценты индекса. */
  detectionPoints: number;
  decisionsPoints: number;
  penaltyPoints: number;
  index: number;
}

/**
 * Разбор индекса чистоты по составляющим: доля найденных признаков,
 * доля верных решений и штраф за ложные срабатывания.
 * Итоговый экран показывает эти же числа, поэтому формула живёт
 * в одном месте.
 */
export function purityBreakdown(params: PurityInput): PurityBreakdown {
  const { found, totalFlags, correctDecisions, roundsPlayed, falsePositives } = params;

  if (roundsPlayed === 0) {
    return {
      detectionRatio: 0,
      decisionsRatio: 0,
      penaltyRatio: 0,
      detectionPoints: 0,
      decisionsPoints: 0,
      penaltyPoints: 0,
      index: 0,
    };
  }

  const detectionRatio = totalFlags > 0 ? found / totalFlags : 1;
  const decisionsRatio = correctDecisions / roundsPlayed;
  const penalty = Math.min(
    PURITY_WEIGHTS.penaltyLimit,
    falsePositives * PURITY_WEIGHTS.falsePositive,
  );

  const raw =
    PURITY_WEIGHTS.detection * detectionRatio + PURITY_WEIGHTS.decisions * decisionsRatio - penalty;

  return {
    detectionRatio,
    decisionsRatio,
    penaltyRatio: penalty / PURITY_WEIGHTS.penaltyLimit,
    detectionPoints: Math.round(PURITY_WEIGHTS.detection * detectionRatio * 100),
    decisionsPoints: Math.round(PURITY_WEIGHTS.decisions * decisionsRatio * 100),
    penaltyPoints: Math.round(penalty * 100),
    index: clamp(Math.round(raw * 100), 0, 100),
  };
}

/** ИНДЕКС ЧИСТОТЫ, 0–100%. */
export function purityIndex(params: PurityInput): number {
  return purityBreakdown(params).index;
}

/** Сводная статистика партии. */
export function computeTotals(
  state: Pick<GameState, 'score' | 'results'> & Partial<Pick<GameState, 'bestStreak'>>,
  scenarios: readonly Scenario[],
  elapsedMs: number,
): Totals {
  const results = state.results;
  const found = sum(results, (r) => r.found.length);
  const missed = sum(results, (r) => r.missed.length);
  const falsePositives = sum(results, (r) => r.falsePositives.length);
  const correctDecisions = results.filter((r) => r.decisionCorrect).length;
  const roundsPlayed = results.length;
  const timedOutRounds = results.filter((r) => r.decision === null).length;

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
    timedOutRounds,
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
    bestStreak: state.bestStreak ?? 0,
    hintsUsed: sum(results, (r) => r.hints),
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

export interface Rank {
  /** Нижняя граница индекса чистоты, с которой звание присваивается. */
  min: number;
  title: string;
  caption: string;
}

/** Звания от высшего к низшему: порядок важен для rankFor и nextRank. */
export const RANKS: readonly Rank[] = [
  { min: 85, title: 'КОМПЛАЕНС-ЭКСПЕРТ', caption: 'Вы видите риск там, где другие видят формальность.' },
  { min: 65, title: 'ВНИМАТЕЛЬНЫЙ СОТРУДНИК', caption: 'Хороший результат: большинство рисков остановлено вовремя.' },
  { min: 45, title: 'СТАЖЁР ПРОВЕРКИ', caption: 'Основное замечено, но часть сигналов прошла мимо.' },
  { min: 25, title: 'ФОРМАЛЬНЫЙ ПОДХОД', caption: 'Документы просмотрены, но не прочитаны.' },
  { min: 0, title: 'ЗОНА РИСКА', caption: 'Такую проверку легко обойти. Попробуйте ещё раз.' },
];

/** Итоговое звание по индексу чистоты. */
export function rankFor(index: number): Rank {
  return RANKS.find((rank) => index >= rank.min) ?? RANKS[RANKS.length - 1];
}

/**
 * Следующее звание и путь до него: чем занят прогресс-бар на протоколе.
 * На высшем звании возвращает null — расти больше некуда.
 */
export function nextRank(index: number): { rank: Rank; need: number; progress: number } | null {
  const higher = [...RANKS].reverse().find((rank) => rank.min > index);
  if (!higher) return null;
  const current = rankFor(index);
  const span = higher.min - current.min;
  return {
    rank: higher,
    need: higher.min - index,
    progress: span <= 0 ? 0 : clamp((index - current.min) / span, 0, 1),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sum<T>(items: readonly T[], get: (item: T) => number): number {
  return items.reduce((acc, item) => acc + get(item), 0);
}
