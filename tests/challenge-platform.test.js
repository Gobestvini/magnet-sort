import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebPlatform } from '../src/platforms/web/adapter.js';
import { createEmbedPlatform } from '../src/platforms/embed/adapter.js';
import { createTelegramPlatform } from '../src/platforms/telegram/adapter.js';
import { readWebChallenge, readTelegramChallenge, webChallengeLink, telegramChallengeLink } from '../src/platforms/challenge-links.js';
import { setRuntimePlatform, getRuntimePlatform, clearRuntimePlatform } from '../src/platforms/runtime-context.js';

const payload = 'ms1_Test-canonical_0';
const empty = {payload:null,error:null};
function fakeRoot() {
  const styles = new Map(), attrs = new Map();
  return {style:{getPropertyValue:key=>styles.get(key)??'',getPropertyPriority:()=>'',setProperty:(key,value)=>styles.set(key,value),removeProperty:key=>styles.delete(key)},
    getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)};
}
async function telegram({version='8.0',search='',initData='auth_date=0',open=true}={}) {
  const calls=[],handlers=new Map();
  const bridge={version,initData,expand(){},ready(){},onEvent:(key,fn)=>handlers.set(key,fn),offEvent:key=>handlers.delete(key)};
  if(open)bridge.openTelegramLink=url=>{calls.push(url);if(open==='throw')throw Error('unavailable');};
  // Client sharing never needs identity or unverified profile fields.
  Object.defineProperty(bridge,'initDataUnsafe',{get(){throw Error('Profile access is outside challenge sharing');}});
  const platform=createTelegramPlatform({root:fakeRoot(),load:async()=>bridge,location:{search}});
  await platform.init();return {platform,calls,handlers,bridge};
}

test('web launch is opaque and bounded; duplicate, empty and malformed query values are not silently chosen',()=>{
  assert.deepEqual(readWebChallenge(''),empty);
  assert.deepEqual(readWebChallenge('?challenge='+payload),{payload,error:null});
  for(const search of ['?challenge=','?challenge=a%20b','?challenge='+'a'.repeat(161)])assert.equal(readWebChallenge(search).error,'invalid');
  assert.equal(readWebChallenge('?challenge='+payload+'&challenge='+payload).error,'duplicate');
  assert.equal(readWebChallenge('?challenge='+payload+'&%63hallenge=other').error,'duplicate');
  assert.deepEqual(readWebChallenge('?unrelated=1'),empty);
  assert.deepEqual(readWebChallenge('?challenge='+'A'.repeat(160)),{payload:'A'.repeat(160),error:null});
});

test('Telegram launch reconciles the two official sources, rejects ambiguity, and ignores account fields',()=>{
  assert.deepEqual(readTelegramChallenge('auth_date=0&start_param='+payload,'?tgWebAppStartParam='+payload),{payload,error:null});
  assert.deepEqual(readTelegramChallenge('auth_date=0','?tgWebAppStartParam='+payload),{payload,error:null});
  assert.deepEqual(readTelegramChallenge('user=opaque&start_param='+payload,''),{payload,error:null});
  assert.deepEqual(readTelegramChallenge('start_param=','?tgWebAppStartParam='),empty);
  assert.equal(readTelegramChallenge('start_param='+payload,'?tgWebAppStartParam=other').error,'conflict');
  assert.equal(readTelegramChallenge('start_param='+payload+'&start_param='+payload,'').error,'duplicate');
  assert.equal(readTelegramChallenge('start_param='+payload,'?tgWebAppStartParam='+payload+'&tgWebAppStartParam='+payload).error,'duplicate');
  assert.equal(readTelegramChallenge('start_param=%3Cscript%3E','').error,'invalid');
});

test('receiver links remove sender query/hash and never carry account or final-state data',()=>{
  const web=new URL(webChallengeLink(payload,'https://example.test/magnet-sort/index.html?seed=42&other=1#old'));
  assert.equal(web.origin,'https://example.test');assert.equal(web.pathname,'/magnet-sort/');assert.equal(web.hash,'');
  assert.deepEqual([...web.searchParams],[['challenge',payload]]);
  const tg=new URL(telegramChallengeLink(payload));assert.equal(tg.href,'https://t.me/MagnetSortPuzzleBot?startapp='+payload);
  for(const value of ['', 'a&user=bad','a'.repeat(161),undefined]){
    assert.throws(()=>webChallengeLink(value),/Invalid challenge/);assert.throws(()=>telegramChallengeLink(value),/Invalid challenge/);
  }
  assert.equal(new URL(webChallengeLink(payload,'javascript:alert(1)')).origin,'https://gobestvini.github.io');
});

