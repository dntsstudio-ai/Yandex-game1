import type { GameState } from "../game/GameState";
import type { EventChoice, EventDefinition } from "./EventTypes";
import { meetsRequirements } from "./EventTypes";
import { SAMPLE_EVENTS } from "./data/sampleEvents";
import { pickRandom } from "../utils/random";
import { clampResources } from "../player/Resources";

export function pickEventForExpedition(state: GameState): EventDefinition | undefined {
  const eligible = SAMPLE_EVENTS.filter((e) => meetsRequirements(state, e.requirements));
  return pickRandom(eligible);
}

export function applyChoice(state: GameState, choice: EventChoice): GameState {
  const { outcome } = choice;
  const resources = clampResources({
    food: state.resources.food + (outcome.resourceDelta?.food ?? 0),
    water: state.resources.water + (outcome.resourceDelta?.water ?? 0),
    energy: state.resources.energy + (outcome.resourceDelta?.energy ?? 0),
    scrap: state.resources.scrap + (outcome.resourceDelta?.scrap ?? 0),
  });

  const flags = { ...state.flags };
  for (const flag of outcome.setFlags ?? []) {
    flags[flag] = true;
  }

  return {
    ...state,
    resources,
    shelterHealth: Math.min(
      100,
      Math.max(0, state.shelterHealth + (outcome.shelterHealthDelta ?? 0)),
    ),
    flags,
  };
}
