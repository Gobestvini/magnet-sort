import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBorderRings,sampleBorderWaves,BORDER_WAVE_REACH} from '../src/prototype/border-preview.js';
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
test('waves travel inward at the same speed regardless of sampling FPS',()=>{
 for(const fps of [30,60,120,144]){
  let previous=sampleBorderWaves(.1);
  for(let t=.1+1/fps;t<.7;t+=1/fps){const next=sampleBorderWaves(t);next.forEach((w,i)=>{
    assert.ok(w.radius<previous[i].radius);assert.ok(Math.abs(previous[i].radius-w.radius-BORDER_WAVE_REACH/2.4/fps)<1e-10);
  });previous=next;}
 }
 assert.deepEqual(sampleBorderWaves(.4,true),[]);
 const before=sampleBorderWaves(2.4-1e-7)[0],after=sampleBorderWaves(2.4)[0];
 assert.ok(before.opacity<1e-5);assert.equal(after.opacity,0);assert.equal(after.radius,BORDER_WAVE_REACH);
 sampleBorderWaves(.3).forEach((w,i)=>assert.ok(Math.abs(w.radius-sampleBorderWaves(2.7)[i].radius)<1e-10));
});
