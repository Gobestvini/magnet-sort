import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerce} from '../src/commerce/controller.js';
import {createAdProvider,combineProviders} from '../src/commerce/providers.js';
import {createTelegramStarsProvider} from '../src/commerce/telegram.js';

test('unconfigured and Basic providers never expose ad buttons',async()=>{
  let calls=0;
  for(const id of ['none','adsense-h5','crazygames','poki','yandex','playgama','gamepix','gamedistribution','adsgram']){
    const value=createAdProvider({id,sdk:{ad:{requestAd(){calls++;}}}});
    assert.deepEqual(value.capabilities(),{rewarded:false,interstitial:false,purchases:false});
    assert.equal((await value.request('rewarded','bonus')).status,'unavailable');
  }
  const basic=createAdProvider({id:'crazygames',enabled:true,adMode:'basic',sdk:{ad:{requestAd(){calls++;}}}});
  assert.equal(basic.capabilities().rewarded,false);assert.equal(calls,0);
});

test('AdSense H5 requires adViewed, never rewards from adBreakDone alone, and respects abort',async()=>{
  let callbacks,shown=0;
  const provider=createAdProvider({id:'adsense-h5',enabled:true,sdk:{adBreak(value){callbacks=value;}}});
  const noAd=provider.request('rewarded','victory_bonus');assert.equal(callbacks.type,'reward');
  callbacks.adBreakDone({breakStatus:'viewed'});assert.equal((await noAd).status,'unavailable');
  const cancelledAd=provider.request('rewarded','victory_bonus');
  callbacks.beforeReward(()=>shown++);callbacks.beforeReward(()=>shown++);assert.equal(shown,1);
  callbacks.adDismissed();callbacks.adBreakDone({breakStatus:'dismissed'});assert.equal((await cancelledAd).status,'cancelled');
  let settled=false;
  const completedAd=provider.request('rewarded','victory_bonus').then(result=>{settled=true;return result;});
  callbacks.beforeReward(()=>shown++);callbacks.beforeAd();callbacks.adViewed();await Promise.resolve();assert.equal(settled,false);
  callbacks.adBreakDone({breakStatus:'viewed'});assert.equal((await completedAd).completed,true);
  const abort=new AbortController(),aborted=provider.request('rewarded','victory_bonus',{signal:abort.signal}),lateCallbacks=callbacks;
  abort.abort();const prior=shown;lateCallbacks.beforeReward(()=>shown++);lateCallbacks.adViewed();lateCallbacks.adBreakDone({breakStatus:'viewed'});
  assert.equal(shown,prior);assert.equal((await aborted).status,'unavailable');
  const interstitial=provider.request('interstitial','next_level');assert.equal(callbacks.type,'next');assert.equal(callbacks.beforeReward,undefined);
  callbacks.beforeAd();callbacks.adBreakDone({breakStatus:'viewed'});assert.equal((await interstitial).status,'completed');
});

test('CrazyGames v3 early promise resolution is not completion; callback grants once',async()=>{
  let callback,settled=false;
  const provider=createAdProvider({id:'crazygames',enabled:true,sdk:{ad:{async requestAd(kind,callbacks){assert.equal(kind,'rewarded');callback=callbacks;}}}});
  const result=provider.request('rewarded','bonus').then(value=>{settled=true;return value;});
  await Promise.resolve();await Promise.resolve();assert.equal(settled,false);
  callback.adFinished();callback.adError();assert.deepEqual(await result,{status:'completed',completed:true});
});

test('Yandex close is not rewarded and rewarded waits until close',async()=>{
  let callbacks;
  const provider=createAdProvider({id:'yandex',enabled:true,sdk:{adv:{showRewardedVideo(value){callbacks=value.callbacks;}}}});
  const skipped=provider.request('rewarded','bonus');callbacks.onClose();assert.equal((await skipped).status,'cancelled');
  let settled=false;const success=provider.request('rewarded','bonus').then(result=>{settled=true;return result;});
  callbacks.onRewarded();await Promise.resolve();assert.equal(settled,false);callbacks.onClose();assert.equal((await success).completed,true);
});

test('Poki, GamePix and AdsGram require exact completed results',async()=>{
  for(const [id,sdk,controllers] of [
    ['poki',{rewardedBreak:async()=>false}],['gamepix',{ads:{reward:async()=>({success:false})}}],['adsgram',null,{rewarded:{show:async()=>({done:false,error:false})}}]
  ])assert.equal((await createAdProvider({id,sdk,controllers,enabled:true}).request('rewarded','bonus')).status,'cancelled');
  for(const [id,sdk,controllers] of [
    ['poki',{rewardedBreak:async()=>true}],['gamepix',{ads:{reward:async()=>({success:true})}}],['adsgram',null,{rewarded:{show:async()=>({done:true,error:false})}}]
  ])assert.equal((await createAdProvider({id,sdk,controllers,enabled:true}).request('rewarded','bonus')).completed,true);
});

