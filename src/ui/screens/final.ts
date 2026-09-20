/**
 * Итоговый экран — «протокол проверки».
 *
 * Появляется по тактам: кольцо индекса, звание, разбор индекса на
 * составляющие, лента документов, сводка и кнопки. Любой клик или клавиша
 * показывают всё сразу.
 */
import { nextRank, purityBreakdown, rankFor, suspiciousIds } from '../../core/rules';
import { submitIndex } from '../../core/records';
import type { RoundResult, Scenario, Totals } from '../../core/types';
import { escapeHtml, formatDuration, h } from '../dom';
import { icon } from '../icons';
import { startDust } from '../dust';
import { prefersReducedMotion } from '../menuScene';

export interface FinalHandlers {
  onRestart: () => void;
  onAbout: () => void;
  onSettings: () => void;
  /** Тик счётчика во время анимации индекса чистоты. */
  onCount: () => void;
  /** Удар печати на протоколе. */
  onStamp: () => void;
}

export interface FinalScreen {
  root: HTMLElement;
  destroy: () => void;
}

/** Состояние документа в ленте: значок, подпись и цвет статуса. */
interface DocumentMark {
  tone: 'good' | 'warning' | 'critical' | 'neutral';
  glyph: string;
  label: string;
}

function markFor(result: RoundResult, scenario: Scenario | undefined): DocumentMark {
  if (result.decision === null) {
    return { tone: 'neutral', glyph: '◷', label: 'время вышло' };
  }
  if (!result.decisionCorrect) {
    return { tone: 'critical', glyph: '✕', label: 'неверное решение' };
  }
  const flags = scenario ? suspiciousIds(scenario).length : result.found.length + result.missed.length;
  if (result.missed.length > 0 || result.falsePositives.length > 0) {
    return {
      tone: 'warning',
      glyph: '!',
      label: `решение верное, найдено ${result.found.length} из ${flags}`,
    };
  }
  return { tone: 'good', glyph: '✓', label: 'безупречно' };
}

