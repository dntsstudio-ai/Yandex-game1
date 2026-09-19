/**
 * Базовые типы игры «КРАСНЫЙ ФЛАГ».
 * Здесь нет логики — только контракты данных, на которые опираются
 * движок, UI и набор игровых ситуаций.
 */

/** Решение, которое игрок принимает по документу. */
export type Decision = 'pass' | 'stop';

/** Тип документа — влияет только на оформление карточки. */
export type DocKind = 'email' | 'chat' | 'contract' | 'memo' | 'invoice' | 'form';

/** Интерактивный элемент документа: кликабельный фрагмент. */
export interface Hotspot {
  /** Уникальный в пределах ситуации идентификатор. */
  id: string;
  /** Видимый текст фрагмента. */
  text: string;
  /** Является ли фрагмент признаком коррупционного риска. */
  suspicious: boolean;
  /** Короткое пояснение: почему это риск или почему это норма. */
  note: string;
}

/** Строка документа. Текст может содержать маркеры {{id}} — места вставки хотспотов. */
export interface DocLine {
  /** Оформление строки. */
  kind?: 'text' | 'meta' | 'quote' | 'bullet' | 'signature' | 'amount';
  /** Текст с маркерами хотспотов вида {{hotspot-id}}. */
  text: string;
  /** Автор реплики — только для чатов. */
  author?: 'them' | 'me';
}

/** Блок документа: шапка-таблица, абзацы, реплики чата или строка суммы. */
export interface DocBlock {
  type: 'fields' | 'lines' | 'chat' | 'table';
  /** Заголовок блока (необязателен). */
  caption?: string;
  /** Пары «поле — значение» для блока fields и строки для table. */
  rows?: Array<{ label: string; value: string }>;
  /** Строки для блоков lines и chat. */
  lines?: DocLine[];
}

/** Игровая ситуация — самодостаточная единица контента. */
export interface Scenario {
  id: string;
  /** Заголовок ситуации. */
  title: string;
  /** Тип документа. */
  kind: DocKind;
  /** Короткая подпись под заголовком (отправитель, номер договора и т.п.). */
  source: string;
  /** Подсказка-задание для игрока. */
  brief: string;
  /** Содержимое документа. */
  blocks: DocBlock[];
  /** Все интерактивные элементы ситуации. */
  hotspots: Hotspot[];
  /** Верное решение по документу. */
  correctDecision: Decision;
  /** Разбор после раунда. */
  explanation: string;
}

/** Итог одного раунда. */
export interface RoundResult {
  scenarioId: string;
  /** Найденные признаки риска. */
  found: string[];
  /** Пропущенные признаки риска. */
  missed: string[];
  /** Ложные срабатывания — клики по нормальным элементам. */
  falsePositives: string[];
  decision: Decision;
  decisionCorrect: boolean;
  /** Очки, начисленные за раунд (с учётом штрафов). */
  points: number;
}

/** Агрегированная статистика партии. */
export interface Totals {
  score: number;
  found: number;
  missed: number;
  falsePositives: number;
  correctDecisions: number;
  roundsPlayed: number;
  totalFlags: number;
  elapsedMs: number;
  purityIndex: number;
  accuracy: number;
}

/** Экран, который показывает UI. */
export type Phase = 'start' | 'playing' | 'round-result' | 'final';

/** Полное состояние игры. */
export interface GameState {
  phase: Phase;
  /** Индекс текущей ситуации. */
  index: number;
  score: number;
  /** Оставшееся время в миллисекундах. */
  timeLeftMs: number;
  /** Кликнутые в текущем раунде элементы. */
  clicked: string[];
  /** Результаты завершённых раундов. */
  results: RoundResult[];
  /** Результат последнего раунда — для экрана разбора. */
  lastResult: RoundResult | null;
  /** Причина завершения партии. */
  finishReason: 'complete' | 'timeout' | null;
}
