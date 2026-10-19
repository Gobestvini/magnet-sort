import { defineConfig } from 'vite';
import { productionArt } from './tools/production-art.mjs';
import { platformBuild } from './tools/platforms/vite-plugin.mjs';
import { getProfile } from './tools/platforms/profiles.mjs';
export default defineConfig(({ command }) => {
  const explicit = process.env.MAGNET_SORT_TARGET;
  const profile = getProfile(explicit || 'web');
  return {
    base: profile.base, publicDir: command === 'build' ? false : 'public',
    build: { outDir: explicit ? profile.outDir : 'dist', minify: 'esbuild', cssMinify: 'esbuild', sourcemap: false, assetsInlineLimit: 0 },
    plugins: [platformBuild(profile), productionArt()],
  };
});
