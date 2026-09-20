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
import { renderFinalScreen, type FinalScreen } from './screens/final';
import { renderGameScreen, type GameScreen } from './screens/game';
import { renderRoundResult } from './screens/roundResult';
import { renderSettings } from './screens/settings';
import { renderStartScreen } from './screens/start';
import type { MenuScene } from './menuScene';
import { setupViewport } from './viewport';

export class App {
  private readonly engine: GameEngine;
  private readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly floatLayer: HTMLElement;
  private gameScreen: GameScreen | null = null;
  private renderedKey = '';
  private lastSecond = -1;
  private menuScene: MenuScene | null = null;
  private finalScreen: FinalScreen | null = null;
  private entering = false;

  constructor(host: HTMLElement, engine = new GameEngine()) {
    // Сцена фиксированного размера: в альбомном режиме телефона она
    // масштабируется целиком, поэтому всё внутри живёт в её координатах.
    const stage = h('div', 'app-stage');
    host.replaceChildren(stage);

    this.host = host;
    this.root = stage;
    this.engine = engine;
    this.floatLayer = h('div', 'float-layer');
    stage.appendChild(this.floatLayer);
    setupViewport(stage, stage);

    setMasterVolume(settings.get().volume);
    this.engine.subscribe((state) => this.onState(state));
  }

  private onState(state: GameState): void {
    document.body.classList.toggle('is-final', state.phase === 'final');

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
    // слой всплывающих очков и подсказки остаются на месте
    for (const node of Array.from(this.root.children)) {
      if (node !== this.floatLayer && !node.classList.contains('rotate-hint')) node.remove();
    }
    this.root.prepend(next);
    next.classList.add('screen-enter');
  }

  private buildScreen(state: GameState): HTMLElement {
    // сцена меню живёт только на стартовом экране
    if (state.phase !== 'start' && this.menuScene) {
      this.menuScene.destroy();
      this.menuScene = null;
    }

    // итоговый экран держит таймеры и анимацию пыли — останавливаем их
    if (state.phase !== 'final' && this.finalScreen) {
      this.finalScreen.destroy();
      this.finalScreen = null;
    }

    switch (state.phase) {
      case 'playing':
        return this.buildGame(state);
      case 'round-result':
        return this.buildRoundResult(state);
      case 'final':
        return this.buildFinal(state);
      case 'start':
      default: {
        this.gameScreen = null;
        const start = renderStartScreen(this.engine.getScenarios().length, {
          onStart: () => this.beginGame(),
          onAbout: () => this.openAbout(),
          onSettings: () => this.openSettings(),
        });
        this.menuScene = start.scene;
        this.host.appendChild(start.scene.root);
        return start.root;
      }
    }
  }

  /** Первый запуск: разблокируем звук, включаем музыку и «входим в здание». */
  private beginGame(): void {
    if (this.entering) return;
    this.entering = true;

    sfx.unlock();
    sfx.play('click');
    void music.start();
    this.lastSecond = -1;

    const scene = this.menuScene;
    if (!scene) {
      this.entering = false;
      this.engine.start();
      return;
    }

    void scene.playExit().then(() => {
      this.entering = false;
      // экран уже затемнён сценой — партия начинается «внутри здания»
      this.engine.start();
      this.fadeFromBlack();
    });
  }

  /** Плавное проявление игрового экрана после затемнения. */
  private fadeFromBlack(): void {
    const veil = h('div', 'blackout');
    this.root.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add('is-clearing'));
    window.setTimeout(() => veil.remove(), 900);
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

  private buildFinal(state: GameState): HTMLElement {
    this.gameScreen = null;
    sfx.play('final');

    const screen = renderFinalScreen(
      this.engine.getTotals(),
      state.results,
      this.engine.getScenarios(),
      {
        onRestart: () => {
          sfx.play('click');
          void music.start();
          this.lastSecond = -1;
          this.engine.start();
          this.fadeFromBlack();
        },
        onAbout: () => this.openAbout(),
        onSettings: () => this.openSettings(),
        onCount: () => sfx.play('count'),
        onStamp: () => sfx.play('stamp'),
      },
    );

    this.finalScreen = screen;
    return screen.root;
  }

  private openAbout(): void {
    sfx.play('click');
    const overlay = renderAbout(() => overlay.remove());
    this.root.appendChild(overlay);
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
    this.root.appendChild(overlay);
  }

  /** Всплывающие очки рядом с местом клика. */
  private showFloat(element: HTMLElement, points: number): void {
    const rect = element.getBoundingClientRect();
    const layer = this.floatLayer.getBoundingClientRect();
    // сцена может быть уменьшена — переводим экранные координаты в её систему
    const scale = layer.width / Math.max(1, this.floatLayer.offsetWidth);

    const node = h('span', `float ${points >= 0 ? 'float--plus' : 'float--minus'}`);
    node.textContent = `${points > 0 ? '+' : ''}${points}`;
    node.style.left = `${(rect.left + rect.width / 2 - layer.left) / scale}px`;
    node.style.top = `${(rect.top - layer.top) / scale}px`;
    this.floatLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 900);
  }

  private shake(element: HTMLElement): void {
    element.classList.remove('shake');
    void element.offsetWidth;
    element.classList.add('shake');
  }
}
