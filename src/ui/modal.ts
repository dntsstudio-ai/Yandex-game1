/**
 * Общая оболочка модальных окон.
 *
 * Все окна игры — «О проекте», настройки, разбор ошибок, разбор
 * результата — устроены одинаково: неподвижная шапка, прокручиваемая
 * середина и полоса кнопок снизу. Это важно не ради единообразия,
 * а ради телефона в альбомной ориентации: там по высоте остаётся
 * около трёхсот точек, и окно без отдельной прокручиваемой середины
 * просто обрезается.
 *
 * Окно монтируется вне масштабируемой сцены (см. openOverlay в app.ts):
 * внутри неё position: fixed отсчитывался бы от сцены 1440×780, а dvh
 * пересчитывался бы её масштабом, и окно выходило вчетверо мельче.
 */
import { h } from './dom';

export interface ModalOptions {
  /** Заголовок окна. */
  title: string;
  /** Подпись для программ чтения с экрана; по умолчанию — заголовок. */
  label?: string;
  /** Дополнительный класс окна: modal--about, modal--verdict и т. п. */
  variant?: string;
  /** Содержимое середины окна. */
  body: string;
  /** Кнопки снизу. По умолчанию одна — «ПОНЯТНО». */
  actions?: string;
}

export interface Modal {
  root: HTMLElement;
  /** Середина окна — сюда вешаются обработчики содержимого. */
  body: HTMLElement;
  close: () => void;
}

/**
 * Собирает окно и закрывает его по кнопке, клику по фону и клавише Esc.
 * Возвращает корневой элемент; монтирует его вызывающая сторона.
 */
export function createModal(options: ModalOptions, onClose: () => void): Modal {
  const overlay = h('div', 'overlay');
  const label = options.label ?? options.title;

  overlay.innerHTML = `
    <div class="modal${options.variant ? ` ${options.variant}` : ''}" role="dialog"
      aria-modal="true" aria-label="${label}">
      <h2 class="modal-title">${options.title}</h2>
      <div class="modal-body">${options.body}</div>
      <div class="modal-foot">
        ${options.actions ?? '<button type="button" class="btn btn--primary" data-action="close">ПОНЯТНО</button>'}
      </div>
    </div>
  `;

  const card = overlay.querySelector<HTMLElement>('.modal');
  const scroller = overlay.querySelector<HTMLElement>('.modal-body');

  /**
   * Признак «текст продолжается ниже».
   *
   * Без него длинное окно выглядит законченным: на месте обрыва стоит
   * полоса кнопок, и дочитать никто не догадывается.
   */
  const updateHint = () => {
    if (!card || !scroller) return;
    const more = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 4;
    card.classList.toggle('has-more', more);
  };

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', updateHint);
    overlay.remove();
    onClose();
  };

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') close();
  }

  overlay.querySelectorAll('[data-action="close"]').forEach((button) => {
    button.addEventListener('click', close);
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener('keydown', onKey);

  if (!scroller) throw new Error('Не собралась середина окна');

  scroller.addEventListener('scroll', updateHint, { passive: true });
  window.addEventListener('resize', updateHint);
  // Размеры известны только после вставки в документ — ждём кадр.
  requestAnimationFrame(updateHint);

  return { root: overlay, body: scroller, close };
}
