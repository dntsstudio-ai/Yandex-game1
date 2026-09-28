/** Экран проверки документа: HUD, папка дела, карточка документа, решения. */
import { SCORING, STREAK, liveAccuracy, suspiciousIds } from '../../core/rules';
import type { GameMode } from '../../core/settings';
import type { Decision, GameState, Scenario } from '../../core/types';
import { formatTime, h } from '../dom';
import { renderDocument } from '../documentView';
import { icon } from '../icons';

/**
 * Сколько времени даётся на «передумать» в режиме для зрелых.
 * Десять секунд — достаточно, чтобы перечитать спорную строку, и мало,
 * чтобы превратить паузу в способ отдохнуть от таймера.
 */
export const CONFIRM_MS = 10_000;

/**
 * Защита от прокликов: пока идёт этот интервал, повторное нажатие
 * «подтвердить» или «изменить» игнорируется. Без неё двойной клик по
 * «подтвердить» успевал открыть и тут же отменить отсчёт.
 */
const CLICK_GUARD_MS = 500;

/**
 * Подписи во время отсчёта — по убыванию оставшихся секунд.
 * Смысл не в информации, а в сомнении: именно в эти секунды игрок
 * последний раз может передумать.
 */
const CONFIRM_LINES: Array<{ from: number; text: string }> = [
  { from: 10, text: 'Решение принято. Ещё можно передумать.' },
  { from: 8, text: 'А вы уверены в своих ответах?' },
  { from: 6, text: 'Ничего не осталось непрочитанным?' },
  { from: 4, text: 'Через пару секунд изменить будет нельзя.' },
  { from: 2, text: 'Ответы фиксируются…' },
];

export function confirmLine(secondsLeft: number): string {
  return CONFIRM_LINES.find((line) => secondsLeft >= line.from)?.text ?? CONFIRM_LINES[CONFIRM_LINES.length - 1].text;
}

