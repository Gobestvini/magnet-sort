import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { getProfile } from '../tools/platforms/profiles.mjs';
import { readArtifact, stagePublication } from '../tools/platforms/stage-publication.mjs';
import { packageEmbed } from '../tools/platforms/package.mjs';
import { createTelegramPlatform } from '../src/platforms/telegram/adapter.js';

test('unknown platform cannot silently build web', () => assert.throws(() => getProfile('toString'), /Unknown platform/));
function fakeRoot() {
  const styles = new Map(), attrs = new Map();
  return { style: { getPropertyValue: key => styles.get(key) || '', getPropertyPriority: () => '', setProperty: (key,value) => styles.set(key,value), removeProperty: key => styles.delete(key) },
    getAttribute: key => attrs.get(key) ?? null, setAttribute: (key,value) => attrs.set(key,value), removeAttribute: key => attrs.delete(key) };
}
test('Telegram readiness, activity, stable geometry and disposal', async () => {
  const root = fakeRoot(), handlers = new Map(); let expanded = 0, ready = 0;
  const bridge = { initData: 'opaque-not-authentication', version: '8.0', isActive: false, viewportStableHeight: 700, viewportHeight: 720,
    safeAreaInset: { top: 22 }, contentSafeAreaInset: { top: 40 }, expand() { expanded++; }, ready() { ready++; },
    onEvent: (key,fn) => handlers.set(key,fn), offEvent: key => handlers.delete(key) };
  const platform = createTelegramPlatform({ root, load: async () => bridge });
  const pauses = [];
  await Promise.all([platform.init(),platform.init()]); platform.subscribePause(value => pauses.push(value));
  assert.equal(expanded,1); assert.deepEqual(pauses,[true]);
  assert.equal(root.style.getPropertyValue('--platform-inset-top'),'40px');
  bridge.viewportStableHeight = 500; bridge.viewportHeight = 600; handlers.get('viewportChanged')({ isStateStable: false });
  assert.equal(root.style.getPropertyValue('--platform-height'),'700px');
  assert.equal(root.style.getPropertyValue('--platform-visible-height'),'600px');
  handlers.get('viewportChanged')({ isStateStable: true });
  assert.equal(root.style.getPropertyValue('--platform-height'),'500px');
  handlers.get('activated')(); handlers.get('deactivated')(); assert.deepEqual(pauses,[true,false,true]);
  platform.ready(); platform.ready(); assert.equal(ready,1);
  platform.dispose(); platform.dispose(); assert.equal(handlers.size,0);
  assert.equal(root.getAttribute('data-platform-viewport'),null);
  assert.equal(root.style.getPropertyValue('--platform-height'),'');
});
test('ordinary browser launch is rejected and late init cannot become ready', async () => {
  const root = fakeRoot();
  const missing = createTelegramPlatform({ root, load: async () => ({initData:''}) });
  await assert.rejects(missing.init(), /Open Magnet Sort/); missing.dispose();
  let resolve, calls = 0;
  const late = createTelegramPlatform({ root, load: () => new Promise(done => {resolve=done;}) });
  const promise=late.init(); late.dispose(); resolve({ initData:'opaque',ready(){calls++;} }); await promise; late.ready(); assert.equal(calls,0);
});
async function fixture(root, target) {
  await fs.mkdir(path.join(root,'assets'),{recursive:true});
  const bytes=Buffer.from('console.log("fixture")'); await fs.writeFile(path.join(root,'assets/game.js'),bytes);
  const data={ 'index.html':'<!doctype html><script src="./assets/game.js"></script>', 'resource-sw.js':'// fixture', 'third-party-notices.html':'license',
    'build-info.json':JSON.stringify({game:'magnet-sort',target,base:'./',revision:'a'.repeat(40)}),
    'platform-modules.json':JSON.stringify({target,adapters:[target]}),
    'resource-cache.json':JSON.stringify({schemaVersion:1,assets:[{url:'assets/game.js',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]}) };
  for(const [name,value] of Object.entries(data))await fs.writeFile(path.join(root,name),value);
}
test('publication rejects stale output, mixed revisions and modified final bytes; ZIP repeats exactly', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'magnet-platform-'));
  try {
    const web=path.join(root,'web'),telegram=path.join(root,'telegram'),embed=path.join(root,'embed');
    await fixture(web,'web');await fixture(telegram,'telegram');await fixture(embed,'embed');
    const out=path.join(root,'public'); await stagePublication({webDir:web,telegramDir:telegram,outDir:out});
    await assert.rejects(stagePublication({webDir:web,telegramDir:telegram,outDir:out}),/empty/);
    const a=await packageEmbed({input:embed,output:path.join(root,'rc1')}), b=await packageEmbed({input:embed,output:path.join(root,'rc2')});
    assert.equal(a.zip.sha256,b.zip.sha256);
    const zipped=unzipSync(await fs.readFile(path.join(root,'rc1/magnet-sort.zip'))); assert.ok(zipped['index.html']); assert.ok(zipped['third-party-notices.html']);
    await fs.writeFile(path.join(embed,'assets/game.js'),'tampered'); await assert.rejects(readArtifact(embed,'embed'),/checksum/);
    const info=JSON.parse(await fs.readFile(path.join(telegram,'build-info.json'),'utf8'));info.revision='b'.repeat(40);
    await fs.writeFile(path.join(telegram,'build-info.json'),JSON.stringify(info));
    await assert.rejects(stagePublication({webDir:web,telegramDir:telegram,outDir:path.join(root,'mixed')}),/Mixed/);
    await fs.writeFile(path.join(web,'.env'),'fixture');await assert.rejects(readArtifact(web,'web'),/Unsafe/);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
