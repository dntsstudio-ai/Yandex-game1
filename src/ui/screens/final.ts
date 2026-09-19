/** Итоговый экран партии. */
import { rankFor } from '../../core/rules';
import type { GameState, Totals } from '../../core/types';
import { formatDuration, h } from '../dom';

export interface FinalHandlers {
  onRestart: () => void;
  onAbout: () => void;
}

export function renderFinalScreen(
  totals: Totals,
  state: GameState,
  scenarioCount: number,
  handlers: FinalHandlers,
): HTMLElement {
  const rank = rankFor(totals.purityIndex);
  const root = h('section', 'screen screen--final');
  const circumference = 2 * Math.PI * 52;

  root.innerHTML = `
    <div class="final-inner">
      <h2 class="final-title">ПРОВЕРКА ЗАВЕРШЕНА</h2>
      ${
        state.finishReason === 'timeout'
          ? `<p class="final-alert">Время вышло. Проверено документов: ${totals.roundsPlayed} из ${scenarioCount}</p>`
          : ''
      }

      <div class="purity">
        <svg class="purity-ring" viewBox="0 0 120 120" role="img" aria-label="Индекс чистоты ${
          totals.purityIndex
        }%">
          <circle class="purity-track" cx="60" cy="60" r="52" />
          <circle class="purity-value" cx="60" cy="60" r="52"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference}" />
        </svg>
        <div class="purity-center">
          <span class="purity-number" data-purity>0</span>
          <span class="purity-unit">%</span>
          <span class="purity-label">ИНДЕКС ЧИСТОТЫ</span>
        </div>
      </div>

      <p class="final-rank">${rank.title}</p>
      <p class="final-caption">${rank.caption}</p>

      <div class="stats">
        <div class="stat"><span>Итоговые очки</span><strong class="${
          totals.score < 0 ? 'is-negative' : ''
        }">${totals.score}</strong></div>
        <div class="stat"><span>Найдено нарушений</span><strong class="is-good">${totals.found} из ${
          totals.totalFlags
        }</strong></div>
        <div class="stat"><span>Пропущено</span><strong class="is-bad">${totals.missed}</strong></div>
        <div class="stat"><span>Ложные срабатывания</span><strong class="is-warn">${
          totals.falsePositives
        }</strong></div>
        <div class="stat"><span>Верные решения</span><strong>${totals.correctDecisions} из ${
          totals.roundsPlayed
        }</strong></div>
        <div class="stat"><span>Потрачено времени</span><strong>${formatDuration(
          totals.elapsedMs,
        )}</strong></div>
      </div>

      <div class="final-actions">
        <button type="button" class="btn btn--primary" data-action="restart">ИГРАТЬ СНОВА</button>
        <button type="button" class="btn btn--ghost" data-action="about">О ПРОЕКТЕ</button>
      </div>
    </div>
  `;

  root.querySelector('[data-action="restart"]')?.addEventListener('click', handlers.onRestart);
  root.querySelector('[data-action="about"]')?.addEventListener('click', handlers.onAbout);

  animatePurity(root, totals.purityIndex, circumference);
  return root;
}

/** Плавное заполнение кольца и счётчика. */
function animatePurity(root: HTMLElement, target: number, circumference: number): void {
  const ring = root.querySelector<SVGCircleElement>('.purity-value');
  const number = root.querySelector<HTMLElement>('[data-purity]');
  const duration = 900;
  const startedAt = performance.now();

  if (ring) {
    ring.style.stroke = target >= 65 ? 'var(--green)' : target >= 40 ? 'var(--amber)' : 'var(--red)';
  }

  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    if (number) number.textContent = String(value);
    if (ring) ring.style.strokeDashoffset = String(circumference * (1 - (target / 100) * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
