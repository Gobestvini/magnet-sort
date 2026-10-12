import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBorderRings,sampleBorderPulse} from '../src/prototype/border-preview.js';
import {hexDistance,cellId} from '../src/game/hex.js';
const cells=Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)}));
const state={cells,blockers:[{col:3,row:2}],stacks:[{cell:{col:4,row:3},units:[{color:'pink'}]}],magnets:['blue'],terminal:null,rng:42};
test('rings cover all geometric neighbors including occupied/blockers without changing state',()=>{
 for(const center of [{col:3,row:3},{col:3,row:4},{col:0,row:0}]){
  const before=structuredClone(state),plan=previewBorderRings(state,center,'blue');assert.deepEqual(state,before);
  plan.rings.forEach((ring,index)=>assert.deepEqual(ring.map(cellId),cells.filter(c=>hexDistance(center,c)===index+1).map(cellId)));
  assert.equal(plan.rings.flat().some(c=>cellId(c)===cellId(center)),false);
  if(center.row===3){assert.deepEqual(plan.rings.map(r=>r.length),[6,12]);assert.ok(plan.rings.flat().some(c=>cellId(c)==='r2c3'));assert.ok(plan.rings.flat().some(c=>cellId(c)==='r3c4'));}
 }
 assert.equal(previewBorderRings(state,{col:3,row:2},'blue'),null);assert.equal(previewBorderRings(state,{col:4,row:3},'blue'),null);assert.equal(previewBorderRings(state,{col:3,row:3},'gold'),null);
});
test('soft sequential pulse repeats and reduced motion lights both borders steadily',()=>{
 for(const t of [0,1.2,2.4])assert.ok(sampleBorderPulse(t).every(v=>v<1e-10));
 assert.deepEqual(sampleBorderPulse(.6),[1,0]);assert.deepEqual(sampleBorderPulse(1.8),[0,1]);assert.deepEqual(sampleBorderPulse(3),[1,0]);
 assert.deepEqual(sampleBorderPulse(0,true),[.45,.45]);assert.deepEqual(sampleBorderPulse(1.8,true),[.45,.45]);
});
