/**
 * Режим экрана.
 *
 * На телефонах и планшетах в альбомной ориентации игра не перестраивает
 * вёрстку, а показывает ту же сцену, что и на компьютере, целиком
 * уменьшенной под экран: игрок переворачивает телефон и играет.
 * В книжной ориентации предлагается повернуть устройство, но играть
 * можно и так — тогда работает обычная адаптивная вёрстка.
 */

/** Размер виртуальной сцены, под который рассчитан интерфейс. */
export const STAGE = { width: 1440, height: 780 };

const PORTRAIT_CHOICE = 'red-flag:portrait-ok';

export interface ViewportController {
  destroy: () => void;
}

export function setupViewport(stage: HTMLElement, hintHost: HTMLElement): ViewportController {
  let portraitAccepted = readPortraitChoice();
  let hint: HTMLElement | null = null;

  const apply = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const landscape = width > height;
    const shortSide = Math.min(width, height);

    // Уменьшаем сцену только на небольших сенсорных экранах в альбомной
    // ориентации: на компьютере обычная резиновая вёрстка выглядит лучше.
    const fit = coarse && landscape && shortSide <= 820;

    document.body.classList.toggle('is-fit', fit);

    if (fit) {
      const scale = Math.min(width / STAGE.width, height / STAGE.height);
      stage.style.setProperty('--fit-scale', scale.toFixed(4));
    } else {
      stage.style.removeProperty('--fit-scale');
    }

    const needHint = coarse && !landscape && !portraitAccepted && shortSide <= 820;
    toggleHint(needHint);
  };

  const toggleHint = (visible: boolean) => {
    if (visible && !hint) {
      hint = renderRotateHint(() => {
        portraitAccepted = true;
        writePortraitChoice();
        toggleHint(false);
      });
      hintHost.appendChild(hint);
    } else if (!visible && hint) {
      hint.remove();
      hint = null;
    }
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);

  return {
    destroy() {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      hint?.remove();
    },
  };
}

/**
 * Подсказка «поверните экран».
 *
 * Именно плашка снизу, а не полноэкранный слой: раньше подсказка
 * перекрывала меню целиком, и до неё игра выглядела неработающей.
 * Теперь меню видно и им можно пользоваться, не закрывая подсказку.
 */
function renderRotateHint(onStay: () => void): HTMLElement {
  const node = document.createElement('div');
  node.className = 'rotate-hint';
  node.innerHTML = `
    <div class="rotate-inner">
      <svg class="rotate-icon" viewBox="0 0 48 40" aria-hidden="true">
        <rect class="rotate-phone" x="17" y="4" width="14" height="28" rx="3" />
        <path class="rotate-arrow" d="M38 12a15 15 0 0 1-3 13" />
        <path class="rotate-arrow" d="M35 25l4 1-1-4" />
      </svg>
      <p class="rotate-text"><b>Поверните экран</b>Горизонтально удобнее: документ виден целиком</p>
      <button type="button" class="rotate-close" data-action="stay" aria-label="Скрыть подсказку">✕</button>
    </div>
  `;
  node.querySelector('[data-action="stay"]')?.addEventListener('click', onStay);
  return node;
}

function readPortraitChoice(): boolean {
  try {
    return localStorage.getItem(PORTRAIT_CHOICE) === '1';
  } catch {
    return false;
  }
}

function writePortraitChoice(): void {
  try {
    localStorage.setItem(PORTRAIT_CHOICE, '1');
  } catch {
    // приватный режим — подсказка просто появится снова
  }
}
