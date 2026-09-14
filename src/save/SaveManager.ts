import { createInitialState, SAVE_SCHEMA_VERSION, type GameState } from "../game/GameState";

const SAVE_KEY = "last_shelter_save_v1";

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    // localStorage может быть недоступен (приватный режим, квота) —
    // не роняем игру, просто теряем автосохранение.
    console.warn("Не удалось сохранить игру:", err);
  }
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();

    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!isValidSave(parsed)) {
      console.warn("Повреждённое сохранение, начинаем новую игру.");
      return createInitialState();
    }

    // Точка расширения для миграций схемы (Phase 9):
    // if (parsed.schemaVersion < SAVE_SCHEMA_VERSION) parsed = migrate(parsed);

    return parsed as GameState;
  } catch (err) {
    console.warn("Ошибка чтения сохранения, начинаем новую игру:", err);
    return createInitialState();
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // игнорируем — не критично
  }
}

function isValidSave(data: Partial<GameState>): data is GameState {
  return (
    typeof data.schemaVersion === "number" &&
    data.schemaVersion === SAVE_SCHEMA_VERSION &&
    typeof data.day === "number" &&
    typeof data.resources === "object" &&
    Array.isArray(data.characters)
  );
}
