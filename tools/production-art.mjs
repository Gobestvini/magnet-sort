import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { runtimePaths } from '../src/art/catalog.js';

// Adapted from White Tower: cache converted pixels, never overwrite originals.
export function productionArt() {
  let root, production, base;
  const outputs = new Map(), records = new Map();
  async function prepare(relative) {
    if (!outputs.has(relative)) outputs.set(relative, (async () => {
      const original = path.join(root, 'public', relative);
      if (!relative.endsWith('.png')) return original;
      const bytes = await fs.readFile(original);
      const digest = createHash('sha256').update(bytes).update('webp85-alpha100-original-size-v1').digest('hex');
      const dest = path.join(root, '.generated-runtime-art', path.basename(relative, '.png') + '-' + digest.slice(0, 16) + '.webp');
      await fs.mkdir(path.dirname(dest), { recursive: true });
      let converted;
      try { converted = await fs.readFile(dest); } catch {
        converted = await sharp(bytes).webp({ quality: 85, alphaQuality: 100, effort: 6 }).toBuffer();
        await fs.writeFile(dest, converted);
      }
      records.set(relative, { source: relative, sourceBytes: bytes.length, runtimeBytes: converted.length });
      return dest;
    })());
    return outputs.get(relative);
  }
  return {
    name: 'production-art', enforce: 'pre',
    configResolved(config) { root = config.root; production = config.command === 'build'; base = config.base; },
    buildStart() { outputs.clear(); records.clear(); },
    transformIndexHtml: { order: 'pre', async handler(html) {
      return html.replace('<!--startup-styles-->', `<style>${await fs.readFile(path.join(root, 'src/loading/shell.css'), 'utf8')}</style>`);
    } },
    async transform(source, id) {
      if (!production) return;
      const filename = id.split('?')[0].replaceAll('\\', '/');
      if (filename === path.join(root, 'src/art/urls.js').replaceAll('\\', '/')) {
        const files = await Promise.all(runtimePaths.map(prepare));
        const imports = files.map((file, i) => `import a${i} from ${JSON.stringify(file.replaceAll('\\', '/') + '?url')};`).join('\n');
        return { code: `${imports}\nconst urls={${runtimePaths.map((name, i) => `${JSON.stringify(name)}:a${i}`).join(',')}};\nexport function assetUrl(path){if(!urls[path])throw Error('Unlisted runtime asset: '+path);return urls[path];}`, map: null };
      }
      if (!filename.startsWith(root.replaceAll('\\', '/') + '/src/') || !filename.endsWith('.css')) return;
      let result = source;
      for (const match of source.matchAll(/url\(['"]?\/(art\/[^)'"\s]+|fonts\/[^)'"\s]+)['"]?\)/g)) {
        const file = await prepare(match[1]);
        const relative = path.relative(path.dirname(filename), file).replaceAll('\\', '/');
        result = result.replaceAll(match[0], `url('${relative.startsWith('.') ? relative : './' + relative}')`);
      }
      return { code: result, map: null };
    },
    generateBundle(_options, bundle) {
      let revision = 'unknown';
      try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
      const assets = [...records.values()].sort((a, b) => a.source.localeCompare(b.source));
      this.emitFile({ type: 'asset', fileName: 'resource-sizes.json', source: JSON.stringify({ tool: `sharp ${sharp.versions.sharp}`, options: { quality: 85, alphaQuality: 100, resize: false }, sourceBytes: assets.reduce((sum, a) => sum + a.sourceBytes, 0), runtimeBytes: assets.reduce((sum, a) => sum + a.runtimeBytes, 0), assets }, null, 2) });
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ game: 'magnet-sort', revision, base, minified: true, assets: Object.keys(bundle).filter(file => file.startsWith('assets/')).sort() }) });
    },
  };
}
