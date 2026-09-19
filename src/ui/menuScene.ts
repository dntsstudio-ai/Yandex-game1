/**
 * Живой фон главного меню.
 *
 * Слои: фотография здания с медленным движением камеры, световой луч,
 * пыль в воздухе на canvas, затемнение и рамка «камеры наблюдения».
 * Всё останавливается при уходе с экрана и при prefers-reduced-motion.
 */
import { MEDIA, assetUrl } from '../core/assets';
import { h } from './dom';

export interface MenuScene {
  root: HTMLElement;
  destroy: () => void;
}

/** Бегущая строка: лозунги компании — те же, что на билбордах у здания. */
const SLOGANS = [
  'ПРОЗРАЧНОСТЬ СЕГОДНЯ — СТАБИЛЬНОСТЬ ЗАВТРА',
  'ЧЕСТНОСТЬ · РАЗВИТИЕ · ОТВЕТСТВЕННОСТЬ',
  'ЧИСТОЕ БУДУЩЕЕ НАЧИНАЕТСЯ С ТЕБЯ',
  'ЛЮДИ ДЕЛАЮТ СТРАНУ СИЛЬНЕЕ',
];

export function createMenuScene(): MenuScene {
  const reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = h('div', 'menu-scene');
  root.setAttribute('aria-hidden', 'true');
  document.body.classList.add('has-menu');
  const ticker = SLOGANS.map((text) => `<span>${text}</span>`).join('<i>◆</i>');

  root.innerHTML = `
    <div class="menu-camera">
      <img class="menu-photo" alt="" decoding="async" />
      <span class="menu-sweep"></span>
    </div>
    <canvas class="menu-dust"></canvas>
    <div class="menu-haze"></div>
    <div class="menu-scan"></div>
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
  `;

  // ---------- фотография ----------
  const photo = root.querySelector<HTMLImageElement>('.menu-photo');
  if (photo) {
    photo.addEventListener('error', () => root.classList.add('is-photoless'), { once: true });
    photo.addEventListener('load', () => root.classList.add('is-ready'), { once: true });
    photo.src = assetUrl(MEDIA.menuBackdrop);
  }

  // ---------- параллакс от курсора ----------
  const camera = root.querySelector<HTMLElement>('.menu-camera');
  let parallaxHandler: ((event: PointerEvent) => void) | null = null;

  if (camera && !reduceMotion && matchMedia('(pointer: fine)').matches) {
    parallaxHandler = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      camera.style.setProperty('--shift-x', `${(-x * 14).toFixed(1)}px`);
      camera.style.setProperty('--shift-y', `${(-y * 10).toFixed(1)}px`);
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

  // ---------- пыль в воздухе ----------
  const dust = root.querySelector<HTMLCanvasElement>('.menu-dust');
  const stopDust = dust && !reduceMotion ? startDust(dust) : null;

  return {
    root,
    destroy() {
      document.body.classList.remove('has-menu');
      window.clearInterval(clockTimer);
      if (parallaxHandler) window.removeEventListener('pointermove', parallaxHandler);
      stopDust?.();
      root.remove();
    },
  };
}

interface Mote {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  phase: number;
  twinkle: number;
}

/** Медленно плывущие частицы пыли в луче света. */
function startDust(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;

  let width = 0;
  let height = 0;
  let motes: Mote[] = [];
  let frame = 0;
  let running = true;

  /**
   * Пересчёт размеров. Вызывается и при вставке в DOM: до неё элемент
   * не имеет размеров, и canvas остался бы пустым.
   */
  const resize = () => {
    // Пылинки размыты по природе: плотность пикселей выше 1 им не нужна.
    const ratio = 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const sameSize = Math.abs(rect.width - width) < 1 && Math.abs(rect.height - height) < 1;
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (!sameSize || motes.length === 0) {
      const count = width < 640 ? 22 : 46;
      motes = Array.from({ length: count }, () => spawn(width, height));
    }
  };

  const spawn = (w: number, hgt: number): Mote => ({
    x: Math.random() * w,
    y: Math.random() * hgt,
    radius: 0.7 + Math.random() * 2.1,
    speedX: -0.12 + Math.random() * 0.26,
    speedY: -0.26 - Math.random() * 0.22,
    phase: Math.random() * Math.PI * 2,
    twinkle: 0.006 + Math.random() * 0.012,
  });

  const draw = () => {
    if (!running) return;
    if (motes.length === 0) {
      resize();
      frame = requestAnimationFrame(draw);
      return;
    }
    context.clearRect(0, 0, width, height);

    for (const mote of motes) {
      mote.x += mote.speedX;
      mote.y += mote.speedY;
      mote.phase += mote.twinkle;

      if (mote.y < -8) {
        mote.y = height + 8;
        mote.x = Math.random() * width;
      }
      if (mote.x < -8) mote.x = width + 8;
      if (mote.x > width + 8) mote.x = -8;

      const alpha = 0.26 + Math.sin(mote.phase) * 0.18;
      context.beginPath();
      context.fillStyle = `rgba(255, 238, 208, ${Math.max(0.04, alpha).toFixed(3)})`;
      context.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
      context.fill();
    }

    frame = requestAnimationFrame(draw);
  };

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
    } else if (!running) {
      running = true;
      frame = requestAnimationFrame(draw);
    }
  };

  resize();
  // Размер приходит только после вставки элемента в документ.
  const observer =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  observer?.observe(canvas);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  frame = requestAnimationFrame(draw);

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
