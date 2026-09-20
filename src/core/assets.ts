/**
 * Необязательные внешние ассеты (музыка, текстуры, шрифты).
 *
 * Файлы кладутся в папку `public/media/…` и подхватываются автоматически.
 * Если файла нет, игра использует встроенную замену: процедурную музыку,
 * CSS-текстуры и системные шрифты. Поэтому сборка работает и без ассетов.
 */
export const MEDIA = {
  /** Фоновая музыка; при отсутствии играет синтезированная тема. */
  musicTheme: 'media/music/theme.mp3',
  /** Текстура бумаги для карточки документа. */
  paperTexture: 'media/textures/paper.webp',
  /** Фон сцены (тёмная поверхность стола). */
  backdrop: 'media/textures/backdrop.webp',
  /** Фон главного меню (здание компании). */
  menuBackdrop: 'media/menu/headquarters.webp',
  /** Фон итогового экрана (кабинет ночью). */
  finalBackdrop: 'media/menu/office-night.webp',

  /** Логотип игры вместо нарисованного кодом флага. */
  logo: 'media/ui/logo.webp',
  /** Рамка панелей, 9-slice. */
  panelFrame: 'media/ui/panel-frame.png',
  /** Рамка кнопок, 9-slice. */
  buttonFrame: 'media/ui/button-frame.png',
  /** Печати на экране разбора. */
  stampStop: 'media/ui/stamp-stop.webp',
  stampPass: 'media/ui/stamp-pass.webp',
  stampWarn: 'media/ui/stamp-warn.webp',
  stampFail: 'media/ui/stamp-fail.webp',
} as const;

/**
 * Расширения, которые проверяются, если файла с указанным именем нет.
 * Так ассет подхватится независимо от того, в каком формате его сохранили.
 */
const FALLBACK_EXTENSIONS = ['.webp', '.png', '.svg', '.jpg', '.mp3', '.ogg'];

/**
 * Собирает адрес ассета. Вынесена отдельно от окружения, чтобы правило
 * можно было проверить тестом для любой базы сборки.
 *
 * Адрес должен быть абсолютным: относительный путь внутри CSS-переменной
 * браузер разрешает относительно файла стилей (`/assets/index-*.css`),
 * а не страницы, из-за чего картинки искались в `/assets/media/...`
 * и не находились. В режиме разработки база `/`, и ошибка не проявлялась.
 */
export function resolveAssetUrl(path: string, base: string, baseURI?: string): string {
  const prefix = base ? (base.endsWith('/') ? base : `${base}/`) : './';
  const relative = `${prefix}${path}`;
  if (!baseURI) return relative;
  return new URL(relative, baseURI).href;
}

/** Абсолютный адрес файла с учётом базового адреса сборки. */
export function assetUrl(path: string): string {
  return resolveAssetUrl(
    path,
    import.meta.env.BASE_URL || './',
    typeof document === 'undefined' ? undefined : document.baseURI,
  );
}

/**
 * Проверяет наличие файла, чтобы решить, использовать ассет или замену.
 *
 * Проверяется не только код ответа: dev-сервер и хостинги с SPA-фолбэком
 * отвечают 200 и отдают index.html на любой несуществующий путь, поэтому
 * дополнительно сверяется тип содержимого.
 */
export async function assetExists(path: string, expectedType: 'audio' | 'image'): Promise<boolean> {
  try {
    const response = await fetch(assetUrl(path), { method: 'HEAD' });
    if (!response.ok) return false;
    const type = response.headers.get('content-type') ?? '';
    return type.startsWith(expectedType);
  } catch {
    return false;
  }
}

/**
 * Список файлов в public/media, собираемый при сборке.
 * Позволяет не проверять наличие ассетов запросами: раньше каждый
 * отсутствующий файл давал четыре ошибки 404 в консоли.
 */
let manifest: Promise<Set<string> | null> | null = null;

function loadManifest(): Promise<Set<string> | null> {
  manifest ??= fetch(assetUrl('media-manifest.json'))
    .then((response) => (response.ok ? response.json() : null))
    .then((list: unknown) => (Array.isArray(list) ? new Set(list as string[]) : null))
    .catch(() => null);
  return manifest;
}

/** Варианты пути с разными расширениями. */
function candidates(path: string): string[] {
  const dot = path.lastIndexOf('.');
  const base = dot === -1 ? path : path.slice(0, dot);
  const original = dot === -1 ? '' : path.slice(dot);
  return [original, ...FALLBACK_EXTENSIONS.filter((ext) => ext !== original)].map(
    (extension) => `${base}${extension}`,
  );
}

/**
 * Ищет ассет: достаточно положить файл с нужным именем в любом из
 * распространённых форматов. Возвращает найденный путь или null.
 */
export async function findAsset(
  path: string,
  expectedType: 'audio' | 'image',
): Promise<string | null> {
  const files = await loadManifest();
  const variants = candidates(path);

  if (files) return variants.find((candidate) => files.has(candidate)) ?? null;

  // Манифеста нет (например, файл открыт напрямую) — проверяем запросами.
  for (const candidate of variants) {
    if (await assetExists(candidate, expectedType)) return candidate;
  }
  return null;
}
