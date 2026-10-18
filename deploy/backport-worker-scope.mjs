// Worker-only backport for the already deployed White Tower release.
// Preserve its exact cache identity and content; future builds use the source fix.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export function backportWorkerScope(input) {
  let source = input.replaceAll('\r\n', '\n');
  const marker = '// Shared-origin worker scope hotfix v1';
  if (source.includes(marker)) return source;
  const cacheIdentity = source.match(/^const CACHE_NAME = .*build-[a-f0-9]{16}.*;$/m)?.[0];
  if (!cacheIdentity) throw new Error('Expected a deployed, versioned White Tower worker');
  function replace(before, after) {
    if (source.split(before).length !== 2) throw new Error('Unexpected worker source; no backport applied: ' + before.slice(0, 60));
    source = source.replace(before, after);
  }
  replace('const updateStates = new Map();', `${marker}
const isGameDocument = value => {
  const url = new URL(value);
  return url.origin === new URL(self.registration.scope).origin &&
    [new URL(gameUrl('/')).pathname, new URL(gameUrl('/index.html')).pathname].includes(url.pathname);
};
const isGameResource = url => ['assets/', 'content/'].some(path => url.href.startsWith(gameUrl(path))) ||
  ['manifest.webmanifest', 'white-tower.svg', 'art-assets.json', 'runtime-assets.json', 'build-info.json', 'sw.js'].some(path => url.pathname === new URL(gameUrl(path)).pathname);
const updateStates = new Map();`);
  replace('.filter(client => client.url.startsWith(self.registration.scope) && !client.url.startsWith(gameUrl(\'/telegram/\')))', '.filter(client => isGameDocument(client.url))');
  replace("if (new URL(request.url).pathname === new URL(gameUrl('/telegram')).pathname || request.url.startsWith(gameUrl('/telegram/'))) return;", "if (request.mode === 'navigate' ? !isGameDocument(request.url) : !isGameDocument(request.url) && !isGameResource(new URL(request.url))) return;");
  replace("self.addEventListener('install', event => {\n  event.waitUntil((async () => {", `self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Same content/cache: activate the routing fix without recaching or deleting it.
    // A first install still performs the original complete offline preparation.
    if (self.registration.active && (await caches.keys()).includes(CACHE_NAME)) {
      await self.skipWaiting();
      return;
    }`);
  if (!source.includes(cacheIdentity)) throw new Error('Cache identity changed');
  new vm.Script(source);
  return source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || resolve(input) === resolve(output)) throw new Error('Usage: node backport-worker-scope.mjs DEPLOYED_SW STAGED_SW (distinct files)');
  writeFileSync(output, backportWorkerScope(readFileSync(input, 'utf8')));
  console.log('Staged worker scope backport; deployed cache/build identity preserved.');
}
