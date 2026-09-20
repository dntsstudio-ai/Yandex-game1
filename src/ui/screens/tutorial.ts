/**
 * Короткое обучение: четыре слайда меньше чем на минуту.
 *
 * Обучение живёт отдельно от движка: у него свой маленький документ,
 * свои клики и свой таймер. Основной счёт оно не трогает, поэтому
 * игровой цикл и правила остаются нетронутыми.
 */
import type { Scenario } from '../../core/types';
import { h } from '../dom';
import { renderDocument } from '../documentView';
import { createGuide, type Guide, type GuidePose } from '../guide';
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
      note: 'Вот это — красный флаг: решение принято без конкурса, по личной рекомендации.',
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

interface Slide {
  title: string;
  text: string;
  /** Реплика гида. */
  guide: string;
  /** Поза гида на этом слайде. */
  pose: GuidePose;
  /** Что показывать под текстом. */
  stage: 'doc' | 'decision' | 'timer' | 'done';
  /** Какой фрагмент ждём от игрока, чтобы пойти дальше. */
  expect?: 't-flag' | 't-normal';
}

const SLIDES: Slide[] = [
  {
    title: 'НАЙДИ ПРИЗНАК РИСКА',
    text: 'Внимательно изучай документ. Подозрительные фрагменты можно отметить нажатием.',
    guide: 'Красный флаг — это деталь, из-за которой сделку стоит остановить. Я подсветил её для примера. Нажмите на неё.',
    pose: 'point',
    stage: 'doc',
    expect: 't-flag',
  },
  {
    title: 'БУДЬ ВНИМАТЕЛЕН',
    text: 'Обычные данные тоже находятся в документе. Ошибочная отметка отнимает очки.',
    guide: 'Теперь нажмите на обычную строку — посмотрим, что будет.',
    pose: 'think',
    stage: 'doc',
    expect: 't-normal',
  },
  {
    title: 'ПРИНЯТЬ РЕШЕНИЕ',
    text: 'После проверки реши, нужно ли остановить документ.',
    guide: 'Нашли нарушение — останавливайте. Документ чист — пропускайте. Здесь выбор на счёт не влияет.',
    pose: 'work',
    stage: 'decision',
  },
  {
    title: 'СЛЕДИ ЗА ВРЕМЕНЕМ',
    text: 'На проверку документа даётся ограниченное время.',
    guide: 'Последние секунды отсчитываются вслух. Не успели — документ уходит без вашего решения.',
    pose: 'time',
    stage: 'timer',
  },
  {
    title: 'ГОТОВО',
    text: 'Теперь ты знаешь всё необходимое.',
    guide: 'Дело за вами, инспектор.',
    pose: 'ok',
    stage: 'done',
  },
];

