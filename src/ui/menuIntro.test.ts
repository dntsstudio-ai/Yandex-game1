import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Регрессия: решение о логотипе приходит асинхронно. Когда состав анимаций
 * интро зависел от этого класса, поздний ответ сети перезапускал анимации —
 * логотип и кнопки исчезали на несколько секунд уже после появления.
 */
describe('таймлайн интро меню', () => {
  const css = readFileSync(new URL('../styles/menu.css', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('./menuScene.ts', import.meta.url), 'utf8');

  it('состав анимаций не зависит от класса, который выставляется асинхронно', () => {
    const selectors = css.match(/^[^{}]*\{/gm) ?? [];
    const risky = selectors.filter(
      (selector) => selector.includes('.menu-live') && selector.includes('.menu-has-logo'),
    );

    expect(risky).toEqual([]);
  });

  it('вариант таймлайна выбирается один раз, на старте интро', () => {
    expect(css).toContain('body.menu-live.menu-logo-intro');
    expect(scene).toContain("classList.add('menu-logo-intro')");
  });

  it('интерфейс скрыт только до запуска таймлайна', () => {
    // Без :not(.menu-live) видимость держалась бы только на анимациях,
    // и любой сбой оставлял бы меню пустым навсегда.
    expect(css).toContain('body.menu-intro:not(.menu-live) .start-inner > *');
  });

  it('после интро состояние фиксируется', () => {
    expect(css).toContain('body.menu-settled:not(.menu-exit) .start-inner > *');
    expect(scene).toContain("classList.add('menu-settled')");
  });

  it('меню показывается даже при медленной сети', () => {
    // страховочный таймер обязан существовать и быть не больше двух секунд
    const match = scene.match(/setTimeout\(startTimeline,\s*(\d+)\)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeLessThanOrEqual(2000);
  });
});
