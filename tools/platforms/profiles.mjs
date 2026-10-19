export const profiles = Object.freeze(Object.fromEntries([
  ['web', '/src/main.js'], ['embed', '/src/platforms/embed/entry.js'], ['telegram', '/src/platforms/telegram/entry.js'],
].map(([id, entry]) => [id, Object.freeze({ id, entry, base: './', outDir: `dist/${id}` })])));
export function getProfile(target) {
  if (!Object.hasOwn(profiles, target)) throw Error(`Unknown platform: ${target}. Expected web, embed or telegram.`);
  return profiles[target];
}
