/** Экран разбора раунда: вердикт, штамп, найденное и пропущенное. */
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

/** Надпись на штампе — по итогу раунда. */
function stampFor(result: RoundResult, violation: boolean): { text: string; tone: string } {
  if (result.decision === null) return { text: 'ВРЕМЯ ВЫШЛО', tone: 'warn' };
  if (!result.decisionCorrect) return { text: 'ОШИБКА', tone: 'fail' };
  return violation ? { text: 'ОСТАНОВЛЕНО', tone: 'stop' } : { text: 'ПРОВЕРЕНО', tone: 'pass' };
}

function decisionLine(result: RoundResult): string {
  if (result.decision === null) {
    return 'Время на документ истекло — решение не принято';
  }
  const label = result.decision === 'stop' ? 'ОСТАНОВИТЬ' : 'ПРОПУСТИТЬ';
  return `Ваше решение: ${label} — ${result.decisionCorrect ? 'верно' : 'ошибка'}`;
}

export function renderRoundResult(
  scenario: Scenario,
  result: RoundResult,
  isLast: boolean,
  onNext: () => void,
): HTMLElement {
  const violation = scenario.correctDecision === 'stop';
  const stamp = stampFor(result, violation);
  const root = h('section', 'screen screen--result');

  root.innerHTML = `
    <div class="result-card ${violation ? 'is-violation' : 'is-clean'}">
      <div class="stamp stamp--${stamp.tone}" aria-hidden="true">
        <span class="stamp-text">${stamp.text}</span>
      </div>

      <div class="verdict">
        <span class="verdict-icon" aria-hidden="true">${violation ? '⚑' : '✓'}</span>
        <div>
          <h2 class="verdict-title">${
            violation ? 'Нарушение обнаружено' : 'Нарушений не обнаружено'
          }</h2>
          <p class="verdict-sub ${result.decisionCorrect ? 'is-ok' : 'is-fail'}">
            ${decisionLine(result)}
          </p>
        </div>
      </div>

      <p class="result-explanation">${escapeHtml(scenario.explanation)}</p>

      <div class="review">
        ${list(scenario, result.found, 'found', 'Найдено')}
        ${list(scenario, result.missed, 'missed', 'Пропущено')}
        ${list(scenario, result.falsePositives, 'false', 'Ложные срабатывания')}
      </div>

      <div class="result-actions">
        <button type="button" class="btn btn--primary" data-action="next">
          ${isLast ? 'ИТОГИ ПРОВЕРКИ' : 'СЛЕДУЮЩИЙ ДОКУМЕНТ'}
        </button>
        <span class="round-score ${result.points >= 0 ? 'is-plus' : 'is-minus'}">
          <small>за раунд</small>
          <strong>${result.points >= 0 ? '+' : ''}${result.points}</strong>
        </span>
      </div>
      <p class="result-hint">Таймер следующего документа начнётся заново</p>
    </div>
  `;

  const button = root.querySelector<HTMLButtonElement>('[data-action="next"]');
  button?.addEventListener('click', onNext);
  window.setTimeout(() => button?.focus(), 60);
  return root;
}
