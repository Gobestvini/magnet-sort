import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrowthServer } from '../server/main.mjs';
import { createTelemetryService } from '../server/telemetry.mjs';

async function fixture(run, options={}) {
  const telemetry=createTelemetryService();
  const calls=[];
  const commerce={available:()=>false,catalog:()=>({products:[]}),authenticate:()=>{throw Object.assign(new Error(),{status:503,code:'commerce-unavailable'});},
    entitlements:()=>({entitlements:[]}),createInvoice:()=>({}),webhook:async body=>{calls.push(body);return {ok:true};},
    refund:async()=>({refunded:true}),reconciliation:()=>[],reconcile:async()=>({refunded:0}),close(){}};
  const app=createGrowthServer({telemetry,commerce,adminToken:'admin-secret',webhookSecret:'webhook-secret',...options});
  await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
  const base='http://127.0.0.1:'+app.server.address().port;
  try {await run({base,calls});}finally{await app.close();}
}
test('growth API isolates origins, hides admin and secrets, offers honest unavailable shop',()=>fixture(async({base})=>{
  const denied=await fetch(base+'/v1/health',{headers:{Origin:'https://evil.invalid'}});
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  const allowed=await fetch(base+'/v1/health',{headers:{Origin:'https://play.plusvibegames.com'}});
  assert.equal(allowed.status,200);assert.equal(allowed.headers.get('cache-control'),'no-store');
  assert.equal(allowed.headers.get('access-control-allow-origin'),'https://play.plusvibegames.com');
  assert.equal((await allowed.json()).purchases,false);
  assert.equal((await fetch(base+'/v1/admin/analytics')).status,401);
  assert.equal((await fetch(base+'/v1/admin/analytics',{headers:{Authorization:'Bearer admin-secret'}})).status,200);
  assert.deepEqual(await (await fetch(base+'/v1/commerce/catalog')).json(),{products:[]});
  const bad=await fetch(base+'/v1/commerce/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"initData":"private"}'});
  assert.equal(bad.status,503);assert.equal((await bad.text()).includes('private'),false);
  assert.equal((await fetch(base+'/v1/analytics/events',{method:'POST',body:'not-json'})).status,415);
  assert.equal((await fetch(base+'/v1/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
}));
test('public analytics rate exhaustion never blocks authenticated payment webhook or admin',()=>fixture(async({base,calls})=>{
  assert.equal((await fetch(base+'/v1/health')).status,200);
  assert.equal((await fetch(base+'/v1/health')).status,429);
  const webhook=await fetch(base+'/v1/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'webhook-secret'},body:'{"update_id":1}'});
  assert.equal(webhook.status,200);assert.equal(calls.length,1);
  assert.equal((await fetch(base+'/v1/admin/analytics',{headers:{Authorization:'Bearer admin-secret'}})).status,200);
  assert.equal((await fetch(base+'/v1/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
},{maxRequestsPerMinute:1}));
test('oversized requests are rejected and preflight exposes only allowed methods',()=>fixture(async({base})=>{
  const response=await fetch(base+'/v1/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:'x'.repeat(70_000)})});
  assert.equal(response.status,413);
  const preflight=await fetch(base+'/v1/commerce/auth',{method:'OPTIONS',headers:{Origin:'https://gobestvini.github.io'}});
  assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);
}));
test('anonymous catalog exhaustion cannot block private commerce restoration',()=>fixture(async({base})=>{
  assert.equal((await fetch(base+'/v1/commerce/catalog')).status,200);
  assert.equal((await fetch(base+'/v1/commerce/catalog')).status,429);
  assert.equal((await fetch(base+'/v1/commerce/entitlements',{headers:{Authorization:'Bearer valid-test'}})).status,200);
},{maxRequestsPerMinute:1}));
