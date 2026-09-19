/** Экран проверки документа: HUD, карточка документа, решения. */
import { GAME_DURATION_MS, liveAccuracy, suspiciousIds } from '../../core/rules';
import type { Decision, GameState, Scenario } from '../../core/types';
import { formatTime, h } from '../dom';
import { renderDocument } from '../documentView';

export interface GameScreenHandlers {
  onHotspot: (id: string, element: HTMLElement) => void;
  onDecision: (decision: Decision) => void;
  onToggleSound: () => void;
}

export interface GameScreen {
  root: HTMLElement;
  update: (state: GameState, scenario: Scenario, total: number) => void;
  markHotspot: (id: string, suspicious: boolean) => void;
  showNote: (note: string, suspicious: boolean) => void;
  setSoundIcon: (enabled: boolean) => void;
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
          <span class="hud-label">Время</span>
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
        <button type="button" class="sound-btn" data-action="sound" aria-label="Звук" data-hud="sound">
          ${soundIcon(true)}
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

  root.querySelector('[data-action="sound"]')?.addEventListener('click', handlers.onToggleSound);

  const timeEl = root.querySelector<HTMLElement>('[data-hud="time"]');
  const timeBar = root.querySelector<HTMLElement>('[data-hud="timebar"]');
  const scoreEl = root.querySelector<HTMLElement>('[data-hud="score"]');
  const indexEl = root.querySelector<HTMLElement>('[data-hud="index"]');
  const accuracyEl = root.querySelector<HTMLElement>('[data-hud="accuracy"]');
  const marksEl = root.querySelector<HTMLElement>('[data-hud="marks"]');
  const inspectorEl = root.querySelector<HTMLElement>('[data-hud="inspector"]');
  const soundEl = root.querySelector<HTMLElement>('[data-hud="sound"]');

  return {
    root,
    update(state, current, totalCount) {
      const ratio = Math.max(0, state.timeLeftMs / GAME_DURATION_MS);
      if (timeEl) {
        timeEl.textContent = formatTime(state.timeLeftMs);
        timeEl.classList.toggle('is-low', state.timeLeftMs <= 15_000);
      }
      if (timeBar) {
        timeBar.style.transform = `scaleX(${ratio})`;
        timeBar.classList.toggle('is-low', state.timeLeftMs <= 15_000);
      }
      if (scoreEl) {
        scoreEl.textContent = String(state.score);
        scoreEl.classList.toggle('is-negative', state.score < 0);
      }
      if (indexEl) indexEl.textContent = `${state.index + 1}/${totalCount}`;
      if (accuracyEl) accuracyEl.textContent = `${liveAccuracy(state, current)}%`;
      if (marksEl) {
        const flags = suspiciousIds(current);
        const marked = state.clicked.filter((id) => flags.includes(id)).length;
        marksEl.textContent = `Отмечено признаков: ${marked}`;
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
    setSoundIcon(enabled) {
      if (soundEl) soundEl.innerHTML = soundIcon(enabled);
      soundEl?.setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
    },
  };
}

/** Иконка звука: чистый SVG, без внешних файлов. */
function soundIcon(enabled: boolean): string {
  const waves = enabled
    ? '<path d="M14.5 7.5a5 5 0 0 1 0 9" /><path d="M17 5a8.5 8.5 0 0 1 0 14" />'
    : '<path d="M16 9l6 6" /><path d="M22 9l-6 6" />';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />${waves}
  </svg>`;
}
