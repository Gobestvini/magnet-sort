import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboardsClient, createLeaderboardsController, rankingDescriptor } from '../src/prototype/leaderboards-client.js';
import { getDaily } from '../src/prototype/daily-v4.js';

const baseUrl = 'https://api.example.test/magnet-sort/v1';
const storage = () => { const entries = new Map(); return { getItem: k => entries.get(k) ?? null, setItem: (k,v) => entries.set(k,v), removeItem: k => entries.delete(k), entries }; };
const response = (data,status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json'}});
const snapshot = () => ({ mode:'campaign', state:{terminal:null}, attempt:{levelId:'magnet-v4-01',seed:0,actions:[],assisted:false}, daily:{today:'2026-10-25',entry:null}, saveStatus:{saved:true,reason:null} });
const tick = () => new Promise(resolve=>setImmediate(resolve));
function service() {
  const calls=[];let count=0;
  return {calls, async fetch(url,options){
    const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;calls.push({path,body,options});
    if(path.endsWith('/auth/telegram'))return response({token:'valid-service-token',expiresAt:Date.now()+86400000,player:{playerId:'self',displayName:'Player'}});
    if(path.endsWith('/runs'))return response({runId:'run-'+(++count),descriptor:body.descriptor,expiresAt:Date.now()+86400000});
    if(path.endsWith('/result'))return response({receipt:{runId:path.split('/').at(-2)},metrics:{moves:3,stars:3,cleared:50}});
    return response({rows:[],ownRow:null});
  }};
}
function setup(options={}) {
  let active=snapshot();const api=service(),local=storage(),session=storage();let ids=0,changes=0;
  const controller=createLeaderboardsController({capability:{apiUrl:baseUrl,authenticate:()=> 'signed-launch-data'},getSnapshot:()=>active,onChange:()=>changes++,storage:local,sessionStorage:session,fetch:api.fetch,newId:()=> 'attempt-'+(++ids),...options});
  return {controller,api,local,session,get active(){return active;},set active(value){active=value;},get changes(){return changes;}};
}

test('campaign and daily descriptors use the actual immutable mode, not UI totals',()=>{
  const active=snapshot();assert.equal(rankingDescriptor(active).presetId,'campaign-a-v1');
  active.mode='daily';active.daily.entry=getDaily('2026-10-25');active.attempt={...active.attempt,...active.daily.entry};
  const daily=rankingDescriptor(active);assert.equal(daily.date,'2026-10-25');assert.equal(daily.presetId,'short-b-2026-10-25.1');assert.equal(daily.rulesVersion,4);assert.equal(daily.index,undefined);
});

test('fresh Telegram auth is bootstrapped once without storing launch data or publishing',async()=>{
  const x=setup();await x.controller.bootstrap();await x.controller.bootstrap();
  assert.equal(x.api.calls.filter(c=>c.path.endsWith('/auth/telegram')).length,1);
  assert.equal(x.api.calls.filter(c=>c.path.endsWith('/runs')).length,0);
  const stored=JSON.stringify([...x.local.entries,...x.session.entries]);assert.ok(!stored.includes('signed-launch-data'));assert.ok(stored.includes('valid-service-token'));x.controller.dispose();
});

test('consent registers an attempt, accepted owner journal submits only on victory',async()=>{
  const x=setup();await x.controller.join();assert.equal(x.controller.view.publication,'registered');
  assert.equal(x.api.calls.filter(c=>c.path.endsWith('/result')).length,0);
  x.active.attempt.actions=[{type:'placeMagnet',color:'blue',cell:{col:2,row:1}}];x.active.attempt.assisted=true;x.active.state.terminal='won';x.controller.observe();await tick();
  const submission=x.api.calls.find(c=>c.path.endsWith('/result'));assert.deepEqual(submission.body,{actions:x.active.attempt.actions,assisted:true});
  assert.equal(x.controller.view.publication,'sent');x.controller.observe();await tick();assert.equal(x.api.calls.filter(c=>c.path.endsWith('/result')).length,1);x.controller.dispose();
});

test('repeat observation after a registered nonterminal turn does not prevent the later win',async()=>{
  const x=setup();await x.controller.join();for(let i=0;i<4;i++)x.controller.observe();await tick();
  assert.equal(x.controller.debug().pendingPublications,0);x.active.state.terminal='won';x.controller.observe();await tick();assert.equal(x.controller.view.publication,'sent');x.controller.dispose();
});

test('reload keeps ranked identity and runId; Undo keeps identity; gameplay Retry renews it',async()=>{
  const x=setup();await x.controller.join();const register=x.api.calls.find(c=>c.path.endsWith('/runs')).body;
  x.controller.dispose();
  const next=createLeaderboardsController({capability:{apiUrl:baseUrl,authenticate:()=> 'signed-launch-data'},getSnapshot:()=>x.active,storage:x.local,sessionStorage:x.session,fetch:x.api.fetch,newId:()=> 'next-attempt'});
  await next.bootstrap();x.active.attempt.assisted=true;next.observe();await tick();assert.equal(x.api.calls.filter(c=>c.path.endsWith('/runs')).length,1);
  next.renew('campaign');next.observe();await tick();assert.equal(x.api.calls.filter(c=>c.path.endsWith('/runs')).at(-1).body.clientAttemptId,'next-attempt');assert.notEqual(register.clientAttemptId,'next-attempt');next.dispose();
});

test('lost registration response is retried with the same clientAttemptId',async()=>{
  const local=storage(),session=storage(),calls=[];let first=true;
  const fetcher=async(url,options)=>{const body=options.body&&JSON.parse(options.body);if(url.includes('/auth/'))return response({token:'token',expiresAt:Date.now()+10000});if(url.endsWith('/runs')){calls.push(body);if(first){first=false;throw Error('network');}return response({runId:'same-run'});}return response({rows:[],ownRow:null});};
  const x=setup({storage:local,sessionStorage:session,fetch:fetcher});await x.controller.join();assert.equal(x.controller.view.publication,'error');await x.controller.retryPublication();assert.equal(calls.length,2);assert.equal(calls[0].clientAttemptId,calls[1].clientAttemptId);x.controller.dispose();
});

test('lost submission acknowledgment repeats the original run and never creates a new attempt',async()=>{
  let active=snapshot(),submits=0,registrations=0;active.state.terminal='won';const bodies=[];
  const fetcher=async(url,options)=>{if(url.includes('/auth/'))return response({token:'token',expiresAt:Date.now()+10000});if(url.endsWith('/runs')){registrations++;return response({runId:'same-run'});}if(url.endsWith('/result')){submits++;bodies.push(options.body);if(submits===1)throw Error('lost after commit');return response({receipt:{runId:'same-run'}});}return response({rows:[],ownRow:null});};
  const x=setup({fetch:fetcher,getSnapshot:()=>active});await x.controller.join();x.controller.observe();await tick();assert.equal(submits,1,'no automatic retry loop');await x.controller.retryPublication();assert.equal(registrations,1);assert.equal(submits,2);assert.equal(bodies[0],bodies[1]);x.controller.dispose();
});

test('late campaign read cannot overwrite the newly selected daily view',async()=>{
  const requests=[];const fetcher=(url,options)=>new Promise((resolve,reject)=>{const item={url,resolve};requests.push(item);options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
  const x=setup({fetch:fetcher});x.controller.open();x.controller.tab('daily');
  requests[1].resolve(response({rows:[{playerId:'daily-player',displayName:'Daily',rank:1,moves:7}],ownRow:null}));await tick();
  requests[0].resolve(response({rows:[{playerId:'campaign-player',displayName:'Campaign',rank:1,completedLevels:4,stars:12}],ownRow:null}));await tick();
  assert.equal(x.controller.view.tab,'daily');assert.equal(x.controller.view.rows[0].playerId,'daily-player');x.controller.dispose();
});

test('close and dispose abort active reads and ignore late responses',async()=>{
  const signals=[];let resolve;
  const x=setup({fetch:(_url,options)=>{signals.push(options.signal);return new Promise(r=>{resolve=r;});}});
  x.controller.open();x.controller.close();assert.equal(signals[0].aborted,true);resolve(response({rows:[],ownRow:null}));await tick();assert.equal(x.controller.view.open,false);
  x.controller.open();x.controller.dispose();assert.equal(signals[1].aborted,true);resolve(response({rows:[],ownRow:null}));await tick();assert.equal(x.controller.debug().pendingRequests,0);
});

test('web read-only supports both rankings without attempting Telegram auth',async()=>{
  const api=service();const x=setup({capability:{apiUrl:baseUrl},fetch:api.fetch});await x.controller.bootstrap();x.controller.open();await tick();x.controller.tab('daily');await tick();await x.controller.join();
  assert.equal(x.controller.view.canParticipate,false);assert.equal(api.calls.length,2);assert.ok(api.calls.every(c=>c.options.credentials==='omit'));x.controller.dispose();
});

test('expired auth clears only service credentials, preserving campaign and attempt data',async()=>{
  const session=storage();const api=service();let expired=false;const active=snapshot();
  const x=setup({getSnapshot:()=>active,sessionStorage:session,fetch:async(url,opts)=>expired?response({error:{code:'AUTH_EXPIRED'}},401):api.fetch(url,opts)});
  await x.controller.bootstrap();expired=true;await x.controller.join();assert.equal(x.controller.view.signedIn,false);assert.equal(x.controller.view.publicationError,'AUTH_EXPIRED');assert.deepEqual(active,snapshot());assert.equal(session.entries.size,0);x.controller.dispose();
});

test('save conflict prevents publication without altering local journal',async()=>{
  const x=setup();x.active.saveStatus={saved:false,reason:'conflict'};await x.controller.join();assert.equal(x.api.calls.length,0);assert.equal(x.controller.view.publicationError,'SAVE_CONFLICT');x.controller.dispose();
});

test('pause sharing while registration is in flight prevents a new result submission',async()=>{
  let release;const api=service();let active=snapshot();active.state.terminal='won';
  const x=setup({getSnapshot:()=>active,fetch:async(url,opts)=>url.endsWith('/runs')?new Promise(r=>{release=()=>r(response({runId:'late-run'}));}):api.fetch(url,opts)});
  const joined=x.controller.join();await tick();x.controller.leave();release();await joined;assert.equal(api.calls.filter(c=>c.path.endsWith('/result')).length,0);x.controller.dispose();
});

test('malformed rows fail visibly rather than mounting unlimited or invalid player content',async()=>{
  const x=setup({fetch:async()=>response({rows:[{playerId:'x',displayName:'X'.repeat(10000),rank:1,moves:1}],ownRow:null})});x.controller.open();await tick();assert.equal(x.controller.view.status,'error');assert.equal(x.controller.view.error,'INVALID_RESPONSE');x.controller.dispose();
});

test('service account removal clears only ranking credentials and consent',async()=>{
  const active=snapshot(),api=service();const x=setup({getSnapshot:()=>active,fetch:api.fetch});await x.controller.bootstrap();await x.controller.join();x.controller.open();await tick();await x.controller.remove();assert.equal(x.controller.view.consent,false);assert.equal(x.controller.view.signedIn,false);assert.deepEqual(active,snapshot());const call=api.calls.find(c=>c.options.method==='DELETE');assert.deepEqual(call.body,{confirm:'delete-leaderboards'});x.controller.dispose();
});

test('unsent winning journal survives owner advancing on reload and retry uses the original run',async()=>{
  let active=snapshot();active.state.terminal='won';active.attempt.actions=[{type:'placeMagnet',color:'blue',cell:{col:2,row:3}}];active.attempt.assisted=true;
  const original=structuredClone(active.attempt),local=storage(),session=storage(),api=service();let fail=true;
  const fetcher=async(url,opts)=>url.endsWith('/result')&&fail?response({error:{code:'DATABASE_BUSY',retryable:true}},503):api.fetch(url,opts);
  const create=()=>createLeaderboardsController({capability:{apiUrl:baseUrl,authenticate:()=> 'signed-launch-data'},getSnapshot:()=>active,storage:local,sessionStorage:session,fetch:fetcher,newId:()=>crypto.randomUUID()});
  const first=create();await first.join();assert.equal(first.view.pendingCount,1);const originalRun=api.calls.find(c=>c.path.endsWith('/runs')).body;first.dispose();
  active=snapshot();active.attempt.levelId='magnet-v4-02';active.attempt.seed=19;
  const restored=create();await restored.bootstrap();await tick();assert.equal(restored.view.pendingCount,1);assert.equal(restored.view.publication,'error');
  fail=false;await restored.retryPublication();const result=api.calls.find(c=>c.path.endsWith('/result'));
  assert.deepEqual(result.body,{actions:original.actions,assisted:true});const originalRegistration=api.calls.filter(c=>c.path.endsWith('/runs')).find(c=>c.body.clientAttemptId===originalRun.clientAttemptId);assert(originalRegistration);
  assert.equal(result.path,'/magnet-sort/v1/runs/run-1/result');assert.equal(restored.view.pendingCount,0);assert.equal(active.attempt.levelId,'magnet-v4-02');restored.dispose();
});

test('lost ack winning journal is not overwritten by gameplay Retry or a second win',async()=>{
  let active=snapshot();active.state.terminal='won';active.attempt.actions=[{type:'placeMagnet',color:'blue',cell:{col:1,row:1}}];
  const firstActions=structuredClone(active.attempt.actions),local=storage(),session=storage(),api=service(),submissions=[];let fail=true;
  const fetcher=async(url,opts)=>{if(url.endsWith('/result')){submissions.push({url,body:JSON.parse(opts.body)});if(fail)throw Error('lost acknowledgment');}return api.fetch(url,opts);};
  const x=setup({storage:local,sessionStorage:session,fetch:fetcher,getSnapshot:()=>active,newId:()=>crypto.randomUUID()});await x.controller.join();
  x.controller.renew('campaign');active.attempt.actions=[{type:'placeMagnet',color:'coral',cell:{col:4,row:3}}];x.controller.observe();await tick();assert.equal(submissions.length,1,'failed old result not automatically retried');
  const stored=JSON.parse([...local.entries.values()][0]);assert.deepEqual(stored.pending.campaign.snapshot.attempt.actions,firstActions);assert.equal(Object.keys(stored.pending).length,1);
  fail=false;await x.controller.retryPublication();assert.equal(submissions[1].url,submissions[0].url);assert.deepEqual(submissions[1].body,submissions[0].body);x.controller.dispose();
});

test('both pending mode journals survive reload within a bounded 512 KiB envelope',async()=>{
  let active=snapshot();active.state.terminal='won';active.attempt.actions=Array.from({length:2048},()=>({type:'placeMagnet',color:'blue',cell:{col:2,row:3}}));
  const local=storage(),session=storage(),api=service();const fetcher=async(url,opts)=>url.endsWith('/result')?response({error:{code:'DATABASE_BUSY'}},503):api.fetch(url,opts);
  const config={capability:{apiUrl:baseUrl,authenticate:()=> 'signed-launch-data'},getSnapshot:()=>active,storage:local,sessionStorage:session,fetch:fetcher,newId:()=>crypto.randomUUID()};
  const first=createLeaderboardsController(config);await first.join();active={...active,mode:'daily',daily:{entry:getDaily('2026-10-25'),today:'2026-10-25'},attempt:{...active.attempt,...getDaily('2026-10-25')}};first.observe();await tick();
  assert.equal(first.view.pendingCount,2);assert.equal(first.view.rankingSaveFailed,false);assert([...local.entries.values()][0].length<512*1024);first.dispose();
  const restored=createLeaderboardsController(config);assert.equal(restored.view.pendingCount,2);assert.equal(restored.view.pendingMode,'daily');restored.discardPending();assert.equal(restored.view.pendingCount,1);assert.equal(restored.view.pendingMode,'campaign');restored.dispose();
});

test('a stale tab cannot erase a different tab’s saved pending winner',async()=>{
  const local=storage(),session=storage(),api=service();let active=snapshot();active.state.terminal='won';active.attempt.actions=[{type:'placeMagnet',color:'blue',cell:{col:1,row:2}}];
  const config={capability:{apiUrl:baseUrl,authenticate:()=> 'signed-launch-data'},getSnapshot:()=>active,storage:local,sessionStorage:session,fetch:async(url,opts)=>url.endsWith('/result')?response({error:{code:'DATABASE_BUSY'}},503):api.fetch(url,opts),newId:()=>crypto.randomUUID()};
  const a=createLeaderboardsController(config),b=createLeaderboardsController(config);await a.join();assert.equal(a.view.pendingCount,1);
  const protectedRaw=[...local.entries.values()][0];b.renew('campaign');assert.equal([...local.entries.values()][0],protectedRaw);assert.equal(b.view.authError,'RANKING_CONFLICT');
  const restored=createLeaderboardsController(config);assert.equal(restored.view.pendingCount,1);a.dispose();b.dispose();restored.dispose();
});

test('a stale tab cannot resurrect a pending winner after another tab acknowledged it',async()=>{
  const local=storage(),session=storage(),api=service();let fail=true,active=snapshot();active.state.terminal='won';active.attempt.actions=[{type:'placeMagnet',color:'blue',cell:{col:1,row:2}}];
  const config={capability:{apiUrl:baseUrl,authenticate:()=> 'signed-launch-data'},getSnapshot:()=>active,storage:local,sessionStorage:session,fetch:async(url,opts)=>url.endsWith('/result')&&fail?response({error:{code:'DATABASE_BUSY'}},503):api.fetch(url,opts),newId:()=>crypto.randomUUID()};
  const a=createLeaderboardsController(config);await a.join();const stale=createLeaderboardsController(config);assert.equal(stale.view.pendingCount,1);
  fail=false;await a.retryPublication();assert.equal(a.view.pendingCount,0);stale.renew('daily');assert.equal(stale.view.authError,'RANKING_CONFLICT');
  const restored=createLeaderboardsController(config);assert.equal(restored.view.pendingCount,0);a.dispose();stale.dispose();restored.dispose();
});

test('auth lifetime follows server time when the device clock is wrong',async()=>{
  const actual=Date.now(),sent=[];const session=storage();
  const client=createLeaderboardsClient({baseUrl,authenticate:()=> 'signed-launch-data',sessionStorage:session,now:()=>actual+365*86400000,fetch:async(url,opts)=>{sent.push(opts);return url.includes('/auth/')?response({token:'server-token',expiresAt:actual+86400000,serverTime:actual}):response({rows:[],ownRow:null,serverTime:actual});}});
  await client.bootstrap();assert.equal(client.signedIn,true);await client.list('campaign','2026-10-25');assert.equal(sent.at(-1).headers.Authorization,'Bearer server-token');client.dispose();
});
