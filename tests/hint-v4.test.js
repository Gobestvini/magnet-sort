import test from 'node:test';
import assert from 'node:assert/strict';
import { findV4Hint, hintText } from '../src/prototype/hint-v4.js';
import { resolveMagnetInfluence } from '../src/prototype/magnet-influence.js';
import { createV4State, applyV4Magnet } from '../src/prototype/model-v4.js';
import { createV4Session } from '../src/prototype/session.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { canPlaceMagnet } from '../src/prototype/model.js';
import { createAttempt } from '../src/prototype/progress-v4.js';

const units = (color, count, prefix) => Array.from({length:count}, (_, i) => ({id:`${prefix}${i}`,color}));
const stack = (col, color, count) => ({cell:{col,row:0},units:units(color,count,`${col}-`)});
const fixture = () => ({...createV4State(v4Levels[0],0),cells:Array.from({length:5},(_,col)=>({col,row:0})),blockers:[],
  stacks:[stack(0,'blue',6),stack(2,'blue',6),stack(4,'coral',8)],magnets:['coral','blue'],magnetRadii:{blue:1,coral:1}});
const memory = () => { const data = new Map(); return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}; };

test('recommends a legal clearing placement with exact dry counts ahead of a larger single source', () => {
  const state = fixture(), before = structuredClone(state), hint = findV4Hint(state);
  assert.deepEqual(hint,{color:'blue',cell:{col:1,row:0},clearedDelta:10,freeDelta:1,movedCount:12});
  assert.deepEqual(state,before);
  assert.equal(hintText(hint),'Hint: Blue can collect 10 pieces and free 1 tile before new stacks.');
  assert(!/best|optimal|forced|guarantee|win/i.test(hintText(hint)));
});

test('free tiles rank ahead of moved pieces; moved pieces break equal clear/free ties', () => {
  const state=fixture(); state.magnets=['blue','coral'];
  state.stacks=[stack(0,'blue',2),stack(2,'blue',2),stack(4,'coral',8)];
  assert.deepEqual(findV4Hint(state),{color:'blue',cell:{col:1,row:0},clearedDelta:0,freeDelta:1,movedCount:4});
  state.stacks=[stack(0,'blue',2),stack(4,'coral',8)];
  const hint=findV4Hint(state); assert.equal(hint.color,'coral'); assert.equal(hint.movedCount,8);
  assert.equal(hintText(hint),'Hint: Coral can move 8 pieces before new stacks.');
});

test('ties use current tray order then row/column, independent of cells enumeration', () => {
  const state=fixture();state.stacks=[stack(0,'blue',6),stack(4,'coral',6)];
  assert.equal(findV4Hint(state).color,'coral');
  state.magnets.reverse();state.cells.reverse();
  assert.deepEqual(findV4Hint(state),{color:'blue',cell:{col:1,row:0},clearedDelta:0,freeDelta:0,movedCount:6});
});

test('all zero-pull, full, and terminal boards return no recommendation or false promise', () => {
  const state=fixture();state.magnets=['gold'];assert.equal(findV4Hint(state),null);
  assert.equal(hintText(null,{turnsUntilSpawn:2,plannedCount:1}),'Hint: No pulls right now. New stacks in 2 moves: +1.');
  state.stacks=state.cells.map(cell=>({...stack(cell.col,'blue',6),cell}));assert.equal(findV4Hint(state),null);
  state.stacks=[];state.terminal='won';assert.equal(findV4Hint(state),null);
});

test('seeded recommendations match dry resolution without consuming RNG, queue, IDs, or actions', () => {
  let found=0;
  for(const number of [1,4,8,12]) for(const seed of [0,1,0xffffffff]) {
    let state=createV4State(v4Levels[number-1],seed);
    for(let turn=0;turn<5&&!state.terminal;turn++) {
      const before=structuredClone(state), hint=findV4Hint(state);
      assert.deepEqual(findV4Hint(state),hint);assert.deepEqual(state,before);
      if(!hint) break;
      found++;
      assert(state.magnets.includes(hint.color));assert(canPlaceMagnet(state,hint.cell));
      const dry=resolveMagnetInfluence(state,hint);
      assert.equal(hint.clearedDelta,dry.state.cleared-state.cleared);
      assert.equal(hint.freeDelta,dry.state.cells.filter(c=>canPlaceMagnet(dry.state,c)).length-state.cells.filter(c=>canPlaceMagnet(state,c)).length);
      assert.equal(hint.movedCount,dry.events.filter(e=>e.type==='unitMoved').length);
      const action={type:'placeMagnet',color:hint.color,cell:hint.cell};
      assert.deepEqual(applyV4Magnet(state,action),applyV4Magnet(before,action));
      state=applyV4Magnet(state,action).state;
    }
  }
  assert(found>=12);
});

test('concrete assistance persists independently of actions, survives Undo and reload, resets on Retry', () => {
  const storage=memory(), s=createV4Session({storage,newSeed:()=>0}), initial=structuredClone(s.state);
  const hint=findV4Hint(s.state);assert(hint);assert.equal(s.markAssisted(),true);
  assert.deepEqual(s.state,initial);assert.deepEqual(s.attempt.actions,[]);assert(s.attempt.assisted);
  assert.equal(s.markAssisted(),true);
  const restored=createV4Session({storage,newSeed:()=>1});assert(restored.attempt.assisted);assert.deepEqual(restored.state,initial);
  const action={type:'placeMagnet',color:hint.color,cell:hint.cell};
  assert.deepEqual(restored.submit(action),applyV4Magnet(initial,action));
  assert(restored.undo().accepted);assert(restored.attempt.assisted);assert.deepEqual(restored.state,initial);
  restored.start(0,0);assert.equal(restored.attempt.assisted,false);
  restored.dispose();assert.equal(restored.markAssisted(),false);
});

test('transient assistance does not overwrite durable campaign and unavailable saves stay playable', () => {
  const storage=memory(),s=createV4Session({storage,newSeed:()=>0}), saved=JSON.stringify(s.progress);
  s.replaceAttempt(createAttempt(v4Levels[3].id,42),{transient:true});s.markAssisted();assert(s.attempt.assisted);
  s.leaveTransient();assert.equal(s.attempt.assisted,false);assert.equal(JSON.stringify(s.progress),saved);
  const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
  const fallback=createV4Session({storage:denied,newSeed:()=>0});assert(fallback.markAssisted());assert(fallback.attempt.assisted);assert.equal(fallback.status().saved,false);
});
