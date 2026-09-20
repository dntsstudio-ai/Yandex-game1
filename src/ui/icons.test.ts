import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, icon } from './icons';

const sprite = readFileSync('public/media/ui/icons.svg', 'utf8');

describe('спрайт иконок', () => {
  it('в файле есть символ для каждого имени', () => {
    for (const name of ICON_NAMES) {
      expect(sprite).toContain(`id="${name}"`);
    }
  });

  it('в файле нет лишних символов сверх списка', () => {
    const ids = [...sprite.matchAll(/<symbol[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    expect([...ids].sort()).toEqual([...ICON_NAMES].sort());
  });

  it('символы рисуются штрихом и наследуют цвет', () => {
    expect(sprite).toContain('stroke: currentColor');
    expect(sprite).toContain('fill: none');
  });

  it('разметка иконки ссылается на символ и несёт своё имя классом', () => {
    const html = icon('accuracy');
    expect(html).toContain('href="#accuracy"');
    expect(html).toContain('icon--accuracy');
    expect(html).toContain('aria-hidden="true"');
  });

  it('дополнительный класс добавляется, а не заменяет базовые', () => {
    const html = icon('settings', 'icon--gear');
    expect(html).toContain('class="icon icon--settings icon--gear"');
  });
});
