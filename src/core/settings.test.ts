import { beforeEach, describe, expect, it } from 'vitest';
import { settings } from './settings';

describe('настройки', () => {
  beforeEach(() => {
    settings.update({ music: true, sound: true, volume: 0.7 });
  });

  it('по умолчанию музыка и звук включены', () => {
    expect(settings.get().music).toBe(true);
    expect(settings.get().sound).toBe(true);
    expect(settings.get().volume).toBeGreaterThan(0);
  });

  it('переключение меняет значение и возвращает новое состояние', () => {
    expect(settings.toggle('music')).toBe(false);
    expect(settings.get().music).toBe(false);
    expect(settings.toggle('music')).toBe(true);
  });

  it('подписчик получает обновления', () => {
    const seen: boolean[] = [];
    const unsubscribe = settings.subscribe((value) => seen.push(value.sound));
    settings.update({ sound: false });
    unsubscribe();
    settings.update({ sound: true });

    expect(seen).toEqual([true, false]);
  });

  it('работает без localStorage — значения остаются в памяти', () => {
    settings.update({ volume: 0.25 });
    expect(settings.get().volume).toBe(0.25);
  });
});
