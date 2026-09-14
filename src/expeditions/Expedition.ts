import type { GameState } from "../game/GameState";

// Раздел 16 брифа: три уровня риск/награда. Множители — черновые,
// балансировка происходит в Phase 5/7.
export type ExpeditionDuration = 1 | 3 | 7;

export interface ExpeditionOption {
  durationDays: ExpeditionDuration;
  label: string;
  rewardScrapRange: [number, number];
  riskLevel: "low" | "medium" | "high";
}

export const EXPEDITION_OPTIONS: ExpeditionOption[] = [
  { durationDays: 1, label: "Безопасная", rewardScrapRange: [2, 5], riskLevel: "low" },
  { durationDays: 3, label: "Опасная", rewardScrapRange: [6, 15], riskLevel: "medium" },
  { durationDays: 7, label: "Безумная", rewardScrapRange: [15, 40], riskLevel: "high" },
];

export function sendExpedition(
  state: GameState,
  characterId: string,
  durationDays: ExpeditionDuration,
): GameState {
  const character = state.characters.find((c) => c.id === characterId);
  if (!character || character.status !== "idle") return state;

  const characters = state.characters.map((c) =>
    c.id === characterId ? { ...c, status: "expedition" as const } : c,
  );

  return {
    ...state,
    characters,
    activeExpeditions: [
      ...state.activeExpeditions,
      { characterId, durationDays, returnsOnDay: state.day + durationDays },
    ],
  };
}