export function renderTutorial(handlers: TutorialHandlers): TutorialScreen {
  const root = h('section', 'screen screen--tutorial');
  let index = 0;
  let guide: Guide | null = null;
  let timerHandle = 0;
  let mistakeShown = false;

  root.innerHTML = `
    <div class="panel tutorial-inner">
      <span class="tick tick--tl"></span><span class="tick tick--tr"></span>
      <span class="tick tick--bl"></span><span class="tick tick--br"></span>

      <header class="tutorial-head">
        <span class="tutorial-label">ОБУЧЕНИЕ</span>
        <span class="tutorial-step" data-tutorial="step"></span>
      </header>

      <h2 class="tutorial-title" data-tutorial="title"></h2>
      <p class="tutorial-text" data-tutorial="text"></p>

      <div class="tutorial-guide" data-tutorial="guide"></div>

      <div class="tutorial-stage" data-tutorial="stage"></div>

      <div class="tutorial-actions">
        <button type="button" class="btn btn--ghost" data-action="skip">ПРОПУСТИТЬ ОБУЧЕНИЕ</button>
        <button type="button" class="btn btn--primary" data-action="next" hidden>ДАЛЬШЕ</button>
      </div>
    </div>
  `;

  const titleEl = root.querySelector<HTMLElement>('[data-tutorial="title"]');
  const textEl = root.querySelector<HTMLElement>('[data-tutorial="text"]');
  const stepEl = root.querySelector<HTMLElement>('[data-tutorial="step"]');
  const stageEl = root.querySelector<HTMLElement>('[data-tutorial="stage"]');
  const guideSlot = root.querySelector<HTMLElement>('[data-tutorial="guide"]');
  const nextButton = root.querySelector<HTMLButtonElement>('[data-action="next"]');

  guide = createGuide();
  guideSlot?.appendChild(guide.root);

  const finish = () => {
    handlers.onClick();
    handlers.onFinish();
  };

  root.querySelector('[data-action="skip"]')?.addEventListener('click', finish);

  nextButton?.addEventListener('click', () => {
    handlers.onClick();
    index += 1;
    if (index >= SLIDES.length) {
      handlers.onFinish();
      return;
    }
    renderSlide();
  });

  /** Учебный документ с ожиданием нужного клика. */
  function buildDoc(expect: Slide['expect']): HTMLElement {
    const doc = renderDocument(LESSON);
    doc.classList.add('doc--lesson');

    // Подсветка примера — только на первом слайде.
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

      guide?.say(hotspot.note, hotspot.suspicious ? 'ok' : 'warn');

      // Ошибочный клик отмечается явно — так же, как в игре.
      if (!hotspot.suspicious && !mistakeShown) {
        mistakeShown = true;
        const mark = h('span', 'tutorial-mistake', 'ОШИБОЧНЫЙ КЛИК');
        stageEl?.appendChild(mark);
        window.setTimeout(() => mark.remove(), 2200);
      }

      if (id === expect) allowNext();
    });

    return doc;
  }

  /** Демонстрация таймера: шкала добегает до последних секунд. */
  function buildTimer(): HTMLElement {
    const box = h('div', 'tutorial-timer');
    box.innerHTML = `
      <div class="tutorial-clock">
        ${icon('time')}<b data-tutorial="clock">0:05</b>
      </div>
      <div class="timebar"><span class="timebar-fill" data-tutorial="bar"></span></div>
    `;

    const clock = box.querySelector<HTMLElement>('[data-tutorial="clock"]');
    const bar = box.querySelector<HTMLElement>('[data-tutorial="bar"]');
    let left = 5;

    // Обычный setInterval, а не кадры: цифра меняется раз в секунду.
    const step = () => {
      left -= 1;
      if (clock) clock.textContent = `0:0${Math.max(0, left)}`;
      clock?.classList.toggle('is-low', left <= 3);
      if (bar) bar.style.transform = `scaleX(${(left / 5).toFixed(2)})`;
      bar?.classList.toggle('is-low', left <= 3);
      if (left <= 0) {
        window.clearInterval(timerHandle);
        guide?.say('Время вышло — документ ушёл без решения. Лучше не доводить.', 'warn');
        allowNext();
      }
    };

    if (bar) bar.style.transform = 'scaleX(1)';
    timerHandle = window.setInterval(step, 900);
    return box;
  }

  function allowNext(): void {
    if (nextButton) {
      nextButton.hidden = false;
      nextButton.textContent = index === SLIDES.length - 1 ? 'НАЧАТЬ ПРОВЕРКУ' : 'ДАЛЬШЕ';
    }
  }

  function renderSlide(): void {
    const slide = SLIDES[index];
    window.clearInterval(timerHandle);

    if (titleEl) titleEl.textContent = slide.title;
    if (textEl) textEl.textContent = slide.text;
    if (stepEl) stepEl.textContent = `${index + 1} / ${SLIDES.length}`;
    guide?.say(slide.guide, slide.pose);

    if (nextButton) {
      // На слайдах с действием кнопка появляется после него.
      nextButton.hidden = slide.stage === 'doc' || slide.stage === 'timer';
      nextButton.textContent = index === SLIDES.length - 1 ? 'НАЧАТЬ ПРОВЕРКУ' : 'ДАЛЬШЕ';
    }

    if (!stageEl) return;
    stageEl.replaceChildren();

    if (slide.stage === 'doc') {
      stageEl.appendChild(buildDoc(slide.expect));
      return;
    }

    if (slide.stage === 'decision') {
      const box = h('div', 'tutorial-decision');
      box.innerHTML = `
        <button type="button" class="btn btn--pass">ПРОПУСТИТЬ</button>
        <button type="button" class="btn btn--stop">ОСТАНОВИТЬ</button>
      `;
      box.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          handlers.onClick();
          box.querySelectorAll('button').forEach((other) => other.classList.remove('is-chosen'));
          button.classList.add('is-chosen');
          guide?.say(
            button.classList.contains('btn--stop')
              ? 'Так и есть: в этом документе нарушение, его нужно остановить.'
              : 'В этом документе нарушение есть, так что здесь верно «ОСТАНОВИТЬ». Но выбор за вами.',
            'ok',
          );
        });
      });
      stageEl.appendChild(box);
      return;
    }

    if (slide.stage === 'timer') {
      stageEl.appendChild(buildTimer());
    }
  }

  renderSlide();

  return {
    root,
    destroy() {
      window.clearInterval(timerHandle);
      guide?.destroy();
      guide = null;
    },
  };
}

/** Предложение пройти обучение перед первой партией. */
export function renderTutorialOffer(onTake: () => void, onSkip: () => void): HTMLElement {
  const root = h('section', 'screen screen--offer');
  root.innerHTML = `
    <div class="panel offer-inner">
      <span class="tick tick--tl"></span><span class="tick tick--tr"></span>
      <span class="tick tick--bl"></span><span class="tick tick--br"></span>

      <h2 class="offer-title">ПРОЙТИ ОБУЧЕНИЕ?</h2>
      <p class="offer-text">
        Перед началом проверки можно пройти короткое обучение.
        Оно займёт меньше минуты.
      </p>
      <div class="offer-actions">
        <button type="button" class="btn btn--primary" data-action="take">ПРОЙТИ ОБУЧЕНИЕ</button>
        <button type="button" class="btn btn--ghost" data-action="skip">ПРОПУСТИТЬ</button>
      </div>
    </div>
  `;

  root.querySelector('[data-action="take"]')?.addEventListener('click', onTake);
  root.querySelector('[data-action="skip"]')?.addEventListener('click', onSkip);
  return root;
}