test('Playgama and GD reward events are required and subscriptions are removed',async()=>{
  const listeners=new Set();let removed=0;
  const ads={isRewardedSupported:true,on(_event,listener){listeners.add(listener);},off(_event,listener){listeners.delete(listener);removed++;},showRewarded(){for(const state of ['rewarded','closed'])for(const listener of listeners)listener(state);}};
  assert.equal((await createAdProvider({id:'playgama',sdk:{advertisement:ads},enabled:true}).request('rewarded','bonus')).completed,true);
  assert.equal(listeners.size,0);assert.equal(removed,1);
  let listener;
  const gd=createAdProvider({id:'gamedistribution',sdk:{showAd:async()=>{}},enabled:true,subscribe(fn){listener=fn;return()=>{listener=null;};}});
  assert.equal((await gd.request('rewarded','bonus')).status,'cancelled');assert.equal(listener,null);
  const abort=new AbortController();const stalled=createAdProvider({id:'playgama',sdk:{advertisement:{...ads,showRewarded(){}}},enabled:true}).request('rewarded','bonus',{signal:abort.signal});
  abort.abort();assert.equal((await stalled).status,'unavailable');assert.equal(listeners.size,0);
});

test('controller locks duplicate calls, rejects stale reward and restores own pause',async()=>{
  let finish,context='run-1';const pauses=[],events=[];
  const manager=createCommerce({provider:{id:'fake',capabilities:()=>({rewarded:true}),request:()=>new Promise(resolve=>{finish=resolve;})},getContext:()=>context,onPause:value=>pauses.push(value),onEvent:(...value)=>events.push(value)});
  const pending=manager.rewarded('bonus');assert.equal((await manager.rewarded('bonus')).status,'busy');
  context='run-2';finish({status:'completed',completed:true});assert.equal((await pending).status,'stale');assert.deepEqual(pauses,[true,false]);
  assert.equal(events.filter(([name])=>name==='ms_ad_completed').length,0);
});

test('controller timeout and dispose settle even when SDK promise never ends',async()=>{
  const pauses=[];
  const provider={id:'fake',capabilities:()=>({rewarded:true}),request:()=>new Promise(()=>{})};
  const timeout=createCommerce({provider,onPause:value=>pauses.push(value),timeoutMs:10});
  assert.equal((await timeout.rewarded('bonus')).reason,'timeout');assert.deepEqual(pauses,[true,false]);
  const manager=createCommerce({provider,onPause:value=>pauses.push(value)});const pending=manager.rewarded('bonus');manager.dispose();assert.equal((await pending).status,'unavailable');assert.equal(pauses.at(-1),false);
});

test('Telegram client never grants from invoice callback or local storage',async()=>{
  const seen=[];let owned=false;
  const request=async(url,options)=>{
    seen.push({url,options});
    return {ok:true,status:200,json:async()=>url.endsWith('/auth')?{token:'session'}:url.endsWith('/invoice')?{url:'https://t.me/$invoice'}:url.endsWith('/catalog')?{products:[{id:'supporter_aurora'}]}:{entitlements:owned?['supporter_aurora']:[]}};
  };
  const provider=createTelegramStarsProvider({endpoint:'https://example.test/v1',bridge:{initData:'signed',openInvoice(_url,callback){callback('paid');}},enabled:true,fetch:request,pollAttempts:1,pollDelay:1,id:()=> 'key'});
  assert.equal((await provider.purchase('supporter_aurora')).status,'pending');
  owned=true;assert.deepEqual((await provider.purchase('supporter_aurora')).entitlements,['supporter_aurora']);
  assert.equal(seen.filter(value=>value.url.endsWith('/auth')).length,1);
  assert.ok(seen.every(value=>value.options.credentials==='omit'));
  assert.equal(combineProviders(createAdProvider(),provider).capabilities().purchases,true);
});

