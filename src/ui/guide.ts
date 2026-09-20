/**
 * Гид игрока — ИНСПЕКТОР №04.
 *
 * Функциональный помощник, а не персонаж новеллы: показывает реплику
 * и указывает, куда смотреть. Поза — это просто картинка из
 * `public/media/guide/<поза>.webp`; файла нет — остаётся нарисованный
 * средствами CSS силуэт, и логика реплик не меняется.
 */
import { assetUrl } from '../core/assets';
import { h } from './dom';

export interface GuideOptions {
  /** Имя на бейдже. */
  name?: string;
  /** Поза: обычная или указывающая. */
  pose?: GuidePose;
}

/**
 * Позы гида. Имя позы — это и имя файла: добавить новую можно,
 * положив картинку рядом и дописав строку сюда.
 */
export const GUIDE_POSES = [
  'neutral',
  'point',
  'warn',
  'ok',
  'think',
  'time',
  'tired',
  'work',
] as const;

export type GuidePose = (typeof GUIDE_POSES)[number];

export interface Guide {
  root: HTMLElement;
  /** Показать реплику. Пустая строка прячет облако. */
  say: (text: string, pose?: GuidePose) => void;
  setPose: (pose: GuidePose) => void;
  destroy: () => void;
}

const NAME = 'ИНСПЕКТОР №04';

export function createGuide(options: GuideOptions = {}): Guide {
  const root = h('div', 'guide');
  root.innerHTML = `
    <div class="guide-figure" data-pose="neutral" aria-hidden="true">
      <span class="guide-portrait"></span>
    </div>
    <div class="guide-speech">
      <span class="guide-name">${options.name ?? NAME}</span>
      <p class="guide-text" data-guide="text"></p>
    </div>
  `;

  const figure = root.querySelector<HTMLElement>('.guide-figure');
  const portrait = root.querySelector<HTMLElement>('.guide-portrait');
  const text = root.querySelector<HTMLElement>('[data-guide="text"]');
  let popTimer = 0;

  const setPose = (pose: GuidePose) => {
    figure?.setAttribute('data-pose', pose);
    // Картинка ставится прямо на элемент: без файла свойство просто
    // не сработает, и останется нарисованный силуэт.
    if (!portrait) return;
    const url = assetUrl(`media/guide/${pose}.webp`);
    portrait.style.backgroundImage = `url("${url}")`;

    // Силуэт-заглушка убирается только после того, как картинка
    // действительно загрузилась: иначе при отсутствии файла рамка
    // осталась бы пустой.
    const probe = new Image();
    probe.addEventListener('load', () => figure?.setAttribute('data-loaded', ''));
    probe.src = url;
  };
  setPose(options.pose ?? 'neutral');

  return {
    root,
    say(value, pose) {
      if (pose) setPose(pose);
      root.classList.toggle('is-speaking', value.length > 0);
      if (!text) return;
      text.textContent = value;
      // короткая вспышка облака: помогает заметить смену реплики
      text.classList.remove('pop');
      void text.offsetWidth;
      text.classList.add('pop');
      window.clearTimeout(popTimer);
      popTimer = window.setTimeout(() => text.classList.remove('pop'), 500);
    },
    setPose,
    destroy() {
      window.clearTimeout(popTimer);
      root.remove();
    },
  };
}
