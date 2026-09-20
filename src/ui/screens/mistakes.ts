/**
 * Разбор ошибок: «ПОКАЗАТЬ, ГДЕ Я ОШИБСЯ».
 *
 * Показывает пропущенные признаки риска и ошибочно отмеченные
 * фрагменты с теми же пояснениями, что игрок видел бы в игре.
 * Документы без ошибок в список не попадают.
 */
import type { RoundResult, Scenario } from '../../core/types';
import { escapeHtml, h } from '../dom';
import { icon } from '../icons';

interface Entry {
  index: number;
  title: string;
  /** Пропущенные признаки риска. */
  missed: Array<{ text: string; note: string }>;
  /** Ошибочно отмеченные фрагменты. */
  wrong: Array<{ text: string; note: string }>;
  /** Решение было неверным. */
  badDecision: boolean;
  /** Время на документ вышло. */
  timedOut: boolean;
}

function collect(results: readonly RoundResult[], scenarios: readonly Scenario[]): Entry[] {
  return results
    .map((result, index) => {
      const scenario = scenarios.find((item) => item.id === result.scenarioId);
      const find = (id: string) => scenario?.hotspots.find((h) => h.id === id);

      return {
        index: index + 1,
        title: scenario?.title ?? '',
        missed: result.missed
          .map((id) => find(id))
          .filter((h): h is NonNullable<typeof h> => Boolean(h))
          .map((h) => ({ text: h.text, note: h.note })),
        wrong: result.falsePositives
          .map((id) => find(id))
          .filter((h): h is NonNullable<typeof h> => Boolean(h))
          .map((h) => ({ text: h.text, note: h.note })),
        badDecision: result.decision !== null && !result.decisionCorrect,
        timedOut: result.decision === null,
      };
    })
    .filter((entry) => entry.missed.length + entry.wrong.length > 0 || entry.badDecision || entry.timedOut);
}

export function renderMistakes(
  results: readonly RoundResult[],
  scenarios: readonly Scenario[],
  onClose: () => void,
): HTMLElement {
  const entries = collect(results, scenarios);
  const overlay = h('div', 'overlay');

  const body = entries.length === 0
    ? `<p class="mistakes-empty">${icon('check')}Ошибок нет: все признаки найдены, решения верные.</p>`
    : entries
        .map(
          (entry) => `
      <section class="mistake">
        <h3 class="mistake-head">
          <span class="mistake-index">${entry.index}</span>
          ${escapeHtml(entry.title)}
        </h3>
        ${
          entry.timedOut
            ? '<p class="mistake-note mistake-note--grey">Время вышло — решение не принято.</p>'
            : ''
        }
        ${
          entry.badDecision
            ? '<p class="mistake-note mistake-note--red">Решение по документу было неверным.</p>'
            : ''
        }
        ${entry.missed
          .map(
            (item) => `
          <div class="mistake-item mistake-item--missed">
            <span class="mistake-tag">ПРОПУЩЕНО</span>
            <p class="mistake-text">«${escapeHtml(item.text)}»</p>
            <p class="mistake-why">${escapeHtml(item.note)}</p>
          </div>`,
          )
          .join('')}
        ${entry.wrong
          .map(
            (item) => `
          <div class="mistake-item mistake-item--wrong">
            <span class="mistake-tag">ЛИШНЯЯ ОТМЕТКА</span>
            <p class="mistake-text">«${escapeHtml(item.text)}»</p>
            <p class="mistake-why">${escapeHtml(item.note)}</p>
          </div>`,
          )
          .join('')}
      </section>`,
        )
        .join('');

  overlay.innerHTML = `
    <div class="modal modal--mistakes" role="dialog" aria-modal="true" aria-label="Разбор ошибок">
      <h2 class="modal-title">ГДЕ Я ОШИБСЯ</h2>
      <div class="mistakes-list">${body}</div>
      <button type="button" class="btn btn--primary" data-action="close">ПОНЯТНО</button>
    </div>
  `;

  overlay.querySelector('[data-action="close"]')?.addEventListener('click', onClose);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) onClose();
  });

  return overlay;
}
