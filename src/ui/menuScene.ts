/**
 * Живая сцена главного меню.
 *
 * Композиция не меняется — добавлена режиссура:
 * 1. интро: из темноты проявляется город, загорается свет в здании,
 *    затем по очереди появляются флаг, название, подзаголовок, кнопки и HUD;
 * 2. жизнь кадра: медленный дрейф камеры, пыль, листья, дыхание света
 *    в окнах, зерно, редкая машина в глубине;
 * 3. выход: камера входит в здание, интерфейс гаснет, экран затемняется.
 *
 * Тяжёлые эффекты не используются: только transform, opacity и один canvas.
 */
import { MEDIA, assetUrl } from '../core/assets';
import { h } from './dom';
import { startDust } from './dust';

export interface MenuScene {
  root: HTMLElement;
  /** Мгновенно показать конечное состояние интро. */
  skipIntro: () => void;
  /** Проигрывает вход в здание. Завершается, когда экран затемнён. */
  playExit: () => Promise<void>;
  destroy: () => void;
}

/** Бегущая строка: лозунги компании — те же, что на билбордах у здания. */
const SLOGANS = [
  'ПРОЗРАЧНОСТЬ СЕГОДНЯ — СТАБИЛЬНОСТЬ ЗАВТРА',
  'ЧЕСТНОСТЬ · РАЗВИТИЕ · ОТВЕТСТВЕННОСТЬ',
  'ЧИСТОЕ БУДУЩЕЕ НАЧИНАЕТСЯ С ТЕБЯ',
  'ЛЮДИ ДЕЛАЮТ СТРАНУ СИЛЬНЕЕ',
];

/**
 * Длительность интро, мс. После неё состояние фиксируется классом
 * menu-settled, и поздние изменения классов уже не перезапускают анимации.
 */
const INTRO_MS = 5200;

/**
 * Длительность входа в здание, мс. Затемнение в CSS заканчивается на 1500 мс;
 * запас в 60 мс гарантирует, что игровой экран подменит сцену уже на чёрном
 * кадре, а не за кадр до него.
 */
const EXIT_MS = 1560;
const EXIT_MS_REDUCED = 320;

/**
 * @param logoReady Решение о логотипе. Таймлайн ждёт его, потому что классы
 * `menu-has-logo` меняют состав анимаций: добавленные позже, они запускали
 * интро заново, и логотип с кнопками снова исчезали на несколько секунд.
 */
