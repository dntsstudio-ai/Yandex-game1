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

  /** Логотип игры вместо нарисованного кодом флага. */
  logo: 'media/ui/logo.svg',
  /** Рамка панелей, 9-slice. */
  panelFrame: 'media/ui/panel-frame.png',
  /** Рамка кнопок, 9-slice. */
  buttonFrame: 'media/ui/button-frame.png',
  /** Печати на экране разбора. */
  stampStop: 'media/ui/stamp-stop.png',
  stampPass: 'media/ui/stamp-pass.png',
  stampWarn: 'media/ui/stamp-warn.png',
  stampFail: 'media/ui/stamp-fail.png',
} as const;

/** Путь к файлу с учётом базового адреса сборки (работает и в подпапке). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base.endsWith('/') ? base : `${base}/`}${path}`;
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
