import { defineConfig } from "vite";

// Относительные пути обязательны для деплоя на Яндекс Игры —
// игра запускается из подпапки, а не из корня домена.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
