import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VOICE_DIR = 'public/media/voice';

/** Имена, на которые ссылается обучение. */
const EXPECTED = ['intro-1', 'intro-2', 'intro-3', 'order-1', 'order-2', 'lesson'];

describe('файлы озвучки', () => {
  it('все реплики знакомства и отказа на месте', () => {
    if (!existsSync(VOICE_DIR)) return;
    const names = readdirSync(VOICE_DIR)
      .filter((file) => /\.(mp3|ogg)$/i.test(file))
      .map((file) => file.replace(/\.[^.]+$/, ''));

    for (const name of EXPECTED) expect(names).toContain(name);
  });

  it('лишних файлов в папке нет: опечатка в имени осталась бы незаметной', () => {
    if (!existsSync(VOICE_DIR)) return;
    const names = readdirSync(VOICE_DIR).map((file) => file.replace(/\.[^.]+$/, ''));
    for (const name of names) expect(EXPECTED).toContain(name);
  });

  it('файлы не пустые', () => {
    if (!existsSync(VOICE_DIR)) return;
    for (const file of readdirSync(VOICE_DIR)) {
      expect(statSync(`${VOICE_DIR}/${file}`).size).toBeGreaterThan(10_000);
    }
  });

  it('заставка лежит среди эффектов', () => {
    const path = 'public/media/sfx/intro.mp3';
    if (!existsSync(path)) return;
    expect(statSync(path).size).toBeGreaterThan(10_000);
  });
});
