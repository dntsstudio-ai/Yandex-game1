import type { GameState } from "../game/GameState";

// Раздел 12 брифа: событие — структурированные данные, не код.
export interface EventRequirements {
  minDay?: number;
  requiredFlags?: string[];
}

export interface EventOutcome {
  resultText: string;
  resourceDelta?: Partial<Record<"food" | "water" | "energy" | "scrap", number>>;
  shelterHealthDelta?: number;
  setFlags?: string[];
}

export interface EventChoice {
  id: string;
  label: string;
  outcome: EventOutcome;
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  requirements: EventRequirements;
  choices: EventChoice[];
}

export function meetsRequirements(state: GameState, requirements: EventRequirements): boolean {
  if (requirements.minDay !== undefined && state.day < requirements.minDay) return false;
  if (requirements.requiredFlags) {
    for (const flag of requirements.requiredFlags) {
      if (!state.flags[flag]) return false;
    }
  }
  return true;
}
