import { defineConfig } from 'vite';
import { productionArt } from './tools/production-art.mjs';
export default defineConfig(({ command }) => ({
  base: './', publicDir: command === 'build' ? false : 'public',
  build: { minify: 'esbuild', cssMinify: 'esbuild', sourcemap: false, assetsInlineLimit: 0 },
  plugins: [productionArt()],
}));
