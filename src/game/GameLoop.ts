import type { GameState } from "./GameState";
import { clampResources } from "../player/Resources";
import { ECONOMY_CONFIG } from "../economy/config";
import { appBus } from "./EventBus";

// Минимальная реализация цикла дня (Phase 2 брифа). Формулы — черновые,
// уточняются в Phase 7 (экономика) на основе GAME_BALANCE.md.
export function advanceDay(state: GameState): GameState {
  const charactersAtHome = state.characters.filter((c) => c.status !== "dead");
  const foodNeeded = charactersAtHome.length * ECONOMY_CONFIG.foodPerCharacterPerDay;
  const waterNeeded = charactersAtHome.length * ECONOMY_CONFIG.waterPerCharacterPerDay;

  const nextResources = clampResources({
    food: state.resources.food - foodNeeded,
    water: state.resources.water - waterNeeded,
    energy: state.resources.energy - ECONOMY_CONFIG.energyUpkeepPerDay,
    scrap: state.resources.scrap,
  });

  const starving = state.resources.food < foodNeeded || state.resources.water < waterNeeded;
  const shelterHealth = starving
    ? Math.max(0, state.shelterHealth - ECONOMY_CONFIG.shelterDamageOnStarvation)
    : state.shelterHealth;

  // Возврат персонажей из экспедиций, чей срок истёк.
  const nextDay = state.day + 1;
  const stillActive = state.activeExpeditions.filter((e) => e.returnsOnDay > nextDay);
  const returned = state.activeExpeditions.filter((e) => e.returnsOnDay <= nextDay);
  const characters = state.characters.map((c) => {
    const isReturning = returned.some((e) => e.characterId === c.id);
    return isReturning ? { ...c, status: "idle" as const } : c;
  });

  const nextState: GameState = {
    ...state,
    day: nextDay,
    resources: nextResources,
    shelterHealth,
    activeExpeditions: stillActive,
    characters,
    isGameOver: shelterHealth <= 0,
  };

  appBus.emit("stateChanged", undefined);
  if (nextState.isGameOver) {
    appBus.emit("gameOver", { day: nextState.day, reason: "shelter_destroyed" });
  }

  return nextState;
}
