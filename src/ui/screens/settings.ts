/** Модальное окно настроек: музыка, звуки, громкость. */
import { settings, type Settings } from '../../core/settings';
import { h } from '../dom';

export function renderSettings(onClose: () => void, onChange: (next: Settings) => void): HTMLElement {
  const current = settings.get();
  const overlay = h('div', 'overlay');
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Настройки">
      <h2 class="modal-title">НАСТРОЙКИ</h2>

      <label class="switch">
        <span class="switch-text">
          <strong>Фоновая музыка</strong>
          <small>Спокойная тема во время проверки документов</small>
        </span>
        <input type="checkbox" data-setting="music" ${current.music ? 'checked' : ''} />
        <span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
      </label>

      <label class="switch">
        <span class="switch-text">
          <strong>Звуковые эффекты</strong>
          <small>Отклик на клики, решения и таймер</small>
        </span>
        <input type="checkbox" data-setting="sound" ${current.sound ? 'checked' : ''} />
        <span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span>
      </label>

      <label class="slider">
        <span class="switch-text">
          <strong>Громкость</strong>
          <small><span data-volume-label>${Math.round(current.volume * 100)}</span>%</small>
        </span>
        <input type="range" min="0" max="100" step="5" value="${Math.round(current.volume * 100)}"
          data-setting="volume" aria-label="Громкость" />
      </label>

      <button type="button" class="btn btn--primary" data-action="close">ГОТОВО</button>
    </div>
  `;

  overlay.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.setting;
      if (key === 'volume') {
        const volume = Number(input.value) / 100;
        const label = overlay.querySelector('[data-volume-label]');
        if (label) label.textContent = String(Math.round(volume * 100));
        onChange(settings.update({ volume }));
        return;
      }
      if (key === 'music' || key === 'sound') {
        onChange(settings.update({ [key]: input.checked } as Partial<Settings>));
      }
    });
  });

  overlay.querySelector('[data-action="close"]')?.addEventListener('click', onClose);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) onClose();
  });
  return overlay;
}
