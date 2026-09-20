import { describe, expect, it } from 'vitest';
import { resolveAssetUrl } from './assets';

/**
 * Регрессия: относительный адрес внутри CSS-переменной браузер разрешает
 * относительно файла стилей, а не страницы. На GitHub Pages это уводило
 * запрос в /assets/media/... и картинки не находились.
 */
describe('адреса ассетов', () => {
  const page = 'https://dntsstudio-ai.github.io/Yandex-game1/';

  it('сборка с относительной базой: адрес абсолютный и с подпапкой', () => {
    const url = resolveAssetUrl('media/ui/stamp-stop.webp', './', page);

    expect(url).toBe('https://dntsstudio-ai.github.io/Yandex-game1/media/ui/stamp-stop.webp');
    expect(url).not.toContain('/assets/media');
  });

  it('база без завершающего слэша тоже работает', () => {
    expect(resolveAssetUrl('media/ui/logo.webp', '/game', page)).toBe(
      'https://dntsstudio-ai.github.io/game/media/ui/logo.webp',
    );
  });

  it('разработка: база в корне сайта', () => {
    expect(resolveAssetUrl('media/music/theme.mp3', '/', 'http://localhost:5173/')).toBe(
      'http://localhost:5173/media/music/theme.mp3',
    );
  });

  it('без document возвращается относительный путь и не падает', () => {
    expect(resolveAssetUrl('media/ui/logo.webp', './')).toBe('./media/ui/logo.webp');
  });
})
