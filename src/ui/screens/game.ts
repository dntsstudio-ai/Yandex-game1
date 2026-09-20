/** Экран проверки документа: HUD, папка дела, карточка документа, решения. */
import { SCORING, STREAK, liveAccuracy, suspiciousIds } from '../../core/rules';
import type { Decision, GameState, Scenario } from '../../core/types';
import { formatTime, h } from '../dom';
import { renderDocument } from '../documentView';
import { icon } from '../icons';

export interface GameScreenHandlers {
  onHotspot: (id: string, element: HTMLElement) => void;
  onDecision: (decision: Decision) => void;
  onSettings: () => void;
  /** Запрос подсказки; возвращает признак, к которому подвести игрока. */
  onHint: () => string | null;
  /** Переключение увеличения документа — нужно для звука. */
  onZoom: (zoomed: boolean) => void;
}

export interface GameScreen {
  root: HTMLElement;
  update: (state: GameState, scenario: Scenario, total: number) => void;
  markHotspot: (id: string, suspicious: boolean) => void;
  showNote: (note: string, suspicious: boolean) => void;
  /** Показать индикатор серии. */
  showStreak: (streak: number, bonus: number) => void;
  destroy: () => void;
}

export function renderGameScreen(
  scenario: Scenario,
  total: number,
  handlers: GameScreenHandlers,
): GameScreen {
  const root = h('section', 'screen screen--game');
  root.innerHTML = `
    <header class="hud">
      <div class="hud-stats">
        <div class="hud-item hud-item--time">
          <span class="hud-label">${icon('time')}На документ</span>
          <span class="hud-value" data-hud="time">1:30</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">${icon('score')}Очки</span>
          <span class="hud-value" data-hud="score">0</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">${icon('doc')}Документ</span>
          <span class="hud-value" data-hud="index">1/${total}</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">${icon('accuracy')}Точность</span>
          <span class="hud-value" data-hud="accuracy">100%</span>
        </div>
        <span class="streak" data-hud="streak" aria-live="polite" hidden>
          ${icon('flag')}<b data-hud="streak-value">СЕРИЯ ×2</b>
        </span>
        <button type="button" class="sound-btn" data-action="settings" aria-label="Настройки">
          ${icon('settings', 'icon--gear')}${gearIcon()}
        </button>
      </div>
      <div class="timebar"><span class="timebar-fill" data-hud="timebar"></span></div>
    </header>

    <main class="stage">
      <div class="case">
        <span class="case-label">ДЕЛО № ${caseNumber(scenario.id)}</span>
        <span class="case-state" data-hud="case">НА ПРОВЕРКЕ</span>
      </div>
      <p class="brief"><span class="brief-mark">задача</span>${scenario.brief}</p>
      <div class="doc-slot"></div>
    </main>

    <div class="dock">
      <p class="inspector" data-hud="inspector" aria-live="polite"></p>
      <footer class="actions">
        <span class="marks" data-hud="marks">Отмечено признаков: 0</span>
        <div class="tools">
          <button type="button" class="btn btn--tool" data-action="zoom" aria-pressed="false">
            УВЕЛИЧИТЬ
          </button>
          <button type="button" class="btn btn--tool" data-action="hint">
            ПОКАЗАТЬ ПОДСКАЗКУ <i>${SCORING.hintCost}</i>
          </button>
        </div>
        <div class="actions-buttons">
          <button type="button" class="btn btn--pass" data-decision="pass">ПРОПУСТИТЬ</button>
          <button type="button" class="btn btn--stop" data-decision="stop">ОСТАНОВИТЬ</button>
        </div>
      </footer>
    </div>
  `;

  const slot = root.querySelector('.doc-slot');
  const docNode = renderDocument(scenario);
  slot?.appendChild(docNode);

  docNode.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hotspot]');
    if (!target || target.classList.contains('is-done')) return;
    handlers.onHotspot(target.dataset.hotspot ?? '', target);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-decision]').forEach((button) => {
    button.addEventListener('click', () => {
      handlers.onDecision(button.dataset.decision === 'stop' ? 'stop' : 'pass');
    });
  });

  root.querySelector('[data-action="settings"]')?.addEventListener('click', handlers.onSettings);

  // ---------- увеличение документа ----------
  // Масштабируется только карточка, через transform: кликабельные области
  // едут вместе с текстом, поэтому попадать по ним не становится труднее.
  const zoomButton = root.querySelector<HTMLButtonElement>('[data-action="zoom"]');
  let zoomed = false;
  const setZoom = (next: boolean) => {
    if (next === zoomed) return;
    zoomed = next;
    root.classList.toggle('is-zoomed', zoomed);
    zoomButton?.setAttribute('aria-pressed', String(zoomed));
    if (zoomButton) zoomButton.textContent = zoomed ? 'УМЕНЬШИТЬ' : 'УВЕЛИЧИТЬ';
    handlers.onZoom(zoomed);
  };
  zoomButton?.addEventListener('click', () => setZoom(!zoomed));

  // затемнение вокруг увеличенного документа возвращает масштаб
  const backdrop = h('div', 'zoom-backdrop');
  root.appendChild(backdrop);
  backdrop.addEventListener('click', () => setZoom(false));

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && zoomed) setZoom(false);
  };
  window.addEventListener('keydown', onKey);

  // ---------- подсказка ----------
  const hintButton = root.querySelector<HTMLButtonElement>('[data-action="hint"]');
  hintButton?.addEventListener('click', () => {
    const target = handlers.onHint();
    if (!target) return;
    hintButton.disabled = true;

    // Подсвечивается строка, а не сам фрагмент: подсказка указывает
    // направление поиска и не делает клик за игрока.
    const node = docNode.querySelector<HTMLElement>(`[data-hotspot="${target}"]`);
    const line = node?.closest<HTMLElement>('p, li, dd, .bubble, .doc-row, .doc-field');
    (line ?? node)?.classList.add('is-hinted');
  });

  const timeEl = root.querySelector<HTMLElement>('[data-hud="time"]');
  const timeBar = root.querySelector<HTMLElement>('[data-hud="timebar"]');
  const scoreEl = root.querySelector<HTMLElement>('[data-hud="score"]');
  const indexEl = root.querySelector<HTMLElement>('[data-hud="index"]');
  const accuracyEl = root.querySelector<HTMLElement>('[data-hud="accuracy"]');
  const marksEl = root.querySelector<HTMLElement>('[data-hud="marks"]');
  const inspectorEl = root.querySelector<HTMLElement>('[data-hud="inspector"]');
  const caseEl = root.querySelector<HTMLElement>('[data-hud="case"]');
  const streakEl = root.querySelector<HTMLElement>('[data-hud="streak"]');
  const streakValueEl = root.querySelector<HTMLElement>('[data-hud="streak-value"]');

  // Значения HUD обновляются на каждом кадре таймера, поэтому пишем в DOM
  // только при реальном изменении: иначе браузер пересчитывает текст
  // шестьдесят раз в секунду и кадры игрового экрана проседают.
  let lastTime = '';
  let lastLow = false;
  let lastScore = Number.NaN;
  let lastIndex = '';
  let lastClicks = -1;
  let lastStreak = -1;
  let streakTimer = 0;

  return {
    root,
    update(state, current, totalCount) {
      const ratio = Math.max(0, state.timeLeftMs / Math.max(1, state.roundDurationMs));
      const low = state.timeLeftMs <= 10_000;

      const time = formatTime(state.timeLeftMs);
      if (timeEl && time !== lastTime) {
        timeEl.textContent = time;
        lastTime = time;
      }
      if (low !== lastLow) {
        timeEl?.classList.toggle('is-low', low);
        timeBar?.classList.toggle('is-low', low);
        lastLow = low;
      }
      // шкала — это transform, он дёшев и обновляется каждый кадр
      if (timeBar) timeBar.style.transform = `scaleX(${ratio.toFixed(4)})`;

      if (scoreEl && state.score !== lastScore) {
        scoreEl.textContent = String(state.score);
        scoreEl.classList.toggle('is-negative', state.score < 0);
        lastScore = state.score;
      }

      const index = `${state.index + 1}/${totalCount}`;
      if (indexEl && index !== lastIndex) {
        indexEl.textContent = index;
        lastIndex = index;
      }

      // точность, счётчик отметок и состояние дела меняются только при клике
      if (state.clicked.length !== lastClicks) {
        lastClicks = state.clicked.length;
        if (accuracyEl) accuracyEl.textContent = `${liveAccuracy(state, current)}%`;
        const flags = suspiciousIds(current);
        const marked = state.clicked.filter((id) => flags.includes(id)).length;
        if (marksEl) marksEl.textContent = `Отмечено признаков: ${marked}`;
        if (caseEl) {
          caseEl.textContent = marked > 0 ? `КРАСНЫХ ФЛАГОВ: ${marked}` : 'НА ПРОВЕРКЕ';
          caseEl.classList.toggle('is-flagged', marked > 0);
        }
      }

      if (state.streak !== lastStreak) {
        lastStreak = state.streak;
        if (streakEl) {
          const visible = state.streak >= STREAK.showFrom;
          streakEl.hidden = !visible;
          if (visible && streakValueEl) streakValueEl.textContent = `СЕРИЯ ×${state.streak}`;
        }
      }
    },
    markHotspot(id, suspicious) {
      const node = docNode.querySelector<HTMLElement>(`[data-hotspot="${id}"]`);
      if (!node) return;
      node.classList.add('is-done', suspicious ? 'is-flag' : 'is-clear');
    },
    showNote(note, suspicious) {
      if (!inspectorEl) return;
      inspectorEl.textContent = note;
      inspectorEl.className = `inspector is-visible ${suspicious ? 'is-flag' : 'is-clear'}`;
      inspectorEl.classList.remove('pop');
      void inspectorEl.offsetWidth;
      inspectorEl.classList.add('pop');
    },
    showStreak(streak, bonus) {
      if (!streakEl || streak < STREAK.showFrom) return;
      streakEl.classList.remove('is-bonus');
      void streakEl.offsetWidth;
      if (bonus > 0) streakEl.classList.add('is-bonus');

      window.clearTimeout(streakTimer);
      if (bonus > 0) {
        streakTimer = window.setTimeout(() => streakEl.classList.remove('is-bonus'), 1200);
      }
    },
    destroy() {
      window.clearTimeout(streakTimer);
      window.removeEventListener('keydown', onKey);
    },
  };
}

/**
 * Номер дела: одинаковый для одной ситуации при каждом заходе,
 * но разный у разных документов.
 */
function caseNumber(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 900;
  return String(100 + hash);
}

/** Иконка настроек: чистый SVG, без внешних файлов. */
function gearIcon(): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h8M16 17h4" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="14" cy="17" r="2" />
  </svg>`;
}
