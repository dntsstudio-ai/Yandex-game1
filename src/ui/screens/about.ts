/** Модальное окно «О проекте». */
import { h } from '../dom';

export function renderAbout(onClose: () => void): HTMLElement {
  const overlay = h('div', 'overlay');
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="О проекте">
      <h2 class="modal-title">О ПРОЕКТЕ</h2>
      <p>Коррупция редко выглядит как преступление. Чаще это одна строка в обычном письме.</p>
      <p>Игра тренирует главный навык антикоррупционного комплаенса — замечать «красные флаги»: подарок заинтересованному лицу, родственника в комиссии, просьбу «ускорить за благодарность», изменение договора без обоснования.</p>
      <p>Десять документов, девяносто секунд. Отмечайте подозрительные фрагменты и решайте: пропустить или остановить. Лишний клик стоит столько же, сколько пропущенное нарушение: бдительность — не подозрительность.</p>
      <button type="button" class="btn btn--primary" data-action="close">ПОНЯТНО</button>
    </div>
  `;

  const close = () => onClose();
  overlay.querySelector('[data-action="close"]')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  return overlay;
}
