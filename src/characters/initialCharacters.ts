import type { Character } from "./Character";

// 5 стартовых персонажей для MVP (раздел 7 брифа).
// Контент сознательно краткий на этапе вертикального среза — полные био и
// раскрытие предыстории через события добавляются в Phase 4/6.
export function createInitialCharacters(): Character[] {
  const base = (
    id: string,
    name: string,
    profession: string,
    bio: string,
    stats: Character["stats"],
  ): Character => ({
    id,
    name,
    profession,
    bio,
    stats,
    status: "idle",
    relationshipToPlayer: 0,
    availableFromDay: 1,
  });

  return [
    base("alexey", "Алексей", "Инженер", "Хорошо чинит технику, плохо переносит стресс.", {
      health: 80,
      skill: 70,
      luck: 40,
      morale: 60,
    }),
    base("marina", "Марина", "Врач", "Держится спокойно в любой ситуации.", {
      health: 70,
      skill: 65,
      luck: 50,
      morale: 70,
    }),
    base("oleg", "Олег", "Разведчик", "Быстрый, но безрассудный.", {
      health: 65,
      skill: 55,
      luck: 65,
      morale: 55,
    }),
    base("irina", "Ирина", "Механик", "Умеет находить ресурсы там, где их не видно.", {
      health: 75,
      skill: 60,
      luck: 45,
      morale: 65,
    }),
    base("viktor", "Виктор", "Охранник", "Надёжен, но скрытен о своём прошлом.", {
      health: 90,
      skill: 50,
      luck: 35,
      morale: 50,
    }),
  ];
}
