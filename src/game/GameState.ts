import { createInitialResources, type Resources } from "../player/Resources";
import { createInitialCharacters } from "../characters/initialCharacters";
import type { Character } from "../characters/Character";
import { createInitialBuildings } from "../shelter/Building";
import type { Building } from "../shelter/Building";

export interface ActiveExpedition {
  characterId: string;
  durationDays: number;
  returnsOnDay: number;
}

export interface GameState {
  schemaVersion: number;
  day: number;
  shelterHealth: number; // 0-100, поражение при 0
  resources: Resources;
  buildings: Building[];
  characters: Character[];
  activeExpeditions: ActiveExpedition[];
  flags: Record<string, boolean | number>;
  isGameOver: boolean;
}

export const SAVE_SCHEMA_VERSION = 1;

export function createInitialState(): GameState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    day: 1,
    shelterHealth: 100,
    resources: createInitialResources(),
    buildings: createInitialBuildings(),
    characters: createInitialCharacters(),
    activeExpeditions: [],
    flags: {},
    isGameOver: false,
  };
}
