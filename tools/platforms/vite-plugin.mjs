import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function platformBuild(profile) {
  let config;
  return {
    name: 'platform-build',
    configResolved(value) { config = value; },
    transformIndexHtml: { order: 'pre', handler(html) {
      let result = html.replace('/src/main.js', profile.entry);
      if (profile.id === 'telegram') result = result.replace('</head>', '<script id="platform-bridge" async src="https://telegram.org/js/telegram-web-app.js"></script></head>');
      return result;
    } },
    async generateBundle(_options, bundle) {
      const adapters = new Set();
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk') for (const name of Object.keys(chunk.modules)) {
        const modulePath = name.replaceAll('\\', '/');
        if (/\/server\//.test(modulePath) || /(?:better-sqlite3|browser-external:node:)/.test(modulePath)) throw Error('Server dependencies must not enter the game bundle');
        const match = modulePath.match(/\/src\/platforms\/(web|embed|telegram)\/adapter\.js$/);
        if (match) adapters.add(match[1]);
      }
      if (adapters.size !== 1 || !adapters.has(profile.id)) throw Error(`Platform isolation failed for ${profile.id}`);
      this.emitFile({ type: 'asset', fileName: 'platform-modules.json', source: JSON.stringify({ target: profile.id, adapters: [...adapters] }) });
      const notices = [];
      for (const [name, license] of [['Three.js', 'node_modules/three/LICENSE'], ['Preact', 'node_modules/preact/LICENSE'], ['Nunito', 'public/fonts/OFL.txt']]) {
        notices.push(`<h2>${name}</h2><pre>${escape(await fs.readFile(path.resolve(config.root, license), 'utf8'))}</pre>`);
      }
      this.emitFile({ type: 'asset', fileName: 'third-party-notices.html', source: '<!doctype html><meta charset="utf-8"><title>Magnet Sort — Third-party notices</title><h1>Runtime licenses</h1>' + notices.join('\n') });
    },
    async writeBundle() {
      // Hash final bytes: Vite rewrites relative JS/CSS after generateBundle.
      const directory = path.resolve(config.root, config.build.outDir);
      const infoPath = path.join(directory, 'build-info.json');
      const info = JSON.parse(await fs.readFile(infoPath, 'utf8'));
      Object.assign(info, { target: profile.id, format: 'static-web-directory', version: JSON.parse(await fs.readFile(path.join(config.root, 'package.json'), 'utf8')).version });
      await fs.writeFile(infoPath, JSON.stringify(info));
      const assets = [];
      for (const name of (await fs.readdir(path.join(directory, 'assets'))).sort()) {
        const bytes = await fs.readFile(path.join(directory, 'assets', name));
        assets.push({ url: `assets/${name}`, bytes: bytes.length, sha256: hash(bytes) });
      }
      const manifest = { schemaVersion: 1, version: hash(JSON.stringify(assets)).slice(0, 16), assets };
      await fs.writeFile(path.join(directory, 'resource-cache.json'), JSON.stringify(manifest));
      const worker = await fs.readFile(path.join(config.root, 'tools/platforms/resource-worker.js'), 'utf8');
      await fs.writeFile(path.join(directory, 'resource-sw.js'), worker.replace('__MAGNET_SORT_RESOURCE_MANIFEST__', JSON.stringify(manifest)));
    },
  };
}