test('Telegram chooser opens only on the explicit share call and its result does not claim delivery',async()=>{
  const {platform,calls,handlers}=await telegram({initData:'auth_date=0&start_param='+payload,search:'?tgWebAppStartParam='+payload});
  platform.ready();assert.deepEqual(platform.getLaunchChallenge(),{payload,error:null});assert.deepEqual(calls,[]);
  const result=platform.shareChallenge(payload);assert.deepEqual(result,{status:'opened',url:telegramChallengeLink(payload)});assert.equal(calls.length,1);
  const chooser=new URL(calls[0]);assert.equal(chooser.origin,'https://t.me');assert.equal(chooser.pathname,'/share/url');
  assert.equal(chooser.searchParams.get('url'),telegramChallengeLink(payload));assert.match(chooser.searchParams.get('text'),/unverified/);
  assert.equal('delivered' in result,false);assert.equal('sent' in result,false);
  platform.dispose();assert.equal(handlers.size,0);assert.deepEqual(platform.getLaunchChallenge(),empty);
  assert.equal(platform.shareChallenge(payload).status,'unsupported');assert.equal(calls.length,1);
});

test('Telegram share is capability/version gated including the 6.1 minor boundary and catches errors',async()=>{
  for(const [version,open,status] of [['6.0',true,'unsupported'],['6.1',true,'opened'],['6.10',true,'opened'],['7.0',true,'opened'],['bad',true,'unsupported'],['8.0',false,'unsupported'],['8.0','throw','error']]){
    const {platform,calls}=await telegram({version,open});assert.deepEqual(calls,[]);
    const result=platform.shareChallenge(payload);assert.equal(result.status,status);assert.equal(result.url,telegramChallengeLink(payload));
    assert.equal(calls.length,status==='unsupported'?0:1);platform.dispose();
  }
});

test('web native sharing is user initiated, reports cancellation/errors, and always keeps a fallback URL',async()=>{
  for(const outcome of ['opened','cancelled','error']){
    const calls=[],navigator={canShare:()=>true,share:async value=>{calls.push(value);if(outcome!=='opened')throw Object.assign(Error('unavailable'),{name:outcome==='cancelled'?'AbortError':'Error'});}};
    const platform=createWebPlatform({location:{href:'https://example.test/game/?seed=1',search:'?challenge='+payload},navigator});
    await platform.init();platform.ready();assert.equal(calls.length,0);assert.equal(platform.getLaunchChallenge().payload,payload);
    const promise=platform.shareChallenge(payload);assert.equal(calls.length,1,'native chooser invoked before yielding the user gesture');
    const result=await promise;assert.equal(result.status,outcome);assert.equal(result.url,'https://example.test/game/?challenge='+payload);
    assert.equal('delivered' in result,false);platform.dispose();assert.equal((await platform.shareChallenge(payload)).status,'unsupported');assert.equal(calls.length,1);
  }
  for(const navigator of [{},{share:async()=>assert.fail('unsupported data must not open chooser'),canShare:()=>false}]){
    const platform=createWebPlatform({navigator});assert.equal((await platform.shareChallenge(payload)).status,'unsupported');platform.dispose();
  }
});

test('embed only exposes a public web link and never invokes an OS chooser',async()=>{
  let calls=0;
  const platform=createEmbedPlatform({location:{href:'https://host.test/frame/embed/',search:'?challenge='+payload},navigator:{share(){calls++;}}});
  await platform.init();assert.deepEqual(platform.getLaunchChallenge(),{payload,error:null});
  assert.deepEqual(platform.shareChallenge(payload),{status:'unsupported',url:'https://gobestvini.github.io/magnet-sort/?challenge='+payload});assert.equal(calls,0);
  platform.dispose();assert.deepEqual(platform.getLaunchChallenge(),empty);
});

test('disposing an old bootstrap cannot clear the platform installed for a newer runtime',()=>{
  const first=createWebPlatform(),second=createEmbedPlatform();setRuntimePlatform(first);assert.equal(getRuntimePlatform(),first);
  setRuntimePlatform(second);clearRuntimePlatform(first);assert.equal(getRuntimePlatform(),second);
  clearRuntimePlatform(second);assert.equal(getRuntimePlatform(),null);first.dispose();second.dispose();
});
