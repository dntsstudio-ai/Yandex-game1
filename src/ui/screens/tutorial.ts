/**
 * Обучение в духе визуальной новеллы.
 *
 * Инспектор стоит слева без рамки и подложки, говорит в длинную полосу
 * внизу, демонстрация раскрывается над ней. Сначала знакомство, потом
 * выбор: пройти обучение или сразу за работу.
 *
 * Обучение живёт отдельно от движка: у него свой маленький документ,
 * свои клики и свой таймер. Основной счёт оно не трогает, поэтому
 * игровой цикл и правила остаются нетронутыми.
 */
import { voice, type VoiceClip } from '../../core/sound/voice';
import type { Scenario } from '../../core/types';
import { h } from '../dom';
import { renderDocument } from '../documentView';
import { createGuide, createSpeechBar, type Guide, type GuidePose, type SpeechBar } from '../guide';
import { icon } from '../icons';

export interface TutorialHandlers {
  /** Обучение закончено или пропущено — начинаем партию. */
  onFinish: () => void;
  /** Звук: верная отметка. */
  onHit: () => void;
  /** Звук: ошибочная отметка. */
  onMiss: () => void;
  /** Звук: нажатие кнопки. */
  onClick: () => void;
}

export interface TutorialScreen {
  root: HTMLElement;
  destroy: () => void;
}

/** Учебный документ: одно нарушение и один нормальный фрагмент. */
const LESSON: Scenario = {
  id: 'tutorial',
  title: 'Заявка на закупку',
  kind: 'form',
  source: 'Учебный документ · отдел снабжения',
  brief: 'Учебный документ',
  blocks: [
    {
      type: 'fields',
      rows: [
        { label: 'Заявитель', value: 'Отдел снабжения' },
        { label: 'Предмет', value: '{{t-normal}}' },
      ],
    },
    {
      type: 'lines',
      lines: [
        { text: 'Прошу согласовать закупку у единственного поставщика.' },
        { text: 'Основание: {{t-flag}}' },
        { kind: 'meta', text: 'Согласовано отделом снабжения.' },
      ],
    },
  ],
  hotspots: [
    {
      id: 't-flag',
      text: 'поставщика рекомендовал руководитель, конкурс не проводился',
      suspicious: true,
      note: 'Вот он, красный флаг: решение приняли без конкурса, по личной рекомендации.',
    },
    {
      id: 't-normal',
      text: 'канцелярские товары на 40 000 ₽',
      suspicious: false,
      note: 'А это обычные данные. Отмечать их не нужно — ошибка отнимает очки.',
    },
  ],
  correctDecision: 'stop',
  explanation: '',
};

/** Реплика: текст, поза и озвучка. */
interface Line {
  text: string;
  pose: GuidePose;
  voice?: VoiceClip;
}

/**
 * Границы фраз в общей записи обучения.
 *
 * Все десять фраз записаны одним файлом, и нарезать их на отдельные mp3
 * без перекодирования нельзя, поэтому запоминаются отрезки. Границы
 * найдены по паузам в записи; если фраза начнёт звучать не под своей
 * строкой, править нужно здесь — переподготавливать файл не придётся.
 */
const LESSON_VOICE = 'voice/lesson.mp3';
const LESSON_CUTS: Array<[number, number]> = [
  [0.0, 8.7],
  [8.85, 14.3],
  [14.6, 18.75],
  [18.95, 22.8],
  [23.0, 28.3],
  [28.8, 31.15],
  [31.45, 34.45],
  [34.85, 40.65],
  [41.15, 45.55],
  [45.9, 50.3],
  [50.5, 55.2],
  [55.5, 59.25],
  [59.45, 63.9],
];

/** Отрезок записи обучения по номеру фразы. */
function lesson(index: number): VoiceClip | undefined {
  const cut = LESSON_CUTS[index];
  return cut ? { src: LESSON_VOICE, start: cut[0], end: cut[1] } : undefined;
}

/** Знакомство до выбора. */
const INTRO: Line[] = [
  { text: 'Ах... Кого там ещё к нам занесло?', pose: 'tired', voice: { src: 'voice/intro-1.mp3' } },
  { text: 'А, это ты? Новый инспектор? Отлично.', pose: 'ok', voice: { src: 'voice/intro-2.mp3' } },
  {
    text: 'Ты тут новенький? Показать, как всё устроено?',
    pose: 'think',
    voice: { src: 'voice/intro-3.mp3' },
  },
];

