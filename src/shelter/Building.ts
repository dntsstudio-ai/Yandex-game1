// Раздел 5 брифа: минимум построек для MVP.
export type BuildingKind = "storage" | "generator" | "workshop";

export interface Building {
  kind: BuildingKind;
  name: string;
  level: number;
}

export function createInitialBuildings(): Building[] {
  return [
    { kind: "storage", name: "Склад", level: 1 },
    { kind: "generator", name: "Генератор", level: 1 },
    { kind: "workshop", name: "Мастерская", level: 1 },
  ];
}
