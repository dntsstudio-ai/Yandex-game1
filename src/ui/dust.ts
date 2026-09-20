/**
 * Пыль в воздухе: один canvas вместо десятков элементов — так дешевле
 * и по памяти, и по времени отрисовки кадра. Используется и в меню,
 * и на итоговом экране.
 */

export interface DustOptions {
  /** Плотность: множитель к базовому количеству частиц. */
  density?: number;
  /** Добавлять ли листья у нижней трети кадра. */
  leaves?: boolean;
}

interface Mote {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  phase: number;
  twinkle: number;
  leaf: boolean;
}

/**
 * Пыль в воздухе и редкие листья у земли.
 * Один canvas вместо десятков DOM-элементов: так дешевле и по памяти,
 * и по времени отрисовки кадра.
 */
export function startDust(canvas: HTMLCanvasElement, options: DustOptions = {}): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;

  let width = 0;
  let height = 0;
  let motes: Mote[] = [];
  let frame = 0;
  let running = true;

  const spawn = (w: number, hgt: number, leaf: boolean): Mote => ({
    x: Math.random() * w,
    // листья держатся нижней трети кадра — там, где деревья и трава
    y: leaf ? hgt * (0.62 + Math.random() * 0.36) : Math.random() * hgt,
    radius: leaf ? 1.6 + Math.random() * 1.6 : 0.7 + Math.random() * 2.1,
    speedX: leaf ? 0.18 + Math.random() * 0.22 : -0.12 + Math.random() * 0.26,
    speedY: leaf ? -0.05 - Math.random() * 0.08 : -0.26 - Math.random() * 0.22,
    phase: Math.random() * Math.PI * 2,
    twinkle: leaf ? 0.02 + Math.random() * 0.02 : 0.006 + Math.random() * 0.012,
    leaf,
  });

  const resize = () => {
    // Пылинки размыты по природе: рисуем их в уменьшенный буфер и растягиваем
    // средствами CSS — пикселей для заливки становится втрое меньше.
    const ratio = 0.6;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const sameSize = Math.abs(rect.width - width) < 1 && Math.abs(rect.height - height) < 1;
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (!sameSize || motes.length === 0) {
      const small = width < 640;
      const density = options.density ?? 1;
      const dustCount = Math.round((small ? 18 : 32) * density);
      const leafCount = options.leaves === false ? 0 : Math.round((small ? 4 : 7) * density);
      motes = [
        ...Array.from({ length: dustCount }, () => spawn(width, height, false)),
        ...Array.from({ length: leafCount }, () => spawn(width, height, true)),
      ];
    }
  };

  const draw = () => {
    if (!running) return;
    if (motes.length === 0) {
      resize();
      frame = requestAnimationFrame(draw);
      return;
    }
    context.clearRect(0, 0, width, height);

    for (const mote of motes) {
      mote.phase += mote.twinkle;
      mote.x += mote.speedX + (mote.leaf ? Math.sin(mote.phase) * 0.25 : 0);
      mote.y += mote.speedY + (mote.leaf ? Math.cos(mote.phase * 0.7) * 0.12 : 0);

      if (mote.y < -8) {
        mote.y = height + 8;
        mote.x = Math.random() * width;
      }
      if (mote.leaf && (mote.x > width + 10 || mote.y < height * 0.55)) {
        mote.x = -10;
        mote.y = height * (0.62 + Math.random() * 0.36);
      }
      if (!mote.leaf && mote.x < -8) mote.x = width + 8;
      if (!mote.leaf && mote.x > width + 8) mote.x = -8;

      const alpha = mote.leaf
        ? 0.1 + Math.abs(Math.sin(mote.phase)) * 0.1
        : 0.26 + Math.sin(mote.phase) * 0.18;

      context.beginPath();
      context.fillStyle = mote.leaf
        ? `rgba(150, 176, 120, ${Math.max(0.04, alpha).toFixed(3)})`
        : `rgba(255, 238, 208, ${Math.max(0.04, alpha).toFixed(3)})`;
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
