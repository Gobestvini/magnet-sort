import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createV4Session } from '../src/prototype/session.js';
import { PROGRESS_V4_KEY as KEY, V4_CONTENT_VERSION, createAttempt, replayAttempt, normalizeProgress, emptyProgress, createProgressStore, MAX_ATTEMPT_ACTIONS } from '../src/prototype/progress-v4.js';
import { createV4State, applyV4Magnet } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { canPlaceMagnet } from '../src/prototype/model.js';
import { simulate } from '../tools/verify-v4-balance.mjs';
const witnesses = JSON.parse(readFileSync(new URL('../tools/fixtures/v4-progression-witnesses.json', import.meta.url)));
const memory = () => { const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; };
const firstAction = state => ({type:'placeMagnet',color:state.magnets[0],cell:state.cells.find(c=>canPlaceMagnet(state,c))});
const setup = storage => createV4Session({ storage, newSeed:()=>0 });
const run = (session, actions) => {for(const a of actions)assert.equal(session.submit(a).accepted,true);};
function wonSave(number) {
 const w=witnesses.find(w=>w.number===number),attempt={levelId:v4Levels[number-1].id,seed:w.seed,actions:w.actions,assisted:false};
 const state=replayAttempt(attempt).state;
 const progress=emptyProgress(attempt); progress.completedByLevel[attempt.levelId]={bestStars:state.stars};return {progress,state};
}
test('commit journal is synchronously durable; replay restores all state fields and no invalid action is appended',()=>{
 const storage=memory(),session=setup(storage),before=structuredClone(session.state),a=firstAction(before);
 const result=session.submit(a);assert.ok(result.accepted);
 const raw=JSON.parse(storage.getItem(KEY));assert.equal(raw.activeAttempt.actions.length,1);
 const restored=setup(storage);assert.deepEqual(restored.state,result.state);assert.equal(restored.state.rng,result.state.rng);
 const rejected=session.submit({type:'placeMagnet',color:'not-a-color',cell:{col:1,row:1}});
 assert.equal(rejected.accepted,false);assert.equal(session.attempt.actions.length,1);
 assert.deepEqual(before,createV4State(v4Levels[0],0));
});
test('retry restores original seed/IDs/radii; replay and cloned metadata cannot mutate the owner',()=>{
 const storage=memory(),s=setup(storage),initial=structuredClone(s.state);s.submit(firstAction(s.state));
 const copy=s.attempt;copy.actions.length=0;assert.equal(s.attempt.actions.length,1);
 s.start(0,initial.seed);assert.deepEqual(s.state,initial);
 assert.deepEqual(setup(storage).state,initial);
});
test('won advances only on entry; final won remains final and completion is idempotent',()=>{
 for(const n of [1,12]){
  const storage=memory(),{progress,state}=wonSave(n);storage.setItem(KEY,JSON.stringify(progress));
  let s=setup(storage);assert.equal(s.state.levelNumber,n===12?12:2);assert.equal(s.state.terminal,n===12?'won':null);
  assert.equal(s.progress.completedByLevel[progress.lastLevelId].bestStars,state.stars);
  const completed=s.progress.completedByLevel;s=setup(storage);assert.deepEqual(s.progress.completedByLevel,completed);
  if(n===12){s.start(0,9);assert.deepEqual(s.progress.completedByLevel,completed);}
 }
 const w=witnesses.find(w=>w.number===1),s=createV4Session({storage:memory(),newSeed:()=>w.seed});run(s,w.actions);
 assert.equal(s.state.terminal,'won');assert.equal(s.state.levelNumber,1);
});
test('lost journal restores loss and retry repeats initial conditions',()=>{
 const lost=simulate(1,3,'random');assert.equal(lost.outcome,'lost');
 const storage=memory(),s=createV4Session({storage,newSeed:()=>3});run(s,lost.actions);assert.equal(s.state.terminal,'lost');
 const restored=setup(storage);assert.deepEqual(restored.state,s.state);
 restored.start(0,3);assert.deepEqual(restored.state,createV4State(v4Levels[0],3));
});
test('corruption and unsupported version are preserved until explicit fresh-save action',()=>{
 for(const raw of ['{broken',JSON.stringify({schemaVersion:99}),JSON.stringify({...wonSave(1).progress,revision:1.5}),JSON.stringify({...wonSave(1).progress,contentVersion:'ten-range-2026-10-18.1'})]){
  const storage=memory();storage.setItem(KEY,raw);const s=setup(storage);
  assert.equal(s.status().saved,false);s.submit(firstAction(s.state));assert.equal(storage.getItem(KEY),raw);
  assert.equal(s.recoverSave(),true);assert.equal(JSON.parse(storage.getItem(KEY)).activeAttempt.actions.length,1);
  assert.deepEqual(setup(storage).state,s.state);
 }
});
test('denied getters, read and quota failures leave a playable in-memory session; unrelated keys remain',()=>{
 for(const options of [
  {getStorage:()=>{throw new TypeError('denied');}},
  {storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}},
  {storage:{getItem:()=>null,setItem(){throw Error('quota');}}}
 ]){
  const s=createV4Session({newSeed:()=>0,...options});assert.equal(s.status().saved,false);assert.ok(s.submit(firstAction(s.state)).accepted);
 }
 const storage=memory();storage.setItem('magnet-sort.progress','legacy');storage.setItem('magnet-sort.audio.v1','audio');
 const s=setup(storage);s.submit(firstAction(s.state));assert.equal(storage.getItem('magnet-sort.progress'),'legacy');assert.equal(storage.getItem('magnet-sort.audio.v1'),'audio');
});
test('a second writer, even with the same revision, is not overwritten; recovery also checks conflicts',()=>{
 const storage=memory(),a=setup(storage),b=setup(storage);const latest=storage.getItem(KEY);
 a.submit(firstAction(a.state));assert.equal(a.status().reason,'conflict');assert.equal(storage.getItem(KEY),latest);
 b.submit(firstAction(b.state));const newer=storage.getItem(KEY);assert.notEqual(newer,latest);
 assert.equal(a.recoverSave(),false);assert.equal(storage.getItem(KEY),newer);
 storage.setItem(KEY,'broken');const c=setup(storage);storage.setItem(KEY,newer);
 assert.equal(c.recoverSave(),false);assert.equal(c.status().reason,'conflict');assert.equal(storage.getItem(KEY),newer);
});
test('fixed-seed and suspended transient attempts never write campaign; return restores exact journal/state',()=>{
 const storage=memory(),s=setup(storage);s.submit(firstAction(s.state));const raw=storage.getItem(KEY),state=structuredClone(s.state);
 const fixture=createV4Session({storage,newSeed:()=>9,fixedSeed:0});fixture.submit(firstAction(fixture.state));assert.equal(storage.getItem(KEY),raw);
 s.replaceAttempt(createAttempt(v4Levels[4].id,42),{transient:true});s.submit(firstAction(s.state));assert.equal(storage.getItem(KEY),raw);
 s.leaveTransient();assert.deepEqual(s.state,state);assert.equal(s.attempt.actions.length,1);
});
test('strict schema/replay reject impossible actions, terminal suffixes, IDs, seeds, dimensions and oversized history',()=>{
 const base=emptyProgress(createAttempt(v4Levels[0].id,0));assert.equal(normalizeProgress(base).state.seed,0);
 const bad=[{...base,contentVersion:'old'}, {...base,revision:-1}, {...base,completedByLevel:{unknown:{bestStars:3}}},
  {...base,activeAttempt:{...base.activeAttempt,seed:-1}}, {...base,activeAttempt:{...base.activeAttempt,seed:2**32}},
  {...base,activeAttempt:{...base.activeAttempt,assisted:1}},
  {...base,activeAttempt:{...base.activeAttempt,actions:[{type:'placeMagnet',color:'blue',cell:{col:1.1,row:1}}]}},
  {...base,activeAttempt:{...base.activeAttempt,actions:Array(MAX_ATTEMPT_ACTIONS+1).fill({})}}];
 for(const value of bad)assert.throws(()=>normalizeProgress(value));
 const {progress}=wonSave(1);assert.throws(()=>replayAttempt({...progress.activeAttempt,actions:[...progress.activeAttempt.actions,firstAction(createV4State(v4Levels[0],0))]}));
 assert.equal(V4_CONTENT_VERSION,base.contentVersion);
 const store=createProgressStore({storage:memory()});store.suspend('action-limit');assert.equal(store.save(base),false);assert.equal(store.status().reason,'action-limit');
});
