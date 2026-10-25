import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalPlatform} from '../src/platforms/portal-adapter.js';
import {getProfile} from '../tools/platforms/profiles.mjs';
test('explicit portal profiles exist and SDK failures preserve playable ads-off fallback',async()=>{
  for(const id of ['crazygames','poki','yandex','playgama','gamedistribution','gamepix']){
    assert.equal(getProfile(id).id,id);
    const platform=createPortalPlatform(id,{scope:{},load:async()=>{throw Error('blocked');},enabled:true,gameId:'test'});
    await platform.init();let pause;platform.subscribePause(value=>pause=value);platform.ready();
    assert.equal(pause,false);assert.equal(platform.commerceProvider(),undefined);platform.dispose();
  }
});
test('CrazyGames basic never enables rewarded while full SDK still receives lifecycle',async()=>{
  const calls=[],sdk={init:async()=>calls.push('init'),game:{gameplayStart:()=>calls.push('start'),gameplayStop:()=>calls.push('stop')},ad:{requestAd(){}}};
  const platform=createPortalPlatform('crazygames',{scope:{CrazyGames:{SDK:sdk}},load:async()=>{},enabled:true,mode:'basic'});
  await platform.init();assert.equal(platform.commerceProvider().capabilities().rewarded,false);
  platform.ready();platform.gameplay(true);platform.gameplay(true);platform.gameplay(false);platform.dispose();
  assert.deepEqual(calls,['init','start','stop']);
});
test('GamePix loads before persistence/runtime and unsubscribes platform pauses on dispose',async()=>{
  const handlers=new Map(),calls=[];
  const sdk={events:{on:(key,fn)=>handlers.set(key,fn),off:key=>handlers.delete(key)},lifecycle:{loaded:()=>calls.push('loaded'),gameStart:()=>calls.push('start')},ads:{reward(){},interstitial(){}}};
  const scope={GamePix:sdk};
  const platform=createPortalPlatform('gamepix',{scope,load:async()=>{assert.equal(scope.GamePixConfig.lifecycle,'manual');calls.push('loaded-script');}});
  await platform.init();let paused=false;platform.subscribePause(value=>paused=value);
  handlers.get('pause')();assert.equal(paused,true);handlers.get('resume')();assert.equal(paused,false);
  platform.ready();platform.gameplay(true);platform.dispose();assert.equal(handlers.size,0);
  assert.deepEqual(calls,['loaded-script','loaded','start']);
});
test('hanging SDK initialization times out to fallback and cannot activate late ads',async()=>{
  let complete;
  const sdk={init:()=>new Promise(resolve=>complete=resolve),rewardedBreak:()=>true};
  const platform=createPortalPlatform('poki',{scope:{PokiSDK:sdk},load:async()=>{},enabled:true,initTimeoutMs:10});
  await platform.init();
  assert.equal(platform.commerceProvider(),undefined);
  complete();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(platform.commerceProvider(),undefined);platform.dispose();
});
test('Playgama uses current platform message lifecycle rather than nonexistent game methods',async()=>{
  const messages=[];
  const sdk={initialize:async()=>{},platform:{sendMessage:value=>{messages.push(value);return Promise.resolve();}}};
  const platform=createPortalPlatform('playgama',{scope:{bridge:sdk},load:async()=>{}});
  await platform.init();platform.ready();platform.gameplay(true);platform.gameplay(false);platform.dispose();
  assert.deepEqual(messages,['game_ready','gameplay_started','gameplay_stopped']);
});
