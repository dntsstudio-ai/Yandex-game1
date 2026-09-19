/**
 * Игровой движок: хранит состояние, считает время и применяет правила.
 * Ничего не знает ни о DOM, ни о конкретных ситуациях — UI подписывается
 * на изменения через subscribe().
 *
 * Таймер отсчитывается для каждого документа отдельно и сбрасывается
 * в начале следующего раунда.
 */
import { scenarios as defaultScenarios } from '../data/scenarios';
import {
  ROUND_DURATION_MS,
  SCORING,
  clickPoints,
  computeTotals,
  resolveRound,
  roundDuration,
} from './rules';
import type { Decision, GameState, Scenario, Totals } from './types';

type Listener = (state: GameState) => void;

/** Событие клика по элементу — нужно UI для подсветки и звука. */
export interface ClickOutcome {
  accepted: boolean;
  suspicious: boolean;
  points: number;
  note: string;
}

export class GameEngine {
  private state: GameState = createInitialState();
  private listeners = new Set<Listener>();
  private tickHandle: number | null = null;
  private lastTickAt = 0;
  private readonly scenarios: readonly Scenario[];

  constructor(scenarios: readonly Scenario[] = defaultScenarios) {
    if (scenarios.length === 0) throw new Error('Нужна хотя бы одна игровая ситуация');
    this.scenarios = scenarios;
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  getScenarios(): readonly Scenario[] {
    return this.scenarios;
  }

  /** Текущая ситуация или null, если партия не идёт. */
  getScenario(): Scenario | null {
    return this.scenarios[this.state.index] ?? null;
  }

  getTotals(): Totals {
    return computeTotals(this.state, this.scenarios, this.state.elapsedMs);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Старт новой партии. */
  start(): void {
    const duration = roundDuration(this.scenarios[0]);
    this.state = {
      ...createInitialState(),
      phase: 'playing',
      timeLeftMs: duration,
      roundDurationMs: duration,
    };
    this.startTimer();
    this.emit();
  }

  /** Возврат на стартовый экран. */
  reset(): void {
    this.stopTimer();
    this.state = createInitialState();
    this.emit();
  }

  /** Клик по интерактивному элементу документа. */
  clickHotspot(id: string): ClickOutcome {
    const scenario = this.getScenario();
    const idle: ClickOutcome = { accepted: false, suspicious: false, points: 0, note: '' };
    if (!scenario || this.state.phase !== 'playing') return idle;
    if (this.state.clicked.includes(id)) return idle;

    const hotspot = scenario.hotspots.find((h) => h.id === id);
    if (!hotspot) return idle;

    const points = clickPoints(scenario, id);
    this.state = {
      ...this.state,
      clicked: [...this.state.clicked, id],
      score: this.state.score + points,
    };
    this.emit();

    return { accepted: true, suspicious: hotspot.suspicious, points, note: hotspot.note };
  }

  /** Решение по документу: «пропустить» или «остановить». */
  decide(decision: Decision): void {
    this.finishRound(decision);
  }

  /** Переход к следующей ситуации с экрана разбора. */
  next(): void {
    if (this.state.phase !== 'round-result') return;
    const nextIndex = this.state.index + 1;
    const nextScenario = this.scenarios[nextIndex];

    if (!nextScenario) {
      this.state = { ...this.state, phase: 'final', finishReason: 'complete' };
      this.emit();
      return;
    }

    const duration = roundDuration(nextScenario);
    this.state = {
      ...this.state,
      phase: 'playing',
      index: nextIndex,
      clicked: [],
      lastResult: null,
      // таймер сбрасывается на каждом документе
      timeLeftMs: duration,
      roundDurationMs: duration,
    };
    this.startTimer();
    this.emit();
  }

  /** Завершение раунда: решением игрока или по истечении времени (decision = null). */
  private finishRound(decision: Decision | null): void {
    const scenario = this.getScenario();
    if (!scenario || this.state.phase !== 'playing') return;

    const result = resolveRound(scenario, this.state.clicked, decision);
    // Очки за клики уже начислены в момент нажатия: начисляем только остаток
    // (бонус или штраф за решение и бонус за безупречный раунд).
    const alreadyScored =
      result.found.length * SCORING.hit + result.falsePositives.length * SCORING.falsePositive;

    this.stopTimer();
    this.state = {
      ...this.state,
      phase: 'round-result',
      score: this.state.score + (result.points - alreadyScored),
      timeLeftMs: decision === null ? 0 : this.state.timeLeftMs,
      results: [...this.state.results, result],
      lastResult: result,
    };
    this.emit();
  }

  private startTimer(): void {
    this.stopTimer();
    if (typeof window === 'undefined') return;
    this.lastTickAt = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - this.lastTickAt;
      this.lastTickAt = now;
      const timeLeftMs = Math.max(0, this.state.timeLeftMs - delta);
      this.state = {
        ...this.state,
        timeLeftMs,
        elapsedMs: this.state.elapsedMs + delta,
      };

      if (timeLeftMs <= 0) {
        this.finishRound(null);
        return;
      }
      this.emit();
      this.tickHandle = window.requestAnimationFrame(tick);
    };
    this.tickHandle = window.requestAnimationFrame(tick);
  }

  private stopTimer(): void {
    if (this.tickHandle !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.tickHandle);
    }
    this.tickHandle = null;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

export function createInitialState(): GameState {
  return {
    phase: 'start',
    index: 0,
    score: 0,
    timeLeftMs: ROUND_DURATION_MS,
    roundDurationMs: ROUND_DURATION_MS,
    elapsedMs: 0,
    clicked: [],
    results: [],
    lastResult: null,
    finishReason: null,
  };
}
