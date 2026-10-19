import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export async function readArtifact(directory, target, base = './') {
  const root = path.resolve(directory), files = [];
  const stat = await fs.lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Artifact must be a real directory');
  async function walk(relative = '') {
    for (const name of (await fs.readdir(path.join(root, relative))).sort()) {
      const file = relative ? `${relative}/${name}` : name;
      const stat = await fs.lstat(path.join(root, file));
      if (name.startsWith('.') || stat.isSymbolicLink()) throw Error('Unsafe runtime file');
      if (stat.isDirectory()) {
        if (file !== 'assets') throw Error('Unexpected runtime directory');
        await walk(file);
      } else {
        if (!stat.isFile() || !/\.(html|js|css|json|webp|svg|ttf|woff2?)$/.test(file)) throw Error('Unexpected runtime file');
        files.push(file);
      }
    }
  }
  await walk();
  const info = JSON.parse(await fs.readFile(path.join(root, 'build-info.json'), 'utf8'));
  const graph = JSON.parse(await fs.readFile(path.join(root, 'platform-modules.json'), 'utf8'));
  if (info.game !== 'magnet-sort' || info.target !== target || info.base !== base || !/^[a-f0-9]{40}$/.test(info.revision)) throw Error('Wrong game, platform, revision or base');
  if (graph.target !== target || JSON.stringify(graph.adapters) !== JSON.stringify([target])) throw Error('Platform graph mismatch');
  for (const file of ['index.html', 'resource-cache.json', 'resource-sw.js', 'third-party-notices.html']) if (!files.includes(file)) throw Error(`Missing ${file}`);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'resource-cache.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) throw Error('Invalid resource manifest');
  const assetFiles = files.filter(file => file.startsWith('assets/'));
  if (JSON.stringify(manifest.assets.map(asset => asset.url).sort()) !== JSON.stringify(assetFiles)) throw Error('Resource manifest file mismatch');
  for (const asset of manifest.assets) {
    const bytes = await fs.readFile(path.join(root, asset.url));
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('Resource checksum mismatch');
  }
  return { root, info, files };
}
export async function stagePublication({ webDir = 'dist/web', telegramDir = 'dist/telegram', outDir = 'artifacts/public-game' } = {}) {
  const web = await readArtifact(webDir, 'web'), telegram = await readArtifact(telegramDir, 'telegram');
  if (web.info.revision !== telegram.info.revision) throw Error('Mixed source revisions');
  const output = path.resolve(outDir);
  for (const input of [web.root, telegram.root]) if (output === input || output.startsWith(input + path.sep) || input.startsWith(output + path.sep)) throw Error('Overlapping publication directories');
  await fs.mkdir(output, { recursive: true });
  if ((await fs.lstat(output)).isSymbolicLink() || (await fs.readdir(output)).length) throw Error('Publication output must be a new empty directory');
  await fs.cp(web.root, output, { recursive: true });
  await fs.cp(telegram.root, path.join(output, 'telegram'), { recursive: true });
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await stagePublication());
