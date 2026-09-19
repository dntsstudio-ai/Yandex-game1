/**
 * Контроллер UI: связывает движок с экранами, музыкой и звуками.
 * Экран перерисовывается только при смене фазы или номера ситуации,
 * значения HUD обновляются точечно на каждом кадре таймера.
 */
import { GameEngine } from '../core/engine';
import { settings } from '../core/settings';
import { setMasterVolume } from '../core/sound/context';
import { music } from '../core/sound/music';
import { sfx } from '../core/sound/sfx';
import type { Decision, GameState } from '../core/types';
import { h } from './dom';
import { renderAbout } from './screens/about';
import { renderFinalScreen } from './screens/final';
import { renderGameScreen, type GameScreen } from './screens/game';
import { renderRoundResult } from './screens/roundResult';
import { renderSettings } from './screens/settings';
import { renderStartScreen } from './screens/start';
import type { MenuScene } from './menuScene';

export class App {
  private readonly engine: GameEngine;
  private readonly root: HTMLElement;
  private readonly floatLayer: HTMLElement;
  private gameScreen: GameScreen | null = null;
  private renderedKey = '';
  private lastSecond = -1;
  private menuScene: MenuScene | null = null;

  constructor(root: HTMLElement, engine = new GameEngine()) {
    this.root = root;
    this.engine = engine;
    this.floatLayer = h('div', 'float-layer');
    document.body.appendChild(this.floatLayer);

    setMasterVolume(settings.get().volume);
    this.engine.subscribe((state) => this.onState(state));
  }

  private onState(state: GameState): void {
    const key = `${state.phase}:${state.index}:${state.results.length}`;
    if (key !== this.renderedKey) {
      this.renderedKey = key;
      this.renderScreen(state);
      music.duck(state.phase !== 'playing');
    }

    if (state.phase === 'playing' && this.gameScreen) {
      const scenario = this.engine.getScenario();
      if (scenario) {
        this.gameScreen.update(state, scenario, this.engine.getScenarios().length);
        this.tickSound(state);
      }
    }
  }

  /** Тиканье последних секунд документа. */
  private tickSound(state: GameState): void {
    const second = Math.ceil(state.timeLeftMs / 1000);
    if (second !== this.lastSecond) {
      if (this.lastSecond !== -1 && second <= 5 && second > 0) sfx.play('tick');
      this.lastSecond = second;
    }
  }

  private renderScreen(state: GameState): void {
    const next = this.buildScreen(state);
    this.root.replaceChildren(next);
    next.classList.add('screen-enter');
  }

  private buildScreen(state: GameState): HTMLElement {
    // сцена меню живёт только на стартовом экране
    if (state.phase !== 'start' && this.menuScene) {
      this.menuScene.destroy();
      this.menuScene = null;
    }

    switch (state.phase) {
      case 'playing':
        return this.buildGame(state);
      case 'round-result':
        return this.buildRoundResult(state);
      case 'final':
        return this.buildFinal();
      case 'start':
      default: {
        this.gameScreen = null;
        const start = renderStartScreen(this.engine.getScenarios().length, {
          onStart: () => this.beginGame(),
          onAbout: () => this.openAbout(),
          onSettings: () => this.openSettings(),
        });
        this.menuScene = start.scene;
        return start.root;
      }
    }
  }

  /** Первый запуск: разблокируем звук и включаем музыку. */
  private beginGame(): void {
    sfx.unlock();
    sfx.play('click');
    void music.start();
    this.lastSecond = -1;
    this.engine.start();
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
        sfx.play(outcome.suspicious ? 'hit' : 'miss');
        if (!outcome.suspicious) this.shake(element);
      },
      onDecision: (decision: Decision) => {
        const correct = scenario.correctDecision === decision;
        sfx.play('stamp');
        sfx.play(correct ? 'good' : 'bad');
        this.engine.decide(decision);
      },
      onSettings: () => this.openSettings(),
    });

    this.gameScreen = screen;
    screen.update(state, scenario, this.engine.getScenarios().length);
    sfx.play('paper');
    this.lastSecond = -1;
    return screen.root;
  }

  private buildRoundResult(state: GameState): HTMLElement {
    this.gameScreen = null;
    const scenario = this.engine.getScenario();
    const result = state.lastResult;
    if (!scenario || !result) return h('section', 'screen');

    if (result.decision === null) sfx.play('timeout');

    const isLast = state.index === this.engine.getScenarios().length - 1;
    return renderRoundResult(scenario, result, isLast, () => {
      sfx.play('click');
      this.engine.next();
    });
  }

  private buildFinal(): HTMLElement {
    this.gameScreen = null;
    sfx.play('final');
    return renderFinalScreen(this.engine.getTotals(), this.engine.getScenarios().length, {
      onRestart: () => {
        sfx.play('click');
        void music.start();
        this.lastSecond = -1;
        this.engine.start();
      },
      onAbout: () => this.openAbout(),
      onSettings: () => this.openSettings(),
      onCount: () => sfx.play('count'),
    });
  }

  private openAbout(): void {
    sfx.play('click');
    const overlay = renderAbout(() => overlay.remove());
    document.body.appendChild(overlay);
  }

  private openSettings(): void {
    sfx.play('click');
    const overlay = renderSettings(
      () => overlay.remove(),
      (next) => {
        setMasterVolume(next.volume);
        music.setVolume(next.volume);
        music.setEnabled(next.music);
        if (next.sound) sfx.play('click');
      },
    );
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
