import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getProfile, profiles } from './profiles.mjs';
const [target, ...args] = process.argv.slice(2);
const targets = target === 'all' ? Object.keys(profiles) : [target];
for (const id of targets) getProfile(id);
if (args.length && !(args.length === 2 && args[0] === '--base' && args[1])) throw Error('Usage: build.mjs web|embed|telegram|all [--base path]');
for (const id of targets) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), 'build', ...args], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit', windowsHide: true,
    env: { ...process.env, MAGNET_SORT_TARGET: id },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
