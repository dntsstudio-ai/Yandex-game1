/**
 * Спрайт иконок.
 *
 * `<use href="файл.svg#id">` из внешнего файла браузеры не поддерживают
 * (Chrome и Safari — из соображений безопасности), поэтому спрайт
 * загружается один раз и вставляется в документ. После этого локальные
 * ссылки `<use href="#id">` работают на всех экранах.
 *
 * Файла может не быть — тогда иконки просто не показываются: класс
 * `has-ui-icons` не появится, а места разметка не занимает.
 */
import { MEDIA, assetUrl } from '../core/assets';

/** Имена символов в спрайте: список и тип идут из одного места,
    чтобы тест мог сверить их с самим файлом. */
export const ICON_NAMES = [
  'time',
  'score',
  'doc',
  'accuracy',
  'settings',
  'sound-on',
  'sound-off',
  'flag',
  'check',
  'clock',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Разметка иконки. Без спрайта элемент скрыт стилями. */
export function icon(name: IconName, extraClass = ''): string {
  return `<svg class="icon icon--${name}${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true"><use href="#${name}" /></svg>`;
}

/**
 * Загружает спрайт и вставляет его в начало документа.
 * Возвращает true, если спрайт подключён.
 */
export async function loadIconSprite(): Promise<boolean> {
  if (document.getElementById('icon-sprite')) return true;

  try {
    const response = await fetch(assetUrl(MEDIA.icons));
    if (!response.ok) return false;

    // Хостинги с SPA-фолбэком отдают index.html на любой путь,
    // поэтому одного кода 200 мало.
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('svg')) return false;

    const text = await response.text();
    if (!text.includes('<symbol')) return false;

    const holder = document.createElement('div');
    holder.id = 'icon-sprite';
    holder.setAttribute('aria-hidden', 'true');
    holder.innerHTML = text;
    document.body.prepend(holder);
    document.body.classList.add('has-ui-icons');
    return true;
  } catch {
    return false;
  }
}