test('entitlement verification preserves confirmed rights on failure and accepts verified empty refund state',async()=>{
  let result=['supporter_aurora'],failure;
  const manager=createCommerce({provider:{id:'fake',capabilities:()=>({purchases:true}),entitlements:async()=>{if(failure)throw failure;return result;}}});
  assert.deepEqual(await manager.verifyEntitlements(),{status:'ok',entitlements:['supporter_aurora']});
  failure=new Error('offline');
  assert.deepEqual(await manager.verifyEntitlements(),{status:'error',reason:'provider-error'});
  assert.deepEqual(await manager.refreshEntitlements(),['supporter_aurora'],'a network error is not a confirmed empty ledger');
  failure=undefined;result={entitlements:[]};
  assert.equal((await manager.verifyEntitlements()).reason,'invalid-provider-result');
  failure=new Error('offline');assert.deepEqual(await manager.refreshEntitlements(),['supporter_aurora']);
  failure=undefined;result=[];
  assert.deepEqual(await manager.verifyEntitlements(),{status:'ok',entitlements:[]});
  failure=new Error('offline');assert.deepEqual(await manager.refreshEntitlements(),[],'a verified revocation replaces the previous right');
  manager.dispose();
});

test('catalog and entitlement reads have bounded deadlines and abort their provider signals',async()=>{
  const signals=[];
  const never=({signal})=>{signals.push(signal);return new Promise(()=>{});};
  const manager=createCommerce({provider:{id:'fake',capabilities:()=>({purchases:true}),products:never,entitlements:never},readTimeoutMs:10});
  const [products,owned]=await Promise.all([manager.products(),manager.verifyEntitlements()]);
  assert.deepEqual(products,[]);assert.deepEqual(owned,{status:'error',reason:'timeout'});
  assert.equal(signals.length,2);assert.ok(signals.every(signal=>signal.aborted));
  assert.equal(manager.snapshot().busy,false,'read-only requests do not leave purchase/ad state locked');
  manager.dispose();
});

test('an older ledger response cannot overwrite a newer confirmed revocation',async()=>{
  const pending=[];
  const manager=createCommerce({provider:{id:'fake',capabilities:()=>({purchases:true}),entitlements:()=>new Promise(resolve=>pending.push(resolve))}});
  const old=manager.verifyEntitlements();await Promise.resolve();
  const current=manager.verifyEntitlements();await Promise.resolve();
  pending[1]([]);assert.deepEqual(await current,{status:'ok',entitlements:[]});
  pending[0](['supporter_aurora']);assert.deepEqual(await old,{status:'error',reason:'superseded'});
  manager.dispose();
});

test('dispose settles in-flight reads and late results cannot restore rights',async()=>{
  let finish,seenSignal,providerDisposed=0;
  const manager=createCommerce({provider:{id:'fake',capabilities:()=>({purchases:true}),entitlements:({signal})=>{seenSignal=signal;return new Promise(resolve=>finish=resolve);},dispose(){providerDisposed++;}},readTimeoutMs:10000});
  const pending=manager.verifyEntitlements();await Promise.resolve();
  manager.dispose();assert.deepEqual(await pending,{status:'error',reason:'disposed'});
  assert.equal(seenSignal.aborted,true);assert.equal(providerDisposed,1);
  finish(['supporter_aurora']);await Promise.resolve();
  assert.deepEqual(await manager.refreshEntitlements(),[]);
});

test('Telegram read deadline settles even if fetch ignores abort and dispose cancels a delayed login',async()=>{
  const bridge={initData:'signed',openInvoice(){}};
  let catalogSignal;
  const hung=createTelegramStarsProvider({endpoint:'https://example.test/v1',bridge,enabled:true,readTimeoutMs:10,
    fetch:async(_url,{signal})=>{catalogSignal=signal;return new Promise(()=>{});}});
  await assert.rejects(hung.products(),{name:'AbortError'});
  assert.equal(catalogSignal.aborted,true);hung.dispose();
  let finishLogin,loginSignal,calls=0;
  const late=createTelegramStarsProvider({endpoint:'https://example.test/v1',bridge,enabled:true,
    fetch:async(_url,{signal})=>{calls++;loginSignal=signal;return new Promise(resolve=>finishLogin=resolve);}});
  const pending=late.entitlements();late.dispose();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(loginSignal.aborted,true);
  finishLogin({ok:true,status:200,json:async()=>({token:'must-not-survive'})});await Promise.resolve();
  await assert.rejects(late.entitlements());assert.equal(calls,1,'disposed login does not issue a ledger request');
});

test('Telegram 401 keeps reopen guidance through typed entitlement verification',async()=>{
  const provider=createTelegramStarsProvider({endpoint:'https://example.test/v1',bridge:{initData:'stale',openInvoice(){}},enabled:true,
    fetch:async()=>({ok:false,status:401,json:async()=>({})})});
  const manager=createCommerce({provider});
  assert.deepEqual(await manager.verifyEntitlements(),{status:'error',reason:'reopen-telegram'});
  manager.dispose();
});
