import './styles/main.css';
import { MEDIA, assetUrl, findAsset } from './core/assets';
import { App } from './ui/app';
import { loadIconSprite } from './ui/icons';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Не найден контейнер #app');

new App(root);

/**
 * Необязательная графика: если файл добавлен в public/media, он
 * подставляется в CSS-переменную и включает соответствующий класс на body.
 * Без файлов работают встроенные CSS-замены, поэтому игра не зависит
 * от внешних ассетов.
 */
void (async () => {
  const textures: Array<[keyof typeof MEDIA, string]> = [
    ['paperTexture', '--paper-image'],
    ['paperGrid', '--paper-grid-image'],
    ['paperAged', '--paper-aged-image'],
    ['backdrop', '--backdrop-image'],
    ['finalBackdrop', '--final-image'],
  ];

  // Декор бумаги: скрепка, скоба и кофейный след. Появляются, только если
  // есть все три файла, — иначе на одних документах украшения были бы,
  // а на других нет.
  const decor: Array<[keyof typeof MEDIA, string]> = [
    ['clip', '--ui-clip'],
    ['staple', '--ui-staple'],
    ['coffeeRing', '--ui-coffee-ring'],
  ];

  const frames: Array<[keyof typeof MEDIA, string, string]> = [
    ['panelFrame', '--ui-panel-frame', 'has-ui-panel-frame'],
    ['buttonFrame', '--ui-button-frame', 'has-ui-button-frame'],
  ];

  const stamps: Array<[keyof typeof MEDIA, string]> = [
    ['stampStop', '--ui-stamp-stop'],
    ['stampPass', '--ui-stamp-pass'],
    ['stampWarn', '--ui-stamp-warn'],
    ['stampFail', '--ui-stamp-fail'],
  ];

  const apply = async (path: string, variable: string, bodyClass?: string) => {
    const found = await findAsset(path, 'image');
    if (!found) return false;
    document.documentElement.style.setProperty(variable, `url("${assetUrl(found)}")`);
    if (bodyClass) document.body.classList.add(bodyClass);
    return true;
  };

  await Promise.all([
    ...textures.map(([key, variable]) => apply(MEDIA[key], variable)),
    ...frames.map(([key, variable, bodyClass]) => apply(MEDIA[key], variable, bodyClass)),
  ]);

  const loadedStamps = await Promise.all(stamps.map(([key, variable]) => apply(MEDIA[key], variable)));
  if (loadedStamps.every(Boolean)) document.body.classList.add('has-ui-stamps');

  const loadedDecor = await Promise.all(decor.map(([key, variable]) => apply(MEDIA[key], variable)));
  if (loadedDecor.every(Boolean)) document.body.classList.add('has-doc-decor');

  await loadIconSprite();
})();
