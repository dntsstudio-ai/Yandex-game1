import './styles/main.css';
import { MEDIA, assetExists, assetUrl } from './core/assets';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Не найден контейнер #app');

new App(root);

/**
 * Необязательные текстуры: если файлы добавлены в public/media/textures,
 * они подставляются в CSS-переменные. Без них работают встроенные
 * CSS-текстуры, поэтому игра не зависит от внешних файлов.
 */
void (async () => {
  const optional: Array<[keyof typeof MEDIA, string]> = [
    ['paperTexture', '--paper-image'],
    ['backdrop', '--backdrop-image'],
  ];

  for (const [key, cssVariable] of optional) {
    const path = MEDIA[key];
    if (await assetExists(path, 'image')) {
      document.documentElement.style.setProperty(cssVariable, `url("${assetUrl(path)}")`);
    }
  }
})();