export function renderFinalScreen(
  totals: Totals,
  results: readonly RoundResult[],
  scenarios: readonly Scenario[],
  handlers: FinalHandlers,
): FinalScreen {
  const rank = rankFor(totals.purityIndex);
  const ahead = nextRank(totals.purityIndex);
  const record = submitIndex(totals.purityIndex);
  const breakdown = purityBreakdown({
    found: totals.found,
    totalFlags: totals.totalFlags,
    correctDecisions: totals.correctDecisions,
    roundsPlayed: totals.roundsPlayed,
    falsePositives: totals.falsePositives,
  });

  // Номер бланка: устойчив в пределах одной проверки, но у каждой свой.
  const protocolNo = String(1000 + (Math.abs(Math.round(totals.score * 7 + totals.elapsedMs)) % 9000));
  const stampedAt = new Date().toLocaleDateString('ru-RU');

  const root = h('section', 'screen screen--final');
  const circumference = 2 * Math.PI * 52;
  const reduceMotion = prefersReducedMotion();

  const marks = results.map((result, index) => {
    const scenario = scenarios.find((item) => item.id === result.scenarioId);
    const mark = markFor(result, scenario);
    const title = `${index + 1}. ${scenario?.title ?? ''} — ${mark.label}`;
    return `
      <li class="doc-mark doc-mark--${mark.tone}" style="--mark-index: ${index}" title="${escapeHtml(title)}">
        <span class="doc-mark-glyph" aria-hidden="true">${mark.glyph}</span>
        <span class="doc-mark-number">${index + 1}</span>
        <span class="visually-hidden">${escapeHtml(title)}</span>
      </li>`;
  });

  const meters: Array<{ caption: string; ratio: number; value: string; points: string; tone: string }> = [
    {
      caption: 'Найдено признаков',
      ratio: breakdown.detectionRatio,
      value: `${totals.found} из ${totals.totalFlags}`,
      points: `+${breakdown.detectionPoints}`,
      tone: 'good',
    },
    {
      caption: 'Верные решения',
      ratio: breakdown.decisionsRatio,
      value: `${totals.correctDecisions} из ${totals.roundsPlayed}`,
      points: `+${breakdown.decisionsPoints}`,
      tone: 'accent',
    },
    {
      caption: 'Ложные срабатывания',
      ratio: breakdown.penaltyRatio,
      value: String(totals.falsePositives),
      points: breakdown.penaltyPoints > 0 ? `−${breakdown.penaltyPoints}` : '0',
      tone: 'critical',
    },
  ];

  root.innerHTML = `
    <div class="final-inner">
      <span class="tick tick--tl"></span><span class="tick tick--tr"></span>
      <span class="tick tick--bl"></span><span class="tick tick--br"></span>
      <canvas class="final-dust" aria-hidden="true"></canvas>

      <header class="final-head">
        <span class="final-label">ПРОТОКОЛ ПРОВЕРКИ <b>№ ${protocolNo}</b></span>
        <span class="final-docs">${stampedAt} · ${totals.roundsPlayed} из ${
          scenarios.length
        } документов${totals.timedOutRounds > 0 ? ` · просрочено ${totals.timedOutRounds}` : ''}</span>
      </header>

      <div class="final-body">
        <div class="final-top">
          <div class="purity">
            <svg class="purity-ring" viewBox="0 0 120 120" role="img" aria-label="Индекс чистоты ${
              totals.purityIndex
            }%">
              <circle class="purity-track" cx="60" cy="60" r="52" />
              <circle class="purity-value" cx="60" cy="60" r="52"
                stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" />
            </svg>
            <div class="purity-center">
              <span class="purity-number" data-purity>0</span>
              <span class="purity-unit">%</span>
              <span class="purity-label">ИНДЕКС ЧИСТОТЫ</span>
            </div>
          </div>

          <div class="final-verdict">
            <p class="final-rank">${rank.title}</p>
            <p class="final-caption">${rank.caption}</p>
            ${
              ahead
                ? `<div class="final-next">
                     <span class="final-next-line">До звания «${escapeHtml(
                       ahead.rank.title,
                     )}» — <b>${ahead.need}%</b></span>
                     <span class="final-next-track"><span class="final-next-fill" style="--next-ratio: ${ahead.progress.toFixed(
                       3,
                     )}"></span></span>
                   </div>`
                : '<p class="final-next-top">Выше звания нет — проверка безупречна</p>'
            }
            <p class="final-record">
              ${
                record.previous === null
                  ? 'Первая проверка — есть с чем сравнивать дальше'
                  : `Лучший результат: <b>${record.best}%</b>`
              }
              ${record.isRecord ? '<span class="final-badge">НОВЫЙ РЕКОРД</span>' : ''}
            </p>
          </div>

          ${
            totals.purityIndex >= 65
              ? `<div class="final-stamp stamp stamp--pass" aria-hidden="true"><span class="stamp-text">ПРОВЕРЕНО</span></div>`
              : ''
          }
        </div>

        <div class="final-side">
          <section class="final-block">
            <h3 class="final-subtitle">${icon('check')}Из чего сложился индекс</h3>
            <ul class="meters">
              ${meters
                .map(
                  (meter, index) => `
                <li class="meter meter--${meter.tone}" style="--meter-index: ${index}">
                  <span class="meter-caption">${meter.caption}</span>
                  <span class="meter-track"><span class="meter-fill" style="--meter-ratio: ${meter.ratio.toFixed(
                    3,
                  )}"></span></span>
                  <span class="meter-value">${meter.value}</span>
                  <span class="meter-points">${meter.points}</span>
                </li>`,
                )
                .join('')}
            </ul>
          </section>

          <section class="final-block">
            <h3 class="final-subtitle">${icon('doc')}Документы</h3>
            <ul class="doc-marks">${marks.join('')}</ul>
            <p class="doc-legend">
              <span><i class="dot dot--green"></i>безупречно</span>
              <span><i class="dot dot--amber"></i>есть пропуски</span>
              <span><i class="dot dot--red"></i>неверное решение</span>
              <span><i class="dot dot--grey"></i>время вышло</span>
            </p>
          </section>

          <div class="stats">
            <div class="stat"><span>${icon('score')}Итоговые очки</span><strong class="${
              totals.score < 0 ? 'is-negative' : ''
            }">${totals.score}</strong></div>
            <div class="stat"><span>${icon('accuracy')}Точность кликов</span><strong>${
              totals.accuracy
            }%</strong></div>
            <div class="stat"><span>${icon('clock')}Потрачено времени</span><strong>${formatDuration(
              totals.elapsedMs,
            )}</strong></div>
          </div>
        </div>
      </div>

      <div class="final-actions">
        <button type="button" class="btn btn--primary" data-action="restart">ИГРАТЬ СНОВА</button>
        <button type="button" class="btn btn--ghost" data-action="about">О ПРОЕКТЕ</button>
        <button type="button" class="btn btn--ghost" data-action="settings">НАСТРОЙКИ</button>
      </div>
    </div>
  `;

  root.querySelector('[data-action="restart"]')?.addEventListener('click', handlers.onRestart);
  root.querySelector('[data-action="about"]')?.addEventListener('click', handlers.onAbout);
  root.querySelector('[data-action="settings"]')?.addEventListener('click', handlers.onSettings);

  // ---------- режиссура появления ----------
  root.classList.add('is-revealing');
  const finish = () => root.classList.add('is-shown');
  // на маленьком экране такт короче — сверяемся с тем же признаком, что и CSS
  const compact = document.body.classList.contains('is-fit') || window.innerWidth <= 640;
  const revealTimer = window.setTimeout(finish, reduceMotion ? 0 : compact ? 2300 : 3400);

  const onSkip = () => finish();
  window.addEventListener('pointerdown', onSkip, { passive: true });
  window.addEventListener('keydown', onSkip);

  if (reduceMotion) finish();

  // удар печати озвучивается ровно тогда, когда её показывает CSS (такт × 5)
  const stampTimer =
    totals.purityIndex >= 65 && !reduceMotion
      ? window.setTimeout(handlers.onStamp, compact ? 900 : 1500)
      : 0;
  const stopCounter = animatePurity(root, totals.purityIndex, circumference, handlers.onCount, reduceMotion);

  const dust = root.querySelector<HTMLCanvasElement>('.final-dust');
  const stopDust = dust && !reduceMotion ? startDust(dust, { density: 0.6, leaves: false }) : null;

  return {
    root,
    destroy() {
      window.clearTimeout(revealTimer);
      window.clearTimeout(stampTimer);
      window.removeEventListener('pointerdown', onSkip);
      window.removeEventListener('keydown', onSkip);
      stopCounter();
      stopDust?.();
    },
  };
}

/** Плавное заполнение кольца и счётчика. */
function animatePurity(
  root: HTMLElement,
  target: number,
  circumference: number,
  onCount: () => void,
  reduceMotion: boolean,
): () => void {
  const ring = root.querySelector<SVGCircleElement>('.purity-value');
  const number = root.querySelector<HTMLElement>('[data-purity]');

  const color = target >= 65 ? 'var(--green)' : target >= 40 ? 'var(--amber)' : 'var(--red)';
  if (ring) ring.style.stroke = color;

  const apply = (value: number, ratio: number) => {
    if (number) number.textContent = String(value);
    if (ring) ring.style.strokeDashoffset = String(circumference * (1 - ratio));
  };

  if (reduceMotion) {
    apply(target, target / 100);
    return () => undefined;
  }

  const duration = 1100;
  const delay = 400;
  const startedAt = performance.now() + delay;
  let frame = 0;

  const step = (now: number) => {
    const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);

    if (number && number.textContent !== String(value)) {
      if (value > 0 && value % 5 === 0) onCount();
    }
    apply(value, (target / 100) * eased);

    if (progress < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  return () => cancelAnimationFrame(frame);
}
