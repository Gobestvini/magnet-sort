import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrowthController} from '../src/growth/controller.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function result(){return {state:{puzzleId:v4Levels[1].id,seed:123,levelNumber:2,turn:3,movesUsed:3,cleared:100,goal:100,terminal:'won'},attempt:{assisted:false},mode:'campaign',date:null};}
test('ad transition is single-flight and cannot overwrite a changed run',async t=>{
  const previous=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{globalThis.localStorage=previous;});
  let finish,run=1,next=0;
  const provider={id:'poki',capabilities:()=>({interstitial:true}),request:()=>new Promise(resolve=>finish=resolve)};
  const growth=createGrowthController({getContext:()=>run});t.after(()=>growth.dispose());
  await growth.connect({id:'poki',commerceProvider:()=>provider});growth.begin(result());
  const pending=growth.transition(()=>next++);
  await Promise.resolve();await growth.transition(()=>next++);assert.equal(next,0);
  finish({status:'completed',completed:true});await pending;assert.equal(next,1);
  const stale=growth.transition(()=>next++);await Promise.resolve();run++;
  finish({status:'completed',completed:true});await stale;assert.equal(next,1);
});
test('confirmed permanent entitlements are restored at startup without opening the shop',async t=>{
  const previous=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{globalThis.localStorage=previous;});
  let calls=0;
  const provider={id:'poki',capabilities:()=>({purchases:true}),entitlements:async()=>{calls++;return ['supporter_aurora'];},dispose(){}};
  const growth=createGrowthController();t.after(()=>growth.dispose());
  await growth.connect({id:'poki',commerceProvider:()=>provider});await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls,1);assert.equal(growth.snapshot().aurora,true);
});
test('temporary restoration failure preserves confirmed cosmetics, verified refund removes them',async t=>{
  const previous=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{globalThis.localStorage=previous;});
  let mode='owned';
  const provider={id:'poki',capabilities:()=>({purchases:true}),entitlements:async()=>{
    if(mode==='offline')throw Error('network');return mode==='owned'?['supporter_aurora']:[];
  },dispose(){}};
  const growth=createGrowthController();t.after(()=>growth.dispose());
  await growth.connect({id:'poki',commerceProvider:()=>provider});await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(growth.snapshot().aurora,true);
  mode='offline';await growth.restore();assert.equal(growth.snapshot().aurora,true);
  assert.match(growth.snapshot().message,/could not be verified/);
  mode='refunded';await growth.restore();assert.equal(growth.snapshot().aurora,false);
});
test('restoring an old terminal board does not earn this week rewards',async t=>{
  const previous=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{globalThis.localStorage=previous;});
  const growth=createGrowthController();t.after(()=>growth.dispose());
  growth.begin(result(),{resumed:true});
  assert.equal(growth.snapshot().meta.uniqueWins,0);
  assert.equal(growth.snapshot().meta.quests[0].progress,0);
  growth.move(result());
  assert.equal(growth.snapshot().meta.uniqueWins,1);
  assert.equal(growth.snapshot().meta.quests[0].progress,1);
});
