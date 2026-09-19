/** Экран разбора раунда. */
import type { RoundResult, Scenario } from '../../core/types';
import { escapeHtml, h } from '../dom';

function hotspotText(scenario: Scenario, id: string): { text: string; note: string } {
  const hotspot = scenario.hotspots.find((item) => item.id === id);
  return { text: hotspot?.text ?? id, note: hotspot?.note ?? '' };
}

function list(scenario: Scenario, ids: string[], modifier: string, caption: string): string {
  if (ids.length === 0) return '';
  return `
    <div class="review-group review-group--${modifier}">
      <span class="review-caption">${caption}</span>
      <ul>
        ${ids
          .map((id) => {
            const { text, note } = hotspotText(scenario, id);
            return `<li><strong>${escapeHtml(text)}</strong><span>${escapeHtml(note)}</span></li>`;
          })
          .join('')}
      </ul>
    </div>
  `;
}

export function renderRoundResult(
  scenario: Scenario,
  result: RoundResult,
  isLast: boolean,
  onNext: () => void,
): HTMLElement {
  const violation = scenario.correctDecision === 'stop';
  const root = h('section', 'screen screen--result');

  root.innerHTML = `
    <div class="result-card ${violation ? 'is-violation' : 'is-clean'}">
      <div class="verdict">
        <span class="verdict-icon" aria-hidden="true">${violation ? '⚑' : '✓'}</span>
        <div>
          <h2 class="verdict-title">${
            violation ? 'Нарушение обнаружено' : 'Нарушений не обнаружено'
          }</h2>
          <p class="verdict-sub ${result.decisionCorrect ? 'is-ok' : 'is-fail'}">
            Ваше решение: ${result.decision === 'stop' ? 'ОСТАНОВИТЬ' : 'ПРОПУСТИТЬ'} —
            ${result.decisionCorrect ? 'верно' : 'ошибка'}
          </p>
        </div>
        <span class="verdict-points ${result.points >= 0 ? 'is-plus' : 'is-minus'}">
          ${result.points >= 0 ? '+' : ''}${result.points}
        </span>
      </div>

      <p class="result-explanation">${escapeHtml(scenario.explanation)}</p>

      <div class="review">
        ${list(scenario, result.found, 'found', 'Найдено')}
        ${list(scenario, result.missed, 'missed', 'Пропущено')}
        ${list(scenario, result.falsePositives, 'false', 'Ложные срабатывания')}
      </div>

      <button type="button" class="btn btn--primary" data-action="next">
        ${isLast ? 'ИТОГИ ПРОВЕРКИ' : 'СЛЕДУЮЩИЙ ДОКУМЕНТ'}
      </button>
      <p class="result-hint">Таймер остановлен на время разбора</p>
    </div>
  `;

  const button = root.querySelector<HTMLButtonElement>('[data-action="next"]');
  button?.addEventListener('click', onNext);
  window.setTimeout(() => button?.focus(), 60);
  return root;
}