/** Что говорит инспектор, если обучение пропустили. */
const ORDER: Line[] = [
  { text: 'Не новенький, значит. Ну смотри.', pose: 'neutral', voice: { src: 'voice/order-1.mp3' } },
  {
    text: 'Тогда за работу! Чтоб мир стал чище!',
    pose: 'point',
    voice: { src: 'voice/order-2.mp3' },
  },
];

interface Slide {
  title: string;
  /** Реплики инспектора: показываются по очереди. */
  lines: Line[];
  /** Что показывать над полосой реплики. */
  stage: 'doc' | 'decision' | 'timer' | 'none';
  /** Какой фрагмент ждём от игрока, чтобы пойти дальше. */
  expect?: 't-flag' | 't-normal';
}

const SLIDES: Slide[] = [
  {
    title: 'НАЙДИ ПРИЗНАК РИСКА',
    lines: [
      {
        text: 'Смотри внимательно. Подозрительный кусок текста отмечают нажатием.',
        pose: 'work',
        voice: lesson(0),
      },
      { text: 'Вот этот я подсветил для примера. Жми на него.', pose: 'point', voice: lesson(1) },
    ],
    stage: 'doc',
    expect: 't-flag',
  },
  {
    title: 'БУДЬ ВНИМАТЕЛЕН',
    lines: [
      {
        text: 'Только не жми всё подряд. В документе полно обычных данных.',
        pose: 'think',
        voice: lesson(2),
      },
      {
        text: 'Попробуй нажать на обычную строку — посмотрим, что выйдет.',
        pose: 'neutral',
        voice: lesson(3),
      },
    ],
    stage: 'doc',
    expect: 't-normal',
  },
  {
    title: 'ПРИНЯТЬ РЕШЕНИЕ',
    lines: [
      {
        text: 'Проверил документ — решай. Нашёл нарушение, останавливай.',
        pose: 'work',
        voice: lesson(4),
      },
      {
        text: 'Документ чист — пропускай. Здесь на счёт это не влияет, пробуй.',
        pose: 'neutral',
        voice: lesson(5),
      },
    ],
    stage: 'decision',
  },
  {
    title: 'СЛЕДИ ЗА ВРЕМЕНЕМ',
    lines: [
      { text: 'И главное: время. На каждый документ его в обрез.', pose: 'time', voice: lesson(6) },
      {
        text: 'Последние секунды отсчитываются вслух. Смотри.',
        pose: 'time',
        voice: lesson(7),
      },
    ],
    stage: 'timer',
  },
  {
    title: 'ГОТОВО',
    lines: [
      {
        text: 'Вот и всё, что нужно знать. Остальное придёт с опытом.',
        pose: 'ok',
        voice: lesson(8),
      },
      {
        text: 'Дело за тобой, инспектор. Чтоб мир стал чище!',
        pose: 'point',
        voice: lesson(9),
      },
    ],
    stage: 'none',
  },
];

