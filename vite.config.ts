import { readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

const MEDIA_ROOT = 'public/media';

/** Рекурсивно собирает список файлов в public/media. */
function scanMedia(dir: string, prefix = 'media'): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return scanMedia(full, posix.join(prefix, entry));
    return entry.startsWith('.') || entry.endsWith('.md') ? [] : [posix.join(prefix, entry)];
  });
}

/**
 * Список доступных ассетов.
 *
 * Без него игра искала бы файлы перебором расширений, и каждый
 * отсутствующий ассет давал бы несколько ошибок 404 в консоли.
 */
function mediaManifest(): Plugin {
  const build = () => JSON.stringify(scanMedia(MEDIA_ROOT));

  return {
    name: 'media-manifest',
    configureServer(server) {
      server.middlewares.use('/media-manifest.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(build());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'media-manifest.json', source: build() });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [mediaManifest()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 8192,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
