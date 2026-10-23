import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createV4Session} from '../src/prototype/session.js';
import {createV4State,createV4Rules} from '../src/prototype/model-v4.js';
import {canPlaceMagnet} from '../src/prototype/model.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {PROGRESS_V4_KEY as KEY,createAttempt,emptyProgress,MAX_ATTEMPT_ACTIONS,replayAttempt} from '../src/prototype/progress-v4.js';
import {simulate} from '../tools/verify-v4-balance.mjs';
const witnesses=JSON.parse(readFileSync(new URL('../tools/fixtures/v4-progression-witnesses.json',import.meta.url)));
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const action=s=>({type:'placeMagnet',color:s.magnets[0],cell:s.cells.find(c=>canPlaceMagnet(s,c))});
const session=(storage,seed=0)=>createV4Session({storage,newSeed:()=>seed});

test('undo restores every before field; repeating an action reproduces clear, spawn, queue, IDs, RNG and radii',()=>{
 const coverage=new Set();
 for(const number of [1,4,7,10,12]){
  const w=witnesses.find(w=>w.number===number),storage=memory(),s=session(storage,w.seed);s.start(number-1,w.seed);
  for(const a of w.actions.slice(0,24)){
   const before=structuredClone(s.state),history=s.attempt.actions,result=s.submit(a);assert(result.accepted);
   if(result.state.terminal==='won')break;
   for(const e of result.events)coverage.add(e.type);
   for(const radius of Object.values(result.state.magnetRadii))coverage.add('radius'+radius);
   assert(s.canUndo);assert(s.undo().accepted);assert.deepEqual(s.state,before);
   assert.deepEqual(s.attempt.actions,history);assert.equal(s.attempt.assisted,true);
   const saved=JSON.parse(storage.getItem(KEY));assert.deepEqual(saved.activeAttempt,s.attempt);
   assert.deepEqual(replayAttempt(saved.activeAttempt).state,before);
   assert.deepEqual(s.submit(a),result,'same action must reproduce the entire resolution');
   assert.equal(s.attempt.assisted,true);
  }
 }
 for(const kind of ['unitsCleared','stackSpawned','radius1','radius2'])assert(coverage.has(kind),kind+' must really be exercised');
});

test('zero and boundary seeds undo across spawn batch thresholds and restore all fields',()=>{
 const counts=new Set();
 for(const seed of [0,1,0xffffffff]){
  const s=session(memory(),seed);
  for(let n=0;n<18&&!s.state.terminal;n++){
   const before=structuredClone(s.state),a=action(before),result=s.submit(a);
   assert(result.accepted);if(result.state.terminal==='won')break;
   counts.add(result.events.filter(e=>e.type==='stackSpawned').length);
   assert(s.undo().accepted);assert.deepEqual(s.state,before);assert.deepEqual(s.submit(a),result);
  }
 }
 for(const count of [1,2,3])assert(counts.has(count),'spawn batch '+count);
});

test('empty, invalid and disposed histories cannot undo or mark assistance; accepted history undoes repeatedly to zero',()=>{
 const storage=memory(),s=session(storage),initial=structuredClone(s.state);assert.equal(s.canUndo,false);
 assert.equal(s.undo().accepted,false);assert.equal(s.attempt.assisted,false);
 assert.equal(s.submit({type:'placeMagnet',color:'invalid',cell:{col:1,row:1}}).accepted,false);
 assert.equal(s.canUndo,false);assert.deepEqual(s.state,initial);
 const states=[];
 for(let i=0;i<6;i++){states.push(structuredClone(s.state));assert(s.submit(action(s.state)).accepted);}
 for(const state of states.reverse()){assert(s.undo().accepted);assert.deepEqual(s.state,state);assert.equal(s.attempt.assisted,true);}
 assert.equal(s.canUndo,false);assert.equal(s.undo().accepted,false);assert.equal(s.attempt.assisted,true);
 const resumed=session(storage);assert.deepEqual(resumed.state,initial);assert.equal(resumed.attempt.assisted,true);assert.equal(resumed.canUndo,false);
 resumed.start(0,0);assert.equal(resumed.attempt.assisted,false);assert.deepEqual(resumed.state,initial);
 resumed.submit(action(resumed.state));resumed.dispose();assert.equal(resumed.canUndo,false);assert.equal(resumed.undo().reason,'disposed');
});

