/**
 * Плашка «нет связи».
 *
 * Пока связь не восстановится, играть нельзя: время на документ идёт,
 * а звук и картинки до игрока не доезжают. Поэтому плашка перекрывает
 * всю игру, а не висит углом, — иначе таймер продолжал бы съедать
 * секунды за спиной у игрока.
 *
 * Живёт вне масштабируемой сцены, в конце body: сцена в альбомном режиме
 * телефона уменьшена, и плашка внутри неё уменьшалась бы вместе с ней.
 */
import type { NetworkState } from '../core/network';
import { h } from './dom';

export interface NetGuard {
  /** Показать или убрать плашку. */
  setState: (state: NetworkState) => void;
  destroy: () => void;
}

const TEXT: Record<Exclude<NetworkState, 'online'>, string> = {
  offline: 'Связь потеряна. Игра остановлена, ничего не потеряется.',
  weak: 'Связь слишком медленная, материалы игры не успевают загрузиться.',
};

export function createNetGuard(host: HTMLElement, onRetry: () => void): NetGuard {
  const node = h('div', 'net-guard');
  node.setAttribute('role', 'alertdialog');
  node.setAttribute('aria-live', 'assertive');
  node.hidden = true;
  node.innerHTML = `
    <div class="net-card">
      <svg class="net-icon" viewBox="0 0 64 56" aria-hidden="true">
        <path class="net-wave net-wave--1" d="M6 18C13.5 11.5 22.3 8 32 8s18.5 3.5 26 10" />
        <path class="net-wave net-wave--2" d="M14.5 28.5C19.3 24.2 25.3 21.8 32 21.8s12.7 2.4 17.5 6.7" />
        <path class="net-wave net-wave--3" d="M23 38.5c2.6-2.3 5.7-3.5 9-3.5s6.4 1.2 9 3.5" />
        <circle class="net-dot" cx="32" cy="47" r="3.4" />
        <!-- Подложка под крестом: без неё он сливается с дугами сигнала. -->
        <circle class="net-cross-bg" cx="52" cy="42" r="11.5" />
        <path class="net-cross" d="M47.5 37.5l9 9M56.5 37.5l-9 9" />
      </svg>
      <p class="net-title">Плохое соединение с интернетом</p>
      <p class="net-text" data-net-text></p>
      <p class="net-wait">Проверка связи<span class="net-dots"><i></i><i></i><i></i></span></p>
      <button type="button" class="btn btn--primary net-retry" data-action="retry">
        ПРОВЕРИТЬ СНОВА
      </button>
    </div>
  `;

  node.querySelector('[data-action="retry"]')?.addEventListener('click', onRetry);
  host.appendChild(node);

  const textEl = node.querySelector<HTMLElement>('[data-net-text]');

  return {
    setState(state) {
      const blocked = state !== 'online';
      node.hidden = !blocked;
      document.body.classList.toggle('is-netblock', blocked);
      if (blocked && textEl) textEl.textContent = TEXT[state];
    },
    destroy() {
      document.body.classList.remove('is-netblock');
      node.remove();
    },
  };
}