export function renderTutorial(handlers: TutorialHandlers): TutorialScreen {
  const root = h('section', 'screen screen--novel');

  root.innerHTML = `
    <div class="novel">
      <div class="novel-top">
        <span class="novel-label" data-novel="label">ЗНАКОМСТВО</span>
        <span class="novel-step" data-novel="step"></span>
      </div>

      <div class="novel-stage" data-novel="stage"></div>

      <div class="novel-bottom">
        <div class="novel-guide" data-novel="guide"></div>
        <div class="novel-speech" data-novel="speech"></div>
      </div>

      <div class="novel-choice" data-novel="choice" hidden>
        <p class="novel-choice-title">Что скажешь?</p>
        <button type="button" class="btn btn--primary" data-action="take">ПРОЙТИ ОБУЧЕНИЕ</button>
        <button type="button" class="btn btn--ghost" data-action="skip">ПРОПУСТИТЬ</button>
      </div>

      <button type="button" class="btn btn--ghost novel-exit" data-action="exit">
        ПРОПУСТИТЬ ОБУЧЕНИЕ
      </button>
    </div>
  `;

  const stageEl = root.querySelector<HTMLElement>('[data-novel="stage"]');
  const labelEl = root.querySelector<HTMLElement>('[data-novel="label"]');
  const stepEl = root.querySelector<HTMLElement>('[data-novel="step"]');
  const choiceEl = root.querySelector<HTMLElement>('[data-novel="choice"]');
  const exitButton = root.querySelector<HTMLElement>('[data-action="exit"]');

  const guide: Guide = createGuide('tired');
  root.querySelector('[data-novel="guide"]')?.appendChild(guide.root);

  const speech: SpeechBar = createSpeechBar();
  root.querySelector('[data-novel="speech"]')?.appendChild(speech.root);

  let timerHandle = 0;
  let mistakeShown = false;
  let slideIndex = 0;
  /** Что делает нажатие по полосе реплики прямо сейчас. */
  let advance: (() => void) | null = null;
  let destroyed = false;

  // ---------- общая механика реплик ----------

  /** Проигрывает цепочку реплик, затем вызывает then(). */
  function playLines(lines: Line[], then: () => void): void {
    let index = 0;

    const step = () => {
      if (destroyed) return;
      if (index >= lines.length) {
        advance = null;
        then();
        return;
      }
      const line = lines[index];
      index += 1;
      guide.setPose(line.pose);
      speech.say(line.text);
      // Озвучка идёт под текстом: её можно слушать, а можно читать молча.
      if (line.voice) void voice.play(line.voice);
      else voice.stop();
      advance = step;
    };

    step();
  }

  /** Нажатие по сцене: сначала дописывает текст, потом ведёт дальше. */
  const onAdvance = (event: Event) => {
    const target = event.target as HTMLElement;
    // кнопки и документ обрабатывают нажатие сами
    if (target.closest('button') || target.closest('.novel-stage')) return;
    // Пролистали текст — обрываем и реплику: слушать нечего, она уже прочитана.
    if (speech.skip()) {
      voice.stop();
      return;
    }
    advance?.();
  };

  root.addEventListener('click', onAdvance);

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (document.activeElement instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (speech.skip()) {
      voice.stop();
      return;
    }
    advance?.();
  };
  window.addEventListener('keydown', onKey);

  // ---------- сцены ----------

  function setLabel(label: string, step = ''): void {
    if (labelEl) labelEl.textContent = label;
    if (stepEl) stepEl.textContent = step;
  }

  function clearStage(): void {
    window.clearInterval(timerHandle);
    stageEl?.replaceChildren();
  }

  /** Знакомство, затем выбор. */
  function playIntro(): void {
    setLabel('ЗНАКОМСТВО');
    exitButton?.setAttribute('hidden', '');
    playLines(INTRO, showChoice);
  }

  function showChoice(): void {
    choiceEl?.removeAttribute('hidden');
    guide.setPose('neutral');
  }

  /** Отказ: инспектор подаётся вперёд и отправляет работать. */
  function playOrder(): void {
    choiceEl?.setAttribute('hidden', '');
    setLabel('ЗА РАБОТУ');
    guide.lean(true);
    playLines(ORDER, () => {
      guide.lean(false);
      handlers.onFinish();
    });
  }

  function startLessons(): void {
    choiceEl?.setAttribute('hidden', '');
    exitButton?.removeAttribute('hidden');
    slideIndex = 0;
    renderSlide();
  }

  root.querySelector('[data-action="take"]')?.addEventListener('click', () => {
    handlers.onClick();
    startLessons();
  });

  root.querySelector('[data-action="skip"]')?.addEventListener('click', () => {
    handlers.onClick();
    playOrder();
  });

  exitButton?.addEventListener('click', () => {
    handlers.onClick();
    handlers.onFinish();
  });

  // ---------- содержимое слайдов ----------

  /** Учебный документ с ожиданием нужного клика. */
  function buildDoc(expect: Slide['expect']): HTMLElement {
    const doc = renderDocument(LESSON);
    doc.classList.add('doc--lesson');

    if (expect === 't-flag') {
      doc.querySelector('[data-hotspot="t-flag"]')?.classList.add('is-hinted');
    }

    doc.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hotspot]');
      if (!target || target.classList.contains('is-done')) return;

      const id = target.dataset.hotspot ?? '';
      const hotspot = LESSON.hotspots.find((item) => item.id === id);
      if (!hotspot) return;

      target.classList.add('is-done', hotspot.suspicious ? 'is-flag' : 'is-clear');
      target.classList.remove('is-hinted');

      if (hotspot.suspicious) handlers.onHit();
      else handlers.onMiss();

      guide.setPose(hotspot.suspicious ? 'ok' : 'warn');
      speech.say(hotspot.note);

      // Ошибочный клик отмечается явно — так же, как в игре.
      if (!hotspot.suspicious && !mistakeShown) {
        mistakeShown = true;
        const mark = h('span', 'novel-mistake', 'ОШИБОЧНЫЙ КЛИК');
        stageEl?.appendChild(mark);
        window.setTimeout(() => mark.remove(), 2200);
      }

      if (id === expect) allowNext();
    });

    return doc;
  }

  /** Демонстрация таймера: шкала добегает до последних секунд. */
  function buildTimer(): HTMLElement {
    const box = h('div', 'novel-timer');
    box.innerHTML = `
      <div class="novel-clock">${icon('time')}<b data-novel="clock">0:05</b></div>
      <div class="timebar"><span class="timebar-fill" data-novel="bar"></span></div>
    `;

    const clock = box.querySelector<HTMLElement>('[data-novel="clock"]');
    const bar = box.querySelector<HTMLElement>('[data-novel="bar"]');
    let left = 5;

    const step = () => {
      left -= 1;
      if (clock) clock.textContent = `0:0${Math.max(0, left)}`;
      clock?.classList.toggle('is-low', left <= 3);
      if (bar) bar.style.transform = `scaleX(${(left / 5).toFixed(2)})`;
      bar?.classList.toggle('is-low', left <= 3);
      if (left <= 0) {
        window.clearInterval(timerHandle);
        guide.setPose('warn');
        speech.say('Вот так документ и уходит без твоего решения. Лучше не доводить.');
        allowNext();
      }
    };

    if (bar) bar.style.transform = 'scaleX(1)';
    timerHandle = window.setInterval(step, 900);
    return box;
  }

  function buildDecision(): HTMLElement {
    const box = h('div', 'novel-decision');
    box.innerHTML = `
      <button type="button" class="btn btn--pass">ПРОПУСТИТЬ</button>
      <button type="button" class="btn btn--stop">ОСТАНОВИТЬ</button>
    `;
    box.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        handlers.onClick();
        box.querySelectorAll('button').forEach((other) => other.classList.remove('is-chosen'));
        button.classList.add('is-chosen');
        guide.setPose('ok');
        speech.say(
          button.classList.contains('btn--stop')
            ? 'Верно. В этом документе нарушение, его нужно остановить.'
            : 'Здесь-то нарушение есть, так что верно «ОСТАНОВИТЬ». Но выбор всегда твой.',
        );
        allowNext();
      });
    });
    return box;
  }

  /** Разрешить переход к следующему слайду. */
  function allowNext(): void {
    advance = () => {
      slideIndex += 1;
      if (slideIndex >= SLIDES.length) {
        handlers.onFinish();
        return;
      }
      renderSlide();
    };
  }

  function renderSlide(): void {
    const slide = SLIDES[slideIndex];
    clearStage();
    setLabel(slide.title, `${slideIndex + 1} / ${SLIDES.length}`);

    if (slide.stage === 'doc' && stageEl) stageEl.appendChild(buildDoc(slide.expect));
    if (slide.stage === 'decision' && stageEl) stageEl.appendChild(buildDecision());
    if (slide.stage === 'timer' && stageEl) stageEl.appendChild(buildTimer());

    // На слайдах с действием переход открывается только после него.
    playLines(slide.lines, () => {
      if (slide.stage === 'none') allowNext();
      else advance = null;
    });
  }

  playIntro();

  return {
    root,
    destroy() {
      destroyed = true;
      voice.dispose();
      window.clearInterval(timerHandle);
      root.removeEventListener('click', onAdvance);
      window.removeEventListener('keydown', onKey);
      speech.destroy();
      guide.destroy();
    },
  };
}
