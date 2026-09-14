// Простая шина событий для связи модулей без прямых зависимостей.
// Не путать с игровыми "событиями" (events/) — это техническая шина модуль-модуль.

type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private listeners: { [K in keyof Events]?: Listener<Events[K]>[] } = {};

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const list = this.listeners[event] ?? [];
    list.push(listener);
    this.listeners[event] = list;
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    const list = this.listeners[event];
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as Listener<Events[K]>[];
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.listeners[event];
    if (!list) return;
    // Копия на случай, если слушатель отпишется во время вызова.
    [...list].forEach((listener) => listener(payload));
  }
}

export interface AppEvents {
  stateChanged: void;
  screenChanged: string;
  gameOver: { day: number; reason: string };
}

export const appBus = new EventBus<AppEvents>();
