/** Экран проверки документа: HUD, карточка документа, решения. */
import { liveAccuracy, suspiciousIds } from '../../core/rules';
import type { Decision, GameState, Scenario } from '../../core/types';
import { formatTime, h } from '../dom';
import { renderDocument } from '../documentView';

export interface GameScreenHandlers {
  onHotspot: (id: string, element: HTMLElement) => void;
  onDecision: (decision: Decision) => void;
  onSettings: () => void;
}

export interface GameScreen {
  root: HTMLElement;
  update: (state: GameState, scenario: Scenario, total: number) => void;
  markHotspot: (id: string, suspicious: boolean) => void;
  showNote: (note: string, suspicious: boolean) => void;
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
          <span class="hud-label">На документ</span>
          <span class="hud-value" data-hud="time">1:30</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">Очки</span>
          <span class="hud-value" data-hud="score">0</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">Документ</span>
          <span class="hud-value" data-hud="index">1/${total}</span>
        </div>
        <div class="hud-item">
          <span class="hud-label">Точность</span>
          <span class="hud-value" data-hud="accuracy">100%</span>
        </div>
        <button type="button" class="sound-btn" data-action="settings" aria-label="Настройки">
          ${gearIcon()}
        </button>
      </div>
      <div class="timebar"><span class="timebar-fill" data-hud="timebar"></span></div>
    </header>

    <main class="stage">
      <p class="brief"><span class="brief-mark">задача</span>${scenario.brief}</p>
      <div class="doc-slot"></div>
    </main>

    <div class="dock">
      <p class="inspector" data-hud="inspector" aria-live="polite"></p>
      <footer class="actions">
        <span class="marks" data-hud="marks">Отмечено признаков: 0</span>
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

  const timeEl = root.querySelector<HTMLElement>('[data-hud="time"]');
  const timeBar = root.querySelector<HTMLElement>('[data-hud="timebar"]');
  const scoreEl = root.querySelector<HTMLElement>('[data-hud="score"]');
  const indexEl = root.querySelector<HTMLElement>('[data-hud="index"]');
  const accuracyEl = root.querySelector<HTMLElement>('[data-hud="accuracy"]');
  const marksEl = root.querySelector<HTMLElement>('[data-hud="marks"]');
  const inspectorEl = root.querySelector<HTMLElement>('[data-hud="inspector"]');

  // Значения HUD обновляются на каждом кадре таймера, поэтому пишем в DOM
  // только при реальном изменении: иначе браузер пересчитывает текст
  // шестьдесят раз в секунду и кадры игрового экрана проседают.
  let lastTime = '';
  let lastLow = false;
  let lastScore = Number.NaN;
  let lastIndex = '';
  let lastClicks = -1;

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

      // точность и счётчик отметок меняются только при клике
      if (state.clicked.length !== lastClicks) {
        lastClicks = state.clicked.length;
        if (accuracyEl) accuracyEl.textContent = `${liveAccuracy(state, current)}%`;
        if (marksEl) {
          const flags = suspiciousIds(current);
          const marked = state.clicked.filter((id) => flags.includes(id)).length;
          marksEl.textContent = `Отмечено признаков: ${marked}`;
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
  };
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