export interface GameScreenHandlers {
  onHotspot: (id: string, element: HTMLElement) => void;
  onDecision: (decision: Decision) => void;
  onSettings: () => void;
  /** Запрос подсказки; возвращает признак, к которому подвести игрока. */
  onHint: () => string | null;
  /** Переключение увеличения документа — нужно для звука. */
  onZoom: (zoomed: boolean) => void;
  /** Выбран вариант ответа в режиме для зрелых — с него же идёт отсчёт. */
  onSelect?: (decision: Decision) => void;
  /** Начался отсчёт подтверждения: время документа замирает. */
  onConfirmStart?: () => void;
  /** Отсчёт отменён кнопкой «изменить». */
  onConfirmCancel?: () => void;
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
  mode: GameMode = 'young',
): GameScreen {
  const mature = mode === 'mature';
  const root = h('section', `screen screen--game screen--${mode}`);
  root.innerHTML = `
    <header class="hud">
      <div class="hud-stats">
        <div class="hud-item hud-item--time">
          <span class="hud-label">${icon('time')}<b data-hud="time-label">${
            mature ? 'На раздумье' : 'На документ'
          }</b></span>
          <span class="hud-value" data-hud="time">${mature ? '—' : '1:30'}</span>
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
          <button type="button" class="btn btn--pass" data-decision="pass"
            ${mature ? 'aria-pressed="false"' : ''}>ПРОПУСТИТЬ</button>
          <button type="button" class="btn btn--stop" data-decision="stop"
            ${mature ? 'aria-pressed="false"' : ''}>ОСТАНОВИТЬ</button>
        </div>
        ${
          mature
            ? `<div class="confirm" data-confirm>
                 <p class="confirm-line" data-confirm-line>
                   Выберите решение — после выбора будет ещё ${CONFIRM_MS / 1000} секунд, чтобы передумать.
                 </p>
                 <span class="confirm-track" aria-hidden="true">
                   <span class="confirm-fill" data-confirm-fill></span>
                 </span>
                 <div class="confirm-buttons">
                   <button type="button" class="btn btn--confirm" data-action="commit" disabled>
                     ПОДТВЕРДИТЬ
                   </button>
                   <button type="button" class="btn btn--change" data-action="change" disabled>
                     ИЗМЕНИТЬ
                   </button>
                 </div>
               </div>`
            : ''
        }
      </footer>
    </div>
  `;

  const slot = root.querySelector('.doc-slot');
  const docNode = renderDocument(scenario);
  slot?.appendChild(docNode);

  // ---------- решение по документу ----------
  // В режиме для молодых кнопка сразу закрывает документ. В режиме для
  // зрелых у документа лимита времени нет вовсе: время появляется только
  // после выбора — это окно на «передумать». Ведёт его движок, экран лишь
  // показывает остаток, поэтому второго таймера здесь нет.
  let locked = false;
  let selected: Decision | null = null;
  let lastGuardAt = 0;
  let lastSecondShown = -1;

  const decisionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-decision]'));
  const confirmBox = root.querySelector<HTMLElement>('[data-confirm]');
  const commitButton = root.querySelector<HTMLButtonElement>('[data-action="commit"]');
  const changeButton = root.querySelector<HTMLButtonElement>('[data-action="change"]');
  const confirmLineEl = root.querySelector<HTMLElement>('[data-confirm-line]');
  const confirmFill = root.querySelector<HTMLElement>('[data-confirm-fill]');

  const IDLE_LINE = `Времени на документ нет — читайте спокойно. После выбора будет ${CONFIRM_MS / 1000} секунд, чтобы передумать.`;

  docNode.addEventListener('click', (event) => {
    if (locked) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hotspot]');
    if (!target || target.classList.contains('is-done')) return;
    handlers.onHotspot(target.dataset.hotspot ?? '', target);
  });

  /**
   * Нажатие принято? Пока не истёк интервал защиты — нет.
   * Счётчик общий на все кнопки решения: двойной клик по одной из них
   * не должен попадать по соседней, вставшей на её место.
   */
  const guardPassed = (): boolean => {
    const now = performance.now();
    if (now - lastGuardAt < CLICK_GUARD_MS) return false;
    lastGuardAt = now;
    return true;
  };

  /** Возврат к выбору: окно закрывается, документ снова открыт. */
  const cancelConfirm = () => {
    locked = false;
    selected = null;
    lastSecondShown = -1;
    root.classList.remove('is-locked');
    confirmBox?.classList.remove('is-counting');
    for (const button of decisionButtons) {
      button.disabled = false;
      button.setAttribute('aria-pressed', 'false');
      button.classList.remove('is-picked');
    }
    if (commitButton) commitButton.disabled = true;
    if (changeButton) changeButton.disabled = true;
    if (confirmFill) confirmFill.style.transform = 'scaleX(0)';
    if (confirmLineEl) confirmLineEl.textContent = IDLE_LINE;
    handlers.onConfirmCancel?.();
  };

  /** Ответ зафиксирован досрочно, не дожидаясь конца окна. */
  const commit = () => {
    if (!selected) return;
    const decision = selected;
    if (confirmLineEl) confirmLineEl.textContent = 'Ответ засчитан.';
    if (commitButton) commitButton.disabled = true;
    if (changeButton) changeButton.disabled = true;
    handlers.onDecision(decision);
  };

  /** Выбор варианта: он же запускает окно на «передумать». */
  const select = (decision: Decision) => {
    selected = decision;
    locked = true;
    lastSecondShown = -1;
    root.classList.add('is-locked');
    confirmBox?.classList.add('is-counting');

    for (const button of decisionButtons) {
      const own = button.dataset.decision === 'stop' ? 'stop' : 'pass';
      button.setAttribute('aria-pressed', String(own === decision));
      button.classList.toggle('is-picked', own === decision);
      button.disabled = true;
    }
    if (commitButton) commitButton.disabled = false;
    if (changeButton) changeButton.disabled = false;

    handlers.onSelect?.(decision);
  };

  for (const button of decisionButtons) {
    button.addEventListener('click', () => {
      const decision: Decision = button.dataset.decision === 'stop' ? 'stop' : 'pass';
      if (!mature) {
        handlers.onDecision(decision);
        return;
      }
      if (locked || !guardPassed()) return;
      select(decision);
    });
  }

  commitButton?.addEventListener('click', () => {
    if (!locked || !guardPassed()) return;
    commit();
  });

  changeButton?.addEventListener('click', () => {
    if (!locked || !guardPassed()) return;
    cancelConfirm();
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
    // Во время отсчёта подтверждения документ уже закрыт для правок.
    if (locked) return;
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
  const timeLabelEl = root.querySelector<HTMLElement>('[data-hud="time-label"]');
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
      // В режиме для зрелых счётчик показывает не лимит документа, которого
      // нет, а остаток окна на «передумать» — и только пока оно идёт.
      const counting = !mature || locked;
      const ratio = counting
        ? Math.max(0, state.timeLeftMs / Math.max(1, state.roundDurationMs))
        : 1;
      const low = counting && state.timeLeftMs <= (mature ? 4000 : 10_000);

      const time = counting ? formatTime(state.timeLeftMs) : '—';
      if (timeEl && time !== lastTime) {
        timeEl.textContent = time;
        lastTime = time;
      }
      if (timeLabelEl && mature) {
        const label = locked ? 'На раздумье' : 'Без ограничения';
        if (timeLabelEl.textContent !== label) timeLabelEl.textContent = label;
      }
      if (low !== lastLow) {
        timeEl?.classList.toggle('is-low', low);
        timeBar?.classList.toggle('is-low', low);
        lastLow = low;
      }
      // шкала — это transform, он дёшев и обновляется каждый кадр
      if (timeBar) timeBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
      root.classList.toggle('is-untimed', mature && !locked);

      // Полоса и подпись окна подтверждения питаются от того же остатка:
      // второго отсчёта в экране нет, иначе они бы разъезжались.
      if (locked) {
        if (confirmFill) {
          confirmFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
        }
        const seconds = Math.ceil(state.timeLeftMs / 1000);
        if (seconds !== lastSecondShown) {
          lastSecondShown = seconds;
          if (confirmLineEl) confirmLineEl.textContent = `${confirmLine(seconds)} · ${seconds}`;
        }
      }

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
