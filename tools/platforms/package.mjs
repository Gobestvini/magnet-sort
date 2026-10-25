import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { readArtifact } from './stage-publication.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function packageEmbed({ input = 'dist/embed', output = 'artifacts/magnet-sort-embed', target = 'embed' } = {}) {
  const artifact = await readArtifact(input, target);
  const destination = path.resolve(output);
  if (destination === artifact.root || destination.startsWith(artifact.root + path.sep)) throw Error('Package must be outside input');
  const zipped = Object.create(null), files = [];
  for (const file of artifact.files) {
    const bytes = await fs.readFile(path.join(artifact.root, file));
    files.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
    zipped[file] = [bytes, { mtime: new Date(1980, 0, 1), level: 9, os: 0, attrs: 0 }];
  }
  const zip = zipSync(zipped);
  const manifest = { schemaVersion: 1, game: 'magnet-sort', target, revision: artifact.info.revision, files, zip: { file: 'magnet-sort.zip', bytes: zip.length, sha256: hash(zip) } };
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(destination); // Immutable release: never overwrite an accepted package.
  await fs.writeFile(path.join(destination, manifest.zip.file), zip, { flag: 'wx' });
  await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await packageEmbed({ output: process.argv[2] || undefined })));
