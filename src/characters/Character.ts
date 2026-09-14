// Раздел 10-11 брифа: персонажи как профили, а не юниты.
export type CharacterStatus = "idle" | "expedition" | "injured" | "dead";

export interface CharacterStats {
  health: number; // 0-100
  skill: number; // 0-100
  luck: number; // 0-100
  morale: number; // 0-100
}

export interface Character {
  id: string;
  name: string;
  profession: string;
  bio: string;
  stats: CharacterStats;
  status: CharacterStatus;
  relationshipToPlayer: number; // -100..100, меняется от событий
  availableFromDay: number; // для персонажей, отправленных в экспедицию
}
