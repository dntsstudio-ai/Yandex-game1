/**
 * «Что это значит?» — разбор итога словами.
 *
 * Протокол показывает цифры; здесь объясняется, какой проверяющий за
 * этими цифрами стоит и что ему делать дальше. Три шкалы: верные
 * решения, внимательность и аккуратность.
 */
import { buildVerdict, verdictSummary, type VerdictSection } from '../../core/verdict';
import type { Totals } from '../../core/types';
import { escapeHtml } from '../dom';
import { createModal } from '../modal';
import { icon } from '../icons';

export function renderVerdict(totals: Totals, onClose: () => void): HTMLElement {
  const sections = buildVerdict(totals);

  const body = `
    <p class="verdict-lead">${escapeHtml(verdictSummary(sections))}</p>
    ${sections.map(renderSection).join('')}
    <p class="verdict-note">
      ${icon('check')}Оценки независимы: можно принимать верные решения и при этом
      пропускать признаки — или находить всё, но отмечать лишнее.
    </p>
  `;

  return createModal(
    {
      title: 'ЧТО ЭТО ЗНАЧИТ',
      label: 'Разбор результата',
      variant: 'modal--verdict',
      body,
    },
    onClose,
  ).root;
}

function renderSection(section: VerdictSection): string {
  const scale = Array.from({ length: 10 }, (_, index) => {
    const filled = index < section.score ? ' is-filled' : '';
    return `<span class="verdict-step${filled}"></span>`;
  }).join('');

  return `
    <section class="verdict-card verdict-card--${section.band.level}">
      <header class="verdict-head">
        <span class="verdict-caption">${escapeHtml(section.caption)}</span>
        <span class="verdict-value">${escapeHtml(section.value)}</span>
      </header>
      <div class="verdict-scale" role="img"
        aria-label="Оценка ${section.score} из 10 — ${escapeHtml(section.basis)}">${scale}</div>
      <p class="verdict-band">${escapeHtml(section.band.title)}</p>
      <p class="verdict-meaning">${escapeHtml(section.band.meaning)}</p>
      <p class="verdict-advice"><b>Что делать:</b> ${escapeHtml(section.band.advice)}</p>
    </section>`;
}
