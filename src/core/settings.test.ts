import { beforeEach, describe, expect, it } from 'vitest';
import { parseSettings, settings } from './settings';

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

  it('режим по умолчанию — для молодых', () => {
    expect(['young', 'mature']).toContain(settings.get().mode);
  });

  it('режим переключается и запоминается', () => {
    settings.update({ mode: 'mature' });
    expect(settings.get().mode).toBe('mature');
    settings.update({ mode: 'young' });
    expect(settings.get().mode).toBe('young');
  });
});

describe('разбор сохранённых настроек', () => {
  it('пропускает только поля с правильным типом', () => {
    expect(parseSettings({ music: false, sound: 'да', volume: 0.4 })).toEqual({
      music: false,
      volume: 0.4,
    });
  });

  it('не подставляет undefined вместо значений по умолчанию', () => {
    // Запись от старой версии: поля voice в ней ещё не было. Раньше оно
    // приходило как undefined и перекрывало включённую по умолчанию озвучку.
    const stored = parseSettings({ music: true, sound: true, volume: 0.7 });
    expect('voice' in stored).toBe(false);
    expect({ voice: true, ...stored }.voice).toBe(true);
  });

  it('зажимает громкость в границы', () => {
    expect(parseSettings({ volume: 5 }).volume).toBe(1);
    expect(parseSettings({ volume: -3 }).volume).toBe(0);
    expect(parseSettings({ volume: Number.NaN }).volume).toBeUndefined();
  });

  it('неизвестный режим игнорируется', () => {
    expect(parseSettings({ mode: 'hard' }).mode).toBeUndefined();
    expect(parseSettings({ mode: 'mature' }).mode).toBe('mature');
  });

  it('мусор вместо объекта не ломает разбор', () => {
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings('строка')).toEqual({});
  });
});
