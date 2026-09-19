/** Стартовый экран. */
import { SCORING } from '../../core/rules';
import { h } from '../dom';
import { createMenuScene, type MenuScene } from '../menuScene';
import { MEDIA, assetUrl, findAsset } from '../../core/assets';

export interface StartScreenHandlers {
  onStart: () => void;
  onAbout: () => void;
  onSettings: () => void;
}

export function renderStartScreen(
  scenarioCount: number,
  handlers: StartScreenHandlers,
): { root: HTMLElement; scene: MenuScene } {
  const root = h('section', 'screen screen--start');
  root.innerHTML = `
    <div class="start-inner">
      <div class="flag-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="presentation">
          <path class="flag-pole" d="M16 6 V58" />
          <path class="flag-cloth" d="M18 9 C30 3 38 15 50 9 V30 C38 36 30 24 18 30 Z" />
        </svg>
      </div>
      <h1 class="start-title"><span>КРАСНЫЙ</span><span class="title-accent">ФЛАГ</span></h1>
      <p class="start-tagline">«Заметь то, что другие могут не заметить.»</p>

      <div class="start-actions">
        <button type="button" class="btn btn--primary" data-action="start">НАЧАТЬ ПРОВЕРКУ</button>
        <button type="button" class="btn btn--ghost" data-action="about">О ПРОЕКТЕ</button>
        <button type="button" class="btn btn--ghost" data-action="settings">НАСТРОЙКИ</button>
      </div>

      <ul class="start-rules">
        <li><span class="dot dot--green"></span>Признак риска: +${SCORING.hit}</li>
        <li><span class="dot dot--red"></span>Ошибочный клик: ${SCORING.falsePositive}</li>
        <li><span class="dot dot--blue"></span>${scenarioCount} документов · таймер на каждый</li>
      </ul>
    </div>
  `;

  // Логотип-картинка заменяет нарисованный флаг и текстовый заголовок:
  // название уже есть на самой картинке, показывать его дважды нельзя.
  void findAsset(MEDIA.logo, 'image').then((found) => {
    if (!found) return;
    const mark = root.querySelector('.flag-mark');
    if (!mark) return;
    mark.innerHTML = `<img class="logo-image" src="${assetUrl(found)}" alt="" decoding="async" />`;
    document.body.classList.add('menu-has-logo');
  });

  // Сцену монтирует контроллер — вне масштабируемой области, чтобы фон
  // занимал весь экран даже в уменьшенном альбомном режиме.
  const scene = createMenuScene();

  root.querySelector('[data-action="start"]')?.addEventListener('click', handlers.onStart);
  root.querySelector('[data-action="about"]')?.addEventListener('click', handlers.onAbout);
  root.querySelector('[data-action="settings"]')?.addEventListener('click', handlers.onSettings);
  return { root, scene };
}