test('resumed loss undoes back to playing, repeats the same loss, and keeps earlier campaign achievements',()=>{
 const run=simulate(1,3,'random');assert.equal(run.outcome,'lost');
 const storage=memory(),s=session(storage,3),states=[];
 for(const a of run.actions){states.push(structuredClone(s.state));assert(s.submit(a).accepted);}
 const lost=structuredClone(s.state);assert.equal(lost.terminal,'lost');
 const raw=JSON.parse(storage.getItem(KEY));raw.completedByLevel[v4Levels[0].id]={bestStars:3};storage.setItem(KEY,JSON.stringify(raw));
 const restored=session(storage);assert(restored.canUndo);assert(restored.undo().accepted);
 assert.deepEqual(restored.state,states.at(-1));assert.equal(restored.state.terminal,null);
 assert.equal(restored.progress.completedByLevel[v4Levels[0].id].bestStars,3);
 assert.deepEqual(restored.submit(run.actions.at(-1)).state,lost);
 assert(restored.undo().accepted);assert.equal(restored.attempt.assisted,true);
});

test('victory cannot undo and recorded stars never decrease',()=>{
 const w=witnesses.find(w=>w.number===1),storage=memory(),s=session(storage,w.seed);
 for(const a of w.actions)assert(s.submit(a).accepted);
 const before=structuredClone(s.state),raw=storage.getItem(KEY);assert.equal(before.terminal,'won');
 assert.equal(s.canUndo,false);assert.equal(s.undo().accepted,false);assert.deepEqual(s.state,before);assert.equal(storage.getItem(KEY),raw);
 const best=s.progress.completedByLevel[v4Levels[0].id].bestStars;
 s.start(0,w.seed);s.submit(w.actions[0]);s.undo();assert.equal(s.progress.completedByLevel[v4Levels[0].id].bestStars,best);
});

test('resumed journal remains undoable; assistance survives repeated save/reload and a new move',()=>{
 const storage=memory(),s=session(storage);s.submit(action(s.state));const before=structuredClone(s.state);s.submit(action(s.state));
 const restored=session(storage);assert(restored.undo().accepted);assert.deepEqual(restored.state,before);
 const again=session(storage);assert.equal(again.attempt.assisted,true);assert(again.canUndo);
 again.submit(action(again.state));assert.equal(session(storage).attempt.assisted,true);
});

test('transient/experimental undo never replaces campaign and replays the configured rules',()=>{
 const storage=memory(),s=session(storage);s.submit(action(s.state));const campaign=structuredClone(s.state),raw=storage.getItem(KEY);
 s.replaceAttempt(createAttempt(v4Levels[3].id,42),{transient:true});const before=structuredClone(s.state);s.submit(action(s.state));s.undo();
 assert.deepEqual(s.state,before);assert.equal(storage.getItem(KEY),raw);s.leaveTransient();assert.deepEqual(s.state,campaign);assert.equal(s.attempt.assisted,false);
 const rules=createV4Rules({goals:Array(12).fill(200),spawnIntervals:Array(12).fill(3)});
 const experimental=createV4Session({newSeed:()=>0,fixedSeed:0,rules}),initial=structuredClone(experimental.state);
 const a=action(initial),result=experimental.submit(a);assert(experimental.undo().accepted);assert.deepEqual(experimental.state,initial);
 assert.deepEqual(experimental.submit(a),result);assert.equal(storage.getItem(KEY),raw);
});

test('undo remains playable in memory with quota/corrupt storage or a newer writer; no newer save is overwritten',()=>{
 for(const reason of ['quota','corrupt','conflict']){
  const storage=memory();if(reason==='corrupt')storage.setItem(KEY,'{broken');
  const s=session(storage),initial=structuredClone(s.state);s.submit(action(s.state));
  if(reason==='quota')storage.setItem=()=>{throw Error('quota');};
  if(reason==='conflict')session(storage).submit(action(s.state));
  const raw=storage.getItem(KEY);assert(s.undo().accepted);assert.deepEqual(s.state,initial);assert.equal(s.attempt.assisted,true);
  assert.equal(storage.getItem(KEY),raw);assert.equal(s.status().saved,false);
 }
});

test('in-memory history beyond the save limit can still undo without a new assistance limit',()=>{
 const rules={createV4State:(level,seed)=>createV4State(level,seed),applyV4Magnet:(state)=>({accepted:true,state:{...state,turn:state.turn+1},events:[]})};
 const s=createV4Session({newSeed:()=>0,fixedSeed:0,rules}),initial=s.state,a=action(initial);
 for(let i=0;i<MAX_ATTEMPT_ACTIONS+3;i++)s.submit(a);
 assert(s.undo().accepted);assert.equal(s.state.turn,MAX_ATTEMPT_ACTIONS+2);assert.equal(s.attempt.assisted,true);
});
