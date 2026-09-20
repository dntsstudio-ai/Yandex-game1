/**
 * Пользовательские настройки: музыка, звуки, громкость.
 * Хранятся в localStorage, чтобы выбор игрока сохранялся между партиями.
 */
export interface Settings {
  music: boolean;
  sound: boolean;
  /** Озвучка реплик инспектора: слушать или читать молча. */
  voice: boolean;
  /** Общая громкость, 0…1. */
  volume: number;
}

const STORAGE_KEY = 'red-flag:settings';

const DEFAULTS: Settings = {
  music: true,
  sound: true,
  voice: true,
  volume: 0.7,
};

type Listener = (settings: Settings) => void;

class SettingsStore {
  private current: Settings = { ...DEFAULTS, ...read() };
  private listeners = new Set<Listener>();

  get(): Readonly<Settings> {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  update(patch: Partial<Settings>): Settings {
    this.current = { ...this.current, ...patch };
    write(this.current);
    for (const listener of this.listeners) listener(this.current);
    return this.current;
  }

  toggle(key: 'music' | 'sound'): boolean {
    const next = !this.current[key];
    this.update({ [key]: next } as Partial<Settings>);
    return next;
  }
}

function read(): Partial<Settings> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const data = parsed as Partial<Settings>;
    return {
      music: typeof data.music === 'boolean' ? data.music : undefined,
      sound: typeof data.sound === 'boolean' ? data.sound : undefined,
      volume: typeof data.volume === 'number' ? Math.min(1, Math.max(0, data.volume)) : undefined,
    };
  } catch {
    return {};
  }
}

function write(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // приватный режим браузера — просто играем без сохранения
  }
}

export const settings = new SettingsStore();
