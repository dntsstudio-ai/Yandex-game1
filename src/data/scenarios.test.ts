/**
 * Проверка целостности набора ситуаций.
 *
 * Контент пишется руками, и ошибка в нём не ломает сборку: маркер без
 * хотспота просто исчезает из текста, а лишний хотспот становится
 * невидимым и недостижимым признаком, из-за которого документ
 * невозможно пройти безупречно. Такие вещи ловятся только тестом.
 */
import { describe, expect, it } from 'vitest';
import { scenarios } from './scenarios';
import { ROUND_COUNT } from '../core/deck';
import { suspiciousIds } from '../core/rules';

const MARKER = /\{\{([a-z0-9-]+)\}\}/gi;

/** Все маркеры {{id}} из всех блоков ситуации, по порядку. */
function markersOf(scenario: (typeof scenarios)[number]): string[] {
  const texts: string[] = [];
  for (const block of scenario.blocks) {
    for (const row of block.rows ?? []) texts.push(row.value);
    for (const line of block.lines ?? []) texts.push(line.text);
  }
  return texts.flatMap((text) => Array.from(text.matchAll(MARKER), (match) => match[1]));
}

describe('набор ситуаций', () => {
  it('в наборе хватает документов на несколько разных партий', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(ROUND_COUNT * 4);
  });

  it('идентификаторы ситуаций уникальны', () => {
    const ids = scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('верные решения распределены почти поровну', () => {
    // Перекос делает выигрышной стратегию «жать одну кнопку не читая».
    const stop = scenarios.filter((item) => item.correctDecision === 'stop').length;
    const share = stop / scenarios.length;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  for (const scenario of scenarios) {
    describe(scenario.id, () => {
      it('каждый маркер находит свой хотспот', () => {
        const ids = new Set(scenario.hotspots.map((hotspot) => hotspot.id));
        for (const marker of markersOf(scenario)) {
          expect(ids.has(marker), `маркер {{${marker}}} без хотспота`).toBe(true);
        }
      });

      it('каждый хотспот показан в тексте ровно один раз', () => {
        const markers = markersOf(scenario);
        for (const hotspot of scenario.hotspots) {
          const used = markers.filter((id) => id === hotspot.id).length;
          expect(used, `хотспот ${hotspot.id} встречается ${used} раз`).toBe(1);
        }
      });

      it('идентификаторы хотспотов уникальны', () => {
        const ids = scenario.hotspots.map((hotspot) => hotspot.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('у каждого хотспота есть текст и пояснение', () => {
        for (const hotspot of scenario.hotspots) {
          expect(hotspot.text.trim().length).toBeGreaterThan(0);
          expect(hotspot.note.trim().length).toBeGreaterThan(10);
        }
      });

      it('решение согласовано с признаками риска', () => {
        // Признак риска в документе означает «остановить»: иначе игрок,
        // нашедший его и нажавший верную по смыслу кнопку, получал бы штраф.
        const flags = suspiciousIds(scenario).length;
        if (scenario.correctDecision === 'stop') expect(flags).toBeGreaterThan(0);
        else expect(flags).toBe(0);
      });

      it('в документе есть что отметить ошибочно', () => {
        const safe = scenario.hotspots.filter((hotspot) => !hotspot.suspicious).length;
        expect(safe).toBeGreaterThan(0);
      });

      it('заполнены заголовок, задание и разбор', () => {
        expect(scenario.title.trim().length).toBeGreaterThan(0);
        expect(scenario.brief.trim().length).toBeGreaterThan(0);
        expect(scenario.explanation.trim().length).toBeGreaterThan(20);
      });

      it('времени на документ хватает, чтобы его прочитать', () => {
        expect(scenario.timeLimitMs ?? 35_000).toBeGreaterThanOrEqual(20_000);
      });
    });
  }
});
