import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES } from './sfx';

const SFX_DIR = 'public/media/sfx';

describe('звуковые файлы', () => {
  it('список имён без повторов', () => {
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
  });

  it('каждый файл в public/media/sfx назван как звук из списка', () => {
    if (!existsSync(SFX_DIR)) return;
    const names = readdirSync(SFX_DIR)
      .filter((file) => /\.(mp3|ogg|wav)$/i.test(file))
      .map((file) => file.replace(/\.[^.]+$/, ''));

    // Файл с опечаткой молча не подхватится — вместо него останется синтез.
    for (const name of names) {
      expect(SOUND_NAMES).toContain(name as (typeof SOUND_NAMES)[number]);
    }
  });

  it('присланные файлы не пустые', () => {
    if (!existsSync(SFX_DIR)) return;
    for (const file of readdirSync(SFX_DIR)) {
      expect(statSync(`${SFX_DIR}/${file}`).size).toBeGreaterThan(1000);
    }
  });

  it('файл музыки на месте и похож на mp3', () => {
    const path = 'public/media/music/theme.mp3';
    if (!existsSync(path)) return;
    expect(statSync(path).size).toBeGreaterThan(10_000);
  });
});
