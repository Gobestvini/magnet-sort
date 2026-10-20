import test from 'node:test';
import assert from 'node:assert/strict';
import {createV4State,applyV4Magnet} from '../src/prototype/model-v4.js';
import {resolveMagnetInfluence,previewMagnetInfluence} from '../src/prototype/magnet-influence.js';
import {canPlaceMagnet,remainingUnits} from '../src/prototype/model.js';
import {hexDistance,cellId} from '../src/game/hex.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {magnetRadius} from '../src/prototype/magnet-radius.js';
import {makeTransferTimeline,sampleTransferTimeline} from '../src/prototype/motion.js';
const units=(n,color='blue',prefix='u')=>Array.from({length:n},(_,i)=>({id:prefix+i,color}));
const base=()=>({...createV4State(v4Levels[0],1),magnets:['blue'],magnetRadii:{blue:2},stacks:[],cleared:0,spawnedUnits:0});

test('6/9 remain, 10/11 clear automatically and credit only on arrival',()=>{
 const target={col:3,row:3},source={col:3,row:2};
 for(const n of [6,9,10,11]){
  const s=base();s.stacks=[{cell:source,units:n===11?[...units(5,'pink'),...units(6,'blue','b')]:units(n)}];s.spawnedUnits=n;
  const before=structuredClone(s),r=applyV4Magnet(s,{type:'placeMagnet',color:'blue',cell:target});
  assert.deepEqual(s,before);assert.equal(r.state.cleared,n>=10?n:0);
  assert.ok(r.state.stacks.every(s=>s.units.length<10));assert.equal(r.state.spawnedUnits,remainingUnits(r.state)+r.state.cleared);
  const timeline=makeTransferTimeline(s,r);assert.equal(sampleTransferTimeline(timeline,0).collected,0);
  assert.equal(sampleTransferTimeline(timeline,timeline.duration).collected,n>=10?n:0);
 }
 for(const n of [9,10,11,20]){
  const s=base();s.magnetRadii.blue=1;
  s.stacks=[{cell:{col:1,row:5},units:[...units(n-1,'pink'),...units(1,'coral','cap')]}];
  const before=structuredClone(s),r=resolveMagnetInfluence(s,{cell:target,color:'blue'});
  assert.deepEqual(s,before);assert.equal(r.state.cleared,n>=10?n:0);
  assert.deepEqual(r.sources,[]);assert.deepEqual(previewMagnetInfluence(s,target,'blue').sources,[]);
  const collected=r.events.filter(e=>e.type==='unitsCleared').flatMap(e=>e.units.map(u=>u.id));
  assert.equal(collected.length,n>=10?n:0);assert.equal(new Set(collected).size,collected.length);
  assert.equal(remainingUnits(r.state)+r.state.cleared,n);
 }
});

test('many sources never build beyond ten and keep the remainder and each ID exactly once',()=>{
 const s=base(),target={col:3,row:3};s.stacks=s.cells.filter(c=>hexDistance(c,target)===1).map((cell,i)=>({cell,units:units(5+i%5,'blue','s'+i+'-')}));
 const total=remainingUnits(s),r=resolveMagnetInfluence(s,{cell:target,color:'blue'});
 assert.equal(r.state.cleared,Math.floor(total/10)*10);assert.equal(remainingUnits(r.state),total%10);
 assert.ok(r.events.filter(e=>e.type==='unitMoved').every(e=>e.toIndex<10));
 assert.equal(new Set(r.events.filter(e=>e.type==='unitMoved').map(e=>e.unit.id)).size,total);
});

test('one/two rings use the same preview and resolve, ignore forged action radius and cross intervening X',()=>{
 for(const row of [2,3])for(const radius of [1,2]){
  const s=base(),target={col:3,row};s.magnetRadii={blue:radius};
  s.stacks=s.cells.filter(c=>[1,2].includes(hexDistance(target,c))&&!s.blockers.some(b=>cellId(b)===cellId(c))).map((cell,i)=>({cell,units:units(1,'blue','s'+i)}));
  const before=structuredClone(s),r=resolveMagnetInfluence(s,{cell:target,color:'blue',radius:3});
  assert.deepEqual(s,before);assert.equal(r.magnet.radius,radius);assert.ok(r.sources.every(c=>hexDistance(c,target)<=radius));
  assert.equal(r.sources.length,s.stacks.filter(stack=>hexDistance(stack.cell,target)<=radius).length);
  assert.deepEqual(previewMagnetInfluence(s,target,'blue').sources,r.sources);
 }
});

test('all levels stay below ten, spawn only 6/8, types replay and preview spends no RNG',()=>{
 const types=new Set();
 for(const level of v4Levels)for(let seed=0;seed<50;seed++){
  let s=createV4State(level,seed);assert.deepEqual(s,createV4State(level,seed));assert(s.stacks.every(stack=>[6,8].includes(stack.units.length)));
  for(let turn=0;turn<8&&!s.terminal;turn++){
   assert.ok(s.stacks.every(stack=>stack.units.length>0&&stack.units.length<10));
   for(const color of s.magnets){types.add(magnetRadius(s,color));assert.ok([1,2].includes(s.magnetRadii[color]));}
   const color=s.magnets[0],cell=s.cells.find(c=>canPlaceMagnet(s,c)),before=structuredClone(s);
   previewMagnetInfluence(s,cell,color);assert.deepEqual(s,before);
   const r=applyV4Magnet(s,{type:'placeMagnet',color,cell});
   assert(r.events.filter(e=>e.type==='stackSpawned').every(e=>[6,8].includes(e.units.length)));
   for(const retained of r.state.magnets.filter(c=>c!==color&&s.magnets.includes(c)))assert.equal(r.state.magnetRadii[retained],s.magnetRadii[retained]);
   s=r.state;assert.equal(s.spawnedUnits,remainingUnits(s)+s.cleared);
  }
 }
 assert.deepEqual(types,new Set([1,2]));
});