export function createMenuScene(logoReady?: Promise<unknown>): MenuScene {
  const reduceMotion = prefersReducedMotion();

  const root = h('div', 'menu-scene');
  root.setAttribute('aria-hidden', 'true');
  // Классы режиссуры живут на body: сцена и интерфейс меню лежат в разных
  // ветках документа (фон — вне масштабируемой области), и общий предок
  // у них только один.
  document.body.classList.add('has-menu', 'menu-intro');

  const ticker = SLOGANS.map((text) => `<span>${text}</span>`).join('<i>◆</i>');

  root.innerHTML = `
    <div class="menu-camera">
      <img class="menu-photo" alt="" decoding="async" />
      <span class="menu-windows"></span>
      <span class="menu-car"></span>
      <span class="menu-sweep"></span>
    </div>
    <canvas class="menu-dust"></canvas>
    <div class="menu-light"></div>
    <div class="menu-haze"></div>
    <div class="menu-glitch"></div>

    <div class="menu-hud">
      <span class="hud-corner hud-corner--tl"></span>
      <span class="hud-corner hud-corner--tr"></span>
      <span class="hud-corner hud-corner--bl"></span>
      <span class="hud-corner hud-corner--br"></span>
      <div class="hud-live"><i></i>ПРЯМАЯ ТРАНСЛЯЦИЯ</div>
      <div class="hud-meta">
        <span data-clock>--:--:--</span>
        <span>КАМ 04 · ОАО «ЧИСТЫЕ РУКИ»</span>
      </div>
    </div>

    <div class="menu-ticker"><div class="menu-ticker-track">${ticker}${ticker}</div></div>
    <div class="menu-blackout"></div>
  `;

  // ---------- интро стартует, когда готовы фотография и решение о логотипе ----------
  let started = false;

  const startTimeline = () => {
    if (started) return;
    started = true;

    // Вариант таймлайна фиксируется один раз, на старте. Если решение о
    // логотипе опоздало, интро идёт по обычной схеме, а логотип просто
    // встаёт на место флага — без перезапуска анимаций.
    if (document.body.classList.contains('menu-has-logo')) {
      document.body.classList.add('menu-logo-intro');
    }

    document.body.classList.add('menu-live');
    if (reduceMotion) document.body.classList.add('menu-skip');

    // После окончания интро состояние фиксируется: поздние изменения классов
    // больше не могут перезапустить анимации и спрятать интерфейс.
    settleTimer = window.setTimeout(
      () => document.body.classList.add('menu-settled'),
      reduceMotion ? 300 : INTRO_MS,
    );
  };

  let photoReady = false;
  let logoDecided = logoReady === undefined;
  const tryStart = () => {
    if (photoReady && logoDecided) startTimeline();
  };

  void logoReady?.finally(() => {
    logoDecided = true;
    tryStart();
  });

  const photo = root.querySelector<HTMLImageElement>('.menu-photo');
  if (photo) {
    photo.addEventListener('load', () => {
      root.classList.add('is-ready');
      photoReady = true;
      tryStart();
    }, { once: true });
    photo.addEventListener('error', () => {
      root.classList.add('is-photoless');
      photoReady = true;
      tryStart();
    }, { once: true });
    photo.src = assetUrl(MEDIA.menuBackdrop);
  } else {
    photoReady = true;
    tryStart();
  }

  // Ждать вечно нельзя: при медленной сети меню показывается и без ассетов.
  const safety = window.setTimeout(startTimeline, 1800);
  let settleTimer = 0;

  // ---------- пропуск интро по действию игрока ----------
  const skipIntro = () => {
    started = true;
    document.body.classList.add('menu-live', 'menu-skip', 'menu-settled');
  };
  const onSkip = () => {
    if (!document.body.classList.contains('menu-skip')) skipIntro();
  };
  window.addEventListener('pointerdown', onSkip, { passive: true });
  window.addEventListener('keydown', onSkip);

  // ---------- параллакс от курсора ----------
  const camera = root.querySelector<HTMLElement>('.menu-camera');
  let parallaxHandler: ((event: PointerEvent) => void) | null = null;

  if (camera && !reduceMotion && matchMedia('(pointer: fine)').matches) {
    parallaxHandler = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      camera.style.setProperty('--shift-x', `${(-x * 8).toFixed(1)}px`);
      camera.style.setProperty('--shift-y', `${(-y * 6).toFixed(1)}px`);
    };
    window.addEventListener('pointermove', parallaxHandler, { passive: true });
  }

  // ---------- часы в рамке камеры ----------
  const clock = root.querySelector<HTMLElement>('[data-clock]');
  const tickClock = () => {
    if (clock) clock.textContent = new Date().toLocaleTimeString('ru-RU');
  };
  tickClock();
  const clockTimer = window.setInterval(tickClock, 1000);

  // ---------- пыль и листья ----------
  const dust = root.querySelector<HTMLCanvasElement>('.menu-dust');
  const stopDust = dust && !reduceMotion ? startDust(dust) : null;

  // Если машина не тянет сцену, отключаем декоративные слои и цикл пыли:
  // спрятать холст мало — рисование продолжалось бы вхолостую.
  const quality = reduceMotion
    ? null
    : watchFramerate(root, () => {
        stopDust?.();
      });

  const cleanup = () => {
    window.clearTimeout(safety);
    window.clearTimeout(settleTimer);
    window.clearInterval(clockTimer);
    window.removeEventListener('pointerdown', onSkip);
    window.removeEventListener('keydown', onSkip);
    if (parallaxHandler) window.removeEventListener('pointermove', parallaxHandler);
    quality?.();
    stopDust?.();
  };

  return {
    root,
    skipIntro,
    playExit() {
      document.body.classList.add('menu-skip', 'menu-exit');
      // Пыль останавливаем сразу: во время наезда она не читается,
      // а кадры нужны самой анимации камеры.
      stopDust?.();
      return new Promise<void>((resolve) => {
        window.setTimeout(resolve, reduceMotion ? EXIT_MS_REDUCED : EXIT_MS);
      });
    },
    destroy() {
      document.body.classList.remove(
        'has-menu',
        'menu-intro',
        'menu-live',
        'menu-skip',
        'menu-settled',
        'menu-logo-intro',
        'menu-exit',
        'menu-has-logo',
      );
      cleanup();
      root.remove();
    },
  };
}

/**
 * Измеряет частоту кадров полторы секунды и, если она низкая,
 * переводит сцену в облегчённый режим.
 */
function watchFramerate(root: HTMLElement, onLowFramerate: () => void): () => void {
  let frames = 0;
  let handle = 0;
  let stopped = false;
  const started = performance.now();

  const tick = () => {
    if (stopped) return;
    frames += 1;
    const elapsed = performance.now() - started;
    if (elapsed < 1500) {
      handle = requestAnimationFrame(tick);
      return;
    }
    if (frames / (elapsed / 1000) < 34) {
      root.classList.add('is-lite');
      onLowFramerate();
    }
  };

  const delay = window.setTimeout(() => {
    handle = requestAnimationFrame(tick);
  }, 1500);

  return () => {
    stopped = true;
    window.clearTimeout(delay);
    cancelAnimationFrame(handle);
  };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
