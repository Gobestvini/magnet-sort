export const profiles = Object.freeze(Object.fromEntries([
  ['web', '/src/main.js'], ['embed', '/src/platforms/embed/entry.js'], ['telegram', '/src/platforms/telegram/entry.js'],
  ...['crazygames','poki','yandex','playgama','gamedistribution','gamepix'].map(id=>[id,`/src/platforms/${id}/entry.js`]),
].map(([id, entry]) => [id, Object.freeze({ id, entry, base: './', outDir: `dist/${id}` })])));
export function getProfile(target) {
  if (!Object.hasOwn(profiles, target)) throw Error(`Unknown platform: ${target}. Expected ${Object.keys(profiles).join(', ')}.`);
  return profiles[target];
}
