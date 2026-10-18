import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { backportWorkerScope } from '../deploy/backport-worker-scope.mjs';

const original = readFileSync(new URL('./fixtures/white-tower-root-sw.js', import.meta.url), 'utf8');
function worker(source, scope = 'https://studio.example/') {
  const handlers = {}, calls = { fetched:0, activated:0, cacheWrites:0, cacheDeletes:0 };
  const cacheName = `white-tower-${new URL(scope).pathname}-build-ef2bd248cabedc52`;
  vm.runInNewContext(source, { URL, Response, Map,
    fetch: async () => { calls.fetched++; throw Error('No network needed for an installed same-cache hotfix'); },
    caches: { keys:async()=>[cacheName], open:async()=>({match:async()=>new Response('White Tower cached shell')}), match:async()=>undefined, delete:async()=>{calls.cacheDeletes++;} },
    self: { registration:{scope,active:{}}, location:{origin:'https://studio.example'},
      addEventListener:(name,callback)=>{handlers[name]=callback;}, skipWaiting:async()=>{calls.activated++;},
      clients:{matchAll:async()=>[{id:'tower',url:scope},{id:'magnet',url:new URL('magnet-sort/',scope).href}]} },
  });
  return {handlers,calls};
}
test('fixture reproduces the cached root game replacing another project navigation',async()=>{
  const {handlers}=worker(original);let response;
  handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://studio.example/magnet-sort/'},respondWith:value=>{response=value;}});
  assert.equal(await(await response).text(),'White Tower cached shell');
});
test('backport delegates foreign navigation/assets/APIs, preserving own offline shell at root and subpath',async()=>{
  for(const scope of ['https://studio.example/','https://studio.example/tower/']){
    const {handlers}=worker(backportWorkerScope(original),scope);
    for(const [relative,mode] of [['magnet-sort/?seed=1','navigate'],['telegram/','navigate'],['payment-test/','navigate'],['magnet-sort/assets/app.js','cors'],['account','cors'],['assets/app.js','navigate']]){
      let response;handlers.fetch({request:{method:'GET',mode,url:new URL(relative,scope).href},respondWith:value=>{response=value;}});assert.equal(response,undefined,relative);
    }
    let response;handlers.fetch({request:{method:'GET',mode:'navigate',url:scope+'?level=1'},respondWith:value=>{response=value;}});
    assert.equal(await(await response).text(),'White Tower cached shell');
  }
});
test('same-cache backport activates without network/cache deletion, foreign tab does not block safe update',async()=>{
  const {handlers,calls}=worker(backportWorkerScope(original));let pending;
  handlers.install({waitUntil:value=>{pending=value;}});await pending;
  assert.deepEqual(calls,{fetched:0,activated:1,cacheWrites:0,cacheDeletes:0});
  handlers.message({data:{type:'WHITE_TOWER_UPDATE_STATE',safe:true},source:{id:'tower'},waitUntil:value=>{pending=value;}});await pending;
  assert.equal(calls.activated,2);
});
test('backport is idempotent and refuses unexpected sources',()=>{
  const patched=backportWorkerScope(original);
  assert.equal(backportWorkerScope(patched),patched);
  assert.equal(patched.match(/^const CACHE_NAME = .*$/m)[0],original.match(/^const CACHE_NAME = .*$/m)[0]);
  assert.throws(()=>backportWorkerScope('unexpected'),/Expected a deployed/);
});
