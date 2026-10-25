import { defineConfig } from 'vite';
import { productionArt } from './tools/production-art.mjs';
import { platformBuild } from './tools/platforms/vite-plugin.mjs';
import { getProfile } from './tools/platforms/profiles.mjs';
export default defineConfig(({ command }) => {
  const explicit = process.env.MAGNET_SORT_TARGET;
  const profile = getProfile(explicit || 'web');
  const leaderboardsApi = process.env.VITE_LEADERBOARDS_API_URL ?? 'https://api.plusvibegames.com/magnet-sort/v1';
  if (leaderboardsApi) {
    const endpoint = new URL(leaderboardsApi);
    if (endpoint.protocol !== 'https:' && !(command === 'serve' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) throw Error('Leaderboard API must use HTTPS');
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw Error('Leaderboard API must be a public base URL');
  }
  return {
    base: profile.base, publicDir: command === 'build' ? false : 'public',
    define: { 'import.meta.env.VITE_LEADERBOARDS_API_URL': JSON.stringify(leaderboardsApi.replace(/\/$/, '')) },
    build: { outDir: explicit ? profile.outDir : 'dist', minify: 'esbuild', cssMinify: 'esbuild', sourcemap: false, assetsInlineLimit: 0 },
    plugins: [platformBuild(profile), productionArt()],
  };
});
