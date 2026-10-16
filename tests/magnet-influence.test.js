import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMagnetInfluence,previewMagnetInfluence,sampleInfluenceArc} from '../src/prototype/magnet-influence.js';
import {offsetToAxial,axialToOffset,cellId,hexDistance} from '../src/game/hex.js';
import {createV4State,applyV4Magnet} from '../src/prototype/model-v4.js';
import {remainingUnits} from '../src/prototype/model.js';
import {makeTransferTimeline,sampleTransferTimeline} from '../src/prototype/motion.js';
const stack=(cell,colors)=>({cell,units:colors.map((color,i)=>({id:cellId(cell)+'-'+i,color}))});
const base=(stacks=[],blockers=[])=>({rulesVersion:4,cells:Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)})),blockers,stacks,magnets:['blue','gold','pink'],clearSize:6,cleared:0});

test('every position in both rings flies directly once per ID, even/odd rows and clipped edges',()=>{
 for(const target of [{col:3,row:2},{col:3,row:3},{col:0,row:0},{col:6,row:6}]){
  const cells=base().cells.filter(c=>[1,2].includes(hexDistance(target,c)));
  if(target.col===3)assert.equal(cells.length,18);
  for(const cell of cells){
   const s=base([stack(cell,Array(13).fill('blue'))]),before=structuredClone(s);
   const r=resolveMagnetInfluence(s,{cell:target,color:'blue'});
   assert.deepEqual(s,before);assert.equal(r.state.cleared,12);assert.equal(remainingUnits(r.state),1);
   assert.equal(cellId(r.state.stacks[0].cell),cellId(target));
   const moves=r.events.filter(e=>e.type==='unitMoved');
   assert.equal(moves.length,13);assert.equal(new Set(moves.map(e=>e.unit.id)).size,13);
   moves.forEach((e,i)=>{assert.deepEqual(e.from,cell);assert.deepEqual(e.to,target);assert.equal(e.fromIndex,12-i);});
   assert.deepEqual(r.paths,[[cell,target]]);assert.deepEqual(r.affectedCells,[cell]);
   const timeline=makeTransferTimeline(s,r);
   for(const move of timeline.segments.filter(e=>e.type==='unitMoved')){
    const frame=sampleTransferTimeline(timeline,(move.start+move.end)/2);
    assert.equal(new Set(frame.units.map(u=>u.id)).size,frame.units.length);
    const unit=frame.units.find(u=>u.id===move.unit.id);assert.deepEqual(unit.from,cell);assert.deepEqual(unit.to,target);
   }
   assert.equal(sampleTransferTimeline(timeline,timeline.duration).collected,12);
  }
 }
});
test('intervening X/foreign/missing cells do not obstruct distant straight or bent sources',()=>{
 const target={col:3,row:3},origin=offsetToAxial(target);
 for(const delta of [{q:2,r:0},{q:1,r:1}]){
  const source=axialToOffset({q:origin.q+delta.q,r:origin.r+delta.r});
  const mids=base().cells.filter(c=>hexDistance(c,target)===1&&hexDistance(c,source)===1);
  for(const state of [base([stack(source,['blue'])],mids),base([stack(source,['blue']),...mids.map(c=>stack(c,['pink']))])]){
   const r=resolveMagnetInfluence(state,{cell:target,color:'blue'});
   assert.equal(r.events.length,1);assert.deepEqual(r.events[0].from,source);assert.deepEqual(r.events[0].to,target);
  }
  const missing=base([stack(source,['blue'])]);missing.cells=missing.cells.filter(c=>!mids.some(m=>cellId(c)===cellId(m)));
  assert.equal(resolveMagnetInfluence(missing,{cell:target,color:'blue'}).events.length,1);
 }
});
test('only exposed matching tops inside radius two participate; no hidden colors, X or third ring',()=>{
 const target={col:3,row:3},near={col:3,row:2},source={col:4,row:3},far={col:6,row:3};
 assert.equal(hexDistance(target,far),3);
 const state=base([stack(near,['pink','blue','blue']),stack(source,['blue','pink']),stack(far,['blue'])]);
 const r=resolveMagnetInfluence(state,{cell:target,color:'blue'});
 assert.equal(r.events.length,2);assert.deepEqual(r.sources,[near]);
 assert.equal(r.state.stacks.find(s=>cellId(s.cell)===cellId(near)).units[0].color,'pink');
 assert.deepEqual(r.state.stacks.find(s=>cellId(s.cell)===cellId(source)),state.stacks[1]);
 assert.deepEqual(r.state.stacks.find(s=>cellId(s.cell)===cellId(far)),state.stacks[2]);
 assert.equal(resolveMagnetInfluence(base([stack(near,['blue'])],[near]),{cell:target,color:'blue'}).events.length,0);
});
test('multiple sources clear shared groups without duplicate IDs, and preview matches actual plan without RNG',()=>{
 const s=createV4State({id:'test',number:1,blockers:[{col:1,row:1}]},12),target={col:3,row:3};
 s.stacks=[stack({col:3,row:2},['pink',...Array(4).fill('blue')]),stack({col:5,row:3},Array(9).fill('blue'))];
 s.magnets=['blue','gold','pink'];s.spawnedUnits=remainingUnits(s);
 const before=structuredClone(s),plan=previewMagnetInfluence(s,target,'blue');assert.deepEqual(s,before);
 const r=applyV4Magnet(s,{type:'placeMagnet',cell:target,color:'blue'});
 assert.deepEqual(r.influence,plan);assert.deepEqual(s,before);
 assert.equal(r.state.cleared,12);assert.equal(r.state.spawnedUnits,remainingUnits(r.state)+r.state.cleared);
 const moves=r.events.filter(e=>e.type==='unitMoved');assert.equal(moves.length,13);
 assert.equal(new Set(moves.map(e=>e.unit.id)).size,13);
 assert.equal(previewMagnetInfluence({...s,terminal:'won'},target,'blue'),null);
 assert.equal(previewMagnetInfluence(s,target,'invalid'),null);
});
test('high parabolic particles meet both anchors and rise 1.1 above the baseline at halfway',()=>{
 const a={x:2,y:.1,z:1},b={x:0,y:.5,z:0};
 assert.deepEqual(sampleInfluenceArc(a,b,0),a);assert.deepEqual(sampleInfluenceArc(a,b,1),b);
 assert.deepEqual(sampleInfluenceArc(a,b,-1),a);assert.deepEqual(sampleInfluenceArc(a,b,2),b);
 const middle=sampleInfluenceArc(a,b,.5);assert.equal(middle.x,1);assert.ok(Math.abs(middle.y-1.4)<1e-10);
});
