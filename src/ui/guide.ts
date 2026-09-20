/**
 * Гид игрока — ИНСПЕКТОР №04.
 *
 * Фигура и реплика разведены: фигура стоит сама по себе, без рамки и
 * подложки, а говорит она в отдельную панель. Так один и тот же гид
 * работает и в новелльной сцене обучения, и в любом другом месте.
 *
 * Поза — это имя файла в `public/media/guide`. Файла нет — остаётся
 * нарисованный средствами CSS силуэт, и логика реплик не меняется.
 */
import { assetUrl } from '../core/assets';
import { voice, type VoiceState } from '../core/sound/voice';
import { h } from './dom';

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
  /** Фигура: ставится в сцену отдельно от реплики. */
  root: HTMLElement;
  setPose: (pose: GuidePose) => void;
  /** Короткий «наезд»: фигура подаётся вперёд. */
  lean: (on: boolean) => void;
  destroy: () => void;
}

export const GUIDE_NAME = 'ИНСПЕКТОР №04';

export function createGuide(pose: GuidePose = 'neutral'): Guide {
  const root = h('div', 'guide-figure');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<span class="guide-portrait"></span>';

  const portrait = root.querySelector<HTMLElement>('.guide-portrait');

  const setPose = (next: GuidePose) => {
    root.setAttribute('data-pose', next);
    if (!portrait) return;

    const url = assetUrl(`media/guide/${next}.webp`);
    portrait.style.backgroundImage = `url("${url}")`;

    // Силуэт-заглушка убирается только после того, как картинка
    // действительно загрузилась: иначе при отсутствии файла осталось бы
    // пустое место.
    const probe = new Image();
    probe.addEventListener('load', () => root.setAttribute('data-loaded', ''));
    probe.src = url;
  };

  setPose(pose);

  return {
    root,
    setPose,
    lean(on) {
      root.classList.toggle('is-leaning', on);
    },
    destroy() {
      root.remove();
    },
  };
}

export interface SpeechBar {
  root: HTMLElement;
  /**
   * Показать реплику. Текст печатается посимвольно; повторный вызов
   * say() или skip() дописывает его целиком.
   */
  say: (text: string, onDone?: () => void) => void;
  /** Дописать текущую реплику целиком. Возвращает true, если было что дописывать. */
  skip: () => boolean;
  destroy: () => void;
}

/** Скорость печати, мс на символ. */
const TYPE_MS = 22;

/** Длинная полоса реплики — как в визуальной новелле. */
export function createSpeechBar(name = GUIDE_NAME): SpeechBar {
  const root = h('div', 'speech');
  root.innerHTML = `
    <span class="speech-name">${name}</span>
    <button type="button" class="speech-voice" data-speech="voice" hidden
      aria-label="Прослушать реплику"></button>
    <p class="speech-text" data-speech="text"></p>
    <span class="speech-next" data-speech="next" hidden>ДАЛЬШЕ</span>
  `;

  const textEl = root.querySelector<HTMLElement>('[data-speech="text"]');
  const nextEl = root.querySelector<HTMLElement>('[data-speech="next"]');
  const voiceButton = root.querySelector<HTMLButtonElement>('[data-speech="voice"]');

  // Кнопка меняет смысл по состоянию: пока реплика звучит — пауза,
  // на паузе — продолжить, после конца — прослушать снова.
  const paintVoice = (state: VoiceState) => {
    if (!voiceButton) return;
    voiceButton.hidden = !voice.hasClip();
    voiceButton.dataset.state = state;
    voiceButton.textContent =
      state === 'playing' ? 'ПАУЗА' : state === 'paused' ? 'ПРОДОЛЖИТЬ' : 'ПРОСЛУШАТЬ СНОВА';
  };

  const unsubscribe = voice.subscribe(paintVoice);

  voiceButton?.addEventListener('click', (event) => {
    // нажатие по кнопке не должно листать реплику
    event.stopPropagation();
    // Пока реплика звучит, запустить её заново нельзя — только пауза.
    if (voice.getState() === 'idle') voice.replay();
    else voice.toggle();
  });

  let timer = 0;
  let full = '';
  let shown = 0;
  let done: (() => void) | null = null;

  const reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finish = () => {
    window.clearInterval(timer);
    timer = 0;
    shown = full.length;
    if (textEl) textEl.textContent = full;
    if (nextEl) nextEl.hidden = false;
    const callback = done;
    done = null;
    callback?.();
  };

  return {
    root,
    say(text, onDone) {
      window.clearInterval(timer);
      paintVoice(voice.getState());
      full = text;
      shown = 0;
      done = onDone ?? null;
      if (nextEl) nextEl.hidden = true;
      if (textEl) textEl.textContent = '';

      if (reduceMotion || text.length === 0) {
        finish();
        return;
      }

      timer = window.setInterval(() => {
        shown += 1;
        if (textEl) textEl.textContent = full.slice(0, shown);
        if (shown >= full.length) finish();
      }, TYPE_MS);
    },
    skip() {
      if (timer === 0) return false;
      finish();
      return true;
    },
    destroy() {
      window.clearInterval(timer);
      unsubscribe();
      root.remove();
    },
  };
}
