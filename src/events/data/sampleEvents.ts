import type { EventDefinition } from "../EventTypes";

// Стартовый набор событий для вертикального среза. Полный список из 20+
// событий (раздел 7 брифа) и цепочки (раздел 13) наполняются в Phase 6 —
// добавление события не требует изменений EventEngine.ts.
export const SAMPLE_EVENTS: EventDefinition[] = [
  {
    id: "abandoned_warehouse",
    title: "Заброшенный склад",
    description:
      "Экспедиция наткнулась на полуразрушенный склад. Внутри слышен подозрительный скрип перекрытий.",
    requirements: {},
    choices: [
      {
        id: "loot_fast",
        label: "Быстро забрать всё ценное и уйти",
        outcome: {
          resultText: "Удалось вынести немного металлолома, не задерживаясь.",
          resourceDelta: { scrap: 4 },
        },
      },
      {
        id: "search_deep",
        label: "Обыскать склад тщательно",
        outcome: {
          resultText: "Перекрытия обрушились частично — пришлось спасаться бегством с меньшей добычей.",
          resourceDelta: { scrap: 1 },
          shelterHealthDelta: -2,
        },
      },
    ],
  },
  {
    id: "mystery_signal",
    title: "Неизвестный сигнал",
    description: "Рация ловит слабый повторяющийся сигнал из руин неподалёку.",
    requirements: {},
    choices: [
      {
        id: "investigate",
        label: "Пойти на сигнал",
        outcome: {
          resultText: "Сигнал оказался старым маяком. Бесполезно, но безопасно.",
          setFlags: ["heard_signal_day1"],
        },
      },
      {
        id: "ignore",
        label: "Игнорировать и продолжить путь",
        outcome: {
          resultText: "Решили не рисковать и пошли дальше.",
        },
      },
    ],
  },
  {
    id: "wounded_stranger",
    title: "Раненый незнакомец",
    description: "На пути встречается раненый человек, просящий о помощи.",
    requirements: {},
    choices: [
      {
        id: "help",
        label: "Помочь и поделиться водой",
        outcome: {
          resultText: "Незнакомец рассказал о безопасном маршруте в благодарность.",
          resourceDelta: { water: -2 },
        },
      },
      {
        id: "leave",
        label: "Уйти дальше",
        outcome: {
          resultText: "Решили не рисковать и продолжили путь в одиночестве.",
        },
      },
    ],
  },
];
