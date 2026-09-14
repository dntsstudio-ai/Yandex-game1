import { createInitialState, type GameState } from "../game/GameState";
import { advanceDay } from "../game/GameLoop";
import { sendExpedition, type ExpeditionDuration } from "../expeditions/Expedition";
import { pickEventForExpedition, applyChoice } from "../events/EventEngine";
import type { EventChoice, EventDefinition } from "../events/EventTypes";
import { loadGame, saveGame, clearSave } from "../save/SaveManager";
import { appBus } from "../game/EventBus";
import type { ScreenName } from "./Router";
import { renderShelterScreen } from "./screens/ShelterScreen";
import { renderExpeditionScreen } from "./screens/ExpeditionScreen";
import { renderEventScreen } from "./screens/EventScreen";
import { renderResultScreen } from "./screens/ResultScreen";
import { renderGameOverScreen } from "./screens/GameOverScreen";

// Координатор экранов вертикального среза (Phase 1). Держит текущее
// состояние партии и временные данные перехода между экранами
// (выбранный персонаж, текущее событие, текст результата).
// UI-модули не мутируют GameState напрямую — только через методы контроллера,
// которые вызывают функции из game/expeditions/events (см. ARCHITECTURE.md, раздел 3).
export class AppController {
  private state: GameState;
  private screen: ScreenName = "shelter";
  private root: HTMLElement;

  private selectedCharacterId: string | null = null;
  private pendingEvent: EventDefinition | null = null;
  private lastResultText = "";

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = loadGame();
  }

  start(): void {
    this.render();
  }

  getState(): GameState {
    return this.state;
  }

  goToExpeditionSetup(characterId: string): void {
    this.selectedCharacterId = characterId;
    this.screen = "expedition";
    this.render();
  }

  backToShelter(): void {
    this.screen = "shelter";
    this.selectedCharacterId = null;
    this.render();
  }

  confirmExpedition(durationDays: ExpeditionDuration): void {
    if (!this.selectedCharacterId) return;

    let next = sendExpedition(this.state, this.selectedCharacterId, durationDays);
    for (let i = 0; i < durationDays; i++) {
      next = advanceDay(next);
      if (next.isGameOver) break;
    }
    this.state = next;

    if (this.state.isGameOver) {
      this.screen = "gameover";
      this.render();
      return;
    }

    this.pendingEvent = pickEventForExpedition(this.state) ?? null;
    this.screen = this.pendingEvent ? "event" : "result";
    if (!this.pendingEvent) {
      this.lastResultText = "Экспедиция прошла без происшествий.";
    }
    this.render();
  }

  resolveEventChoice(choice: EventChoice): void {
    this.state = applyChoice(this.state, choice);
    this.lastResultText = choice.outcome.resultText;
    this.pendingEvent = null;

    if (this.state.shelterHealth <= 0) {
      this.state = { ...this.state, isGameOver: true };
      this.screen = "gameover";
      this.render();
      return;
    }

    this.screen = "result";
    this.render();
  }

  finishResult(): void {
    saveGame(this.state);
    this.screen = "shelter";
    this.render();
  }

  restartGame(): void {
    clearSave();
    this.state = createInitialState();
    this.screen = "shelter";
    this.render();
  }

  private render(): void {
    this.root.innerHTML = "";
    appBus.emit("screenChanged", this.screen);

    switch (this.screen) {
      case "shelter":
        renderShelterScreen(this.root, this);
        break;
      case "expedition":
        renderExpeditionScreen(this.root, this, this.selectedCharacterId!);
        break;
      case "event":
        if (this.pendingEvent) renderEventScreen(this.root, this, this.pendingEvent);
        break;
      case "result":
        renderResultScreen(this.root, this, this.lastResultText);
        break;
      case "gameover":
        renderGameOverScreen(this.root, this, this.state.day);
        break;
    }
  }
}
