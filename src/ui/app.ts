/**
 * Контроллер UI: связывает движок с экранами.
 * Экран перерисовывается только при смене фазы или номера ситуации,
 * значения HUD обновляются точечно на каждом кадре таймера.
 */
import { audio } from '../core/audio';
import { GameEngine } from '../core/engine';
import type { Decision, GameState } from '../core/types';
import { h } from './dom';
import { renderAbout } from './screens/about';
import { renderFinalScreen } from './screens/final';
import { renderGameScreen, type GameScreen } from './screens/game';
import { renderRoundResult } from './screens/roundResult';
import { renderStartScreen } from './screens/start';

export class App {
  private readonly engine: GameEngine;
  private readonly root: HTMLElement;
  private readonly floatLayer: HTMLElement;
  private gameScreen: GameScreen | null = null;
  private renderedKey = '';
  private lastSecond = -1;

  constructor(root: HTMLElement, engine = new GameEngine()) {
    this.root = root;
    this.engine = engine;
    this.floatLayer = h('div', 'float-layer');
    document.body.appendChild(this.floatLayer);
    this.engine.subscribe((state) => this.onState(state));
  }

  private onState(state: GameState): void {
    const key = `${state.phase}:${state.index}:${state.results.length}`;
    if (key !== this.renderedKey) {
      this.renderedKey = key;
      this.renderScreen(state);
    }

    if (state.phase === 'playing' && this.gameScreen) {
      const scenario = this.engine.getScenario();
      if (scenario) {
        this.gameScreen.update(state, scenario, this.engine.getScenarios().length);
        this.tickSound(state);
      }
    }
  }

  private tickSound(state: GameState): void {
    const second = Math.ceil(state.timeLeftMs / 1000);
    if (second !== this.lastSecond) {
      if (this.lastSecond !== -1 && second <= 10 && second > 0) audio.play('tick');
      this.lastSecond = second;
    }
  }

  private renderScreen(state: GameState): void {
    const next = this.buildScreen(state);
    this.root.replaceChildren(next);
    next.classList.add('screen-enter');
  }

  private buildScreen(state: GameState): HTMLElement {
    switch (state.phase) {
      case 'playing':
        return this.buildGame(state);
      case 'round-result':
        return this.buildRoundResult(state);
      case 'final':
        return this.buildFinal(state);
      case 'start':
      default:
        this.gameScreen = null;
        return renderStartScreen(this.engine.getScenarios().length, {
          onStart: () => {
            audio.unlock();
            audio.play('decision');
            this.lastSecond = -1;
            this.engine.start();
          },
          onAbout: () => this.openAbout(),
        });
    }
  }

  private buildGame(state: GameState): HTMLElement {
    const scenario = this.engine.getScenario();
    if (!scenario) return h('section', 'screen');

    const screen = renderGameScreen(scenario, this.engine.getScenarios().length, {
      onHotspot: (id, element) => {
        const outcome = this.engine.clickHotspot(id);
        if (!outcome.accepted) return;
        screen.markHotspot(id, outcome.suspicious);
        screen.showNote(outcome.note, outcome.suspicious);
        this.showFloat(element, outcome.points);
        audio.play(outcome.suspicious ? 'hit' : 'miss');
        if (!outcome.suspicious) this.shake(element);
      },
      onDecision: (decision: Decision) => {
        const correct = scenario.correctDecision === decision;
        audio.play(correct ? 'good' : 'bad');
        this.engine.decide(decision);
      },
      onToggleSound: () => {
        const enabled = audio.toggle();
        screen.setSoundIcon(enabled);
        if (enabled) audio.play('tick');
      },
    });

    this.gameScreen = screen;
    screen.setSoundIcon(audio.isEnabled());
    screen.update(state, scenario, this.engine.getScenarios().length);
    return screen.root;
  }

  private buildRoundResult(state: GameState): HTMLElement {
    this.gameScreen = null;
    const scenario = this.engine.getScenario();
    const result = state.lastResult;
    if (!scenario || !result) return h('section', 'screen');

    const isLast = state.index === this.engine.getScenarios().length - 1;
    return renderRoundResult(scenario, result, isLast, () => {
      audio.play('decision');
      this.engine.next();
    });
  }

  private buildFinal(state: GameState): HTMLElement {
    this.gameScreen = null;
    audio.play('final');
    return renderFinalScreen(this.engine.getTotals(), state, this.engine.getScenarios().length, {
      onRestart: () => {
        this.lastSecond = -1;
        this.engine.start();
      },
      onAbout: () => this.openAbout(),
    });
  }

  private openAbout(): void {
    const overlay = renderAbout(() => overlay.remove());
    document.body.appendChild(overlay);
  }

  /** Всплывающие очки рядом с местом клика. */
  private showFloat(element: HTMLElement, points: number): void {
    const rect = element.getBoundingClientRect();
    const node = h('span', `float ${points >= 0 ? 'float--plus' : 'float--minus'}`);
    node.textContent = `${points > 0 ? '+' : ''}${points}`;
    node.style.left = `${rect.left + rect.width / 2}px`;
    node.style.top = `${rect.top}px`;
    this.floatLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 900);
  }

  private shake(element: HTMLElement): void {
    element.classList.remove('shake');
    void element.offsetWidth;
    element.classList.add('shake');
  }
}
