/**
 * Игровой движок: хранит состояние, считает время и применяет правила.
 * Ничего не знает ни о DOM, ни о конкретных ситуациях — UI подписывается
 * на изменения через subscribe().
 */
import { scenarios as defaultScenarios } from '../data/scenarios';
import { GAME_DURATION_MS, SCORING, clickPoints, computeTotals, resolveRound } from './rules';
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
    return computeTotals(this.state, this.scenarios, GAME_DURATION_MS - this.state.timeLeftMs);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Старт новой партии. */
  start(): void {
    this.state = { ...createInitialState(), phase: 'playing' };
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
      results: [...this.state.results, result],
      lastResult: result,
    };
    this.emit();
  }

  /** Переход к следующей ситуации с экрана разбора. */
  next(): void {
    if (this.state.phase !== 'round-result') return;
    const nextIndex = this.state.index + 1;

    if (nextIndex >= this.scenarios.length) {
      this.state = { ...this.state, phase: 'final', finishReason: 'complete' };
      this.emit();
      return;
    }

    this.state = {
      ...this.state,
      phase: 'playing',
      index: nextIndex,
      clicked: [],
      lastResult: null,
    };
    this.startTimer();
    this.emit();
  }

  /** Принудительное завершение партии (используется при выходе времени). */
  private finishByTimeout(): void {
    this.stopTimer();
    this.state = { ...this.state, phase: 'final', timeLeftMs: 0, finishReason: 'timeout' };
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
      this.state = { ...this.state, timeLeftMs };

      if (timeLeftMs <= 0) {
        this.finishByTimeout();
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
    timeLeftMs: GAME_DURATION_MS,
    clicked: [],
    results: [],
    lastResult: null,
    finishReason: null,
  };
}
