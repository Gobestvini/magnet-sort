import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {previewBorderRings,sampleBorderWaves,BORDER_WAVE_REACH} from '../src/prototype/border-preview.js';
import {createInfluenceEffects} from '../src/prototype/influence-effects.js';
import {samplePreviewParticle} from '../src/prototype/preview-particles.js';
import {hexDistance,cellId} from '../src/game/hex.js';
const cells=Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)}));
const state={cells,blockers:[{col:3,row:2}],stacks:[{cell:{col:4,row:3},units:[{color:'pink'}]}],magnets:['blue'],terminal:null,rng:42};
test('preview rings respect type, sources only include matching exposed tops, and preview is pure',()=>{
 for(const radius of [1,2])for(const center of [{col:3,row:3},{col:3,row:4},{col:0,row:0}]){
  const s={...state,clearSize:10,cleared:0,magnetRadii:{blue:radius}},before=structuredClone(s),plan=previewBorderRings(s,center,'blue');
  assert.deepEqual(s,before);assert.equal(plan.rings.length,radius);
  plan.rings.forEach((ring,index)=>assert.deepEqual(ring.map(cellId),cells.filter(c=>hexDistance(center,c)===index+1).map(cellId)));
  assert.deepEqual(plan.sources,[]);assert.equal(plan.rings.flat().some(c=>cellId(c)===cellId(center)),false);
 }
 for(const [cell,color]of [[{col:3,row:2},'blue'],[{col:4,row:3},'blue'],[{col:3,row:3},'gold'],[{col:9,row:9},'blue']])assert.equal(previewBorderRings(state,cell,color),null);
});

test('masked inward waves keep the original speed at 30/60/120/144 FPS and reduced is static',()=>{
 for(const fps of [30,60,120,144]){
  let previous=sampleBorderWaves(.1);
  for(let t=.1+1/fps;t<.7;t+=1/fps){
   const next=sampleBorderWaves(t);next.forEach((w,i)=>assert.ok(Math.abs(previous[i].radius-w.radius-BORDER_WAVE_REACH/2.4/fps)<1e-10));previous=next;
  }
 }
 assert.deepEqual(sampleBorderWaves(.4,true),[]);
 assert.ok(sampleBorderWaves(2.4-1e-7)[0].opacity<1e-5);assert.equal(sampleBorderWaves(2.4)[0].opacity,0);
});
test('preview particles vary speed, height, bend and later passes without consuming model RNG',()=>{
 const cell={row:3,col:2},from={x:2,y:.1,z:1},to={x:0,y:.1,z:0};
 const samples=[0,1,2].map(i=>samplePreviewParticle(cell,i,.5,from,to));
 for(const field of ['duration','height','bend','progress'])assert.equal(new Set(samples.map(s=>s[field])).size,3);
 assert.deepEqual(samples[0],samplePreviewParticle(cell,0,.5,from,to));
 const first=samplePreviewParticle(cell,0,0,from,to);
 const launch=(1-first.progress)*first.duration;
 const atStart=samplePreviewParticle(cell,0,launch+1e-8,from,to);
 assert.ok(Math.hypot(atStart.position.x-from.x,atStart.position.y-from.y,atStart.position.z-from.z)<1e-6);
 const nearEnd=samplePreviewParticle(cell,0,launch+first.duration-1e-8,from,to);
 assert.ok(Math.hypot(nearEnd.position.x-to.x,nearEnd.position.y-to.y,nearEnd.position.z-to.z)<1e-6);
 const later=samplePreviewParticle(cell,0,.5+first.duration,from,to);
 assert.notEqual(samples[0].height,later.height);assert.notEqual(samples[0].bend,later.bend);
});
test('source columns persist through processing, fade smoothly, reset and allocate a bounded pool',()=>{
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),owned=[];
 const own=r=>{owned.push(r);return r;},anchor=c=>new THREE.Vector3(c.col,.1,c.row),plane=new THREE.PlaneGeometry();
 const effects=createInfluenceEffects(scene,camera,plane,own,anchor,c=>c.row*1000);
 const source={col:4,row:3},s={...state,clearSize:10,cleared:0,blockers:[],stacks:[{cell:source,units:[{id:'blue1',color:'blue'}]}]},plan=previewBorderRings(s,{col:3,row:3},'blue');
 effects.draw(plan,null,.5,false,false);let view=effects.snapshot();
 assert.equal(view.particles,0);assert.equal(view.pool.particles,0);assert.equal(view.pool.rims,18);assert.equal(view.cells.length,18);
 assert.deepEqual(view.lights.cells,[source]);assert.equal(view.lights.pool,18);assert.equal(view.lights.strength,1);
 const resources=owned.length;
 for(let i=0;i<20;i++){effects.reset();effects.draw(plan,null,i,false,false);}
 assert.equal(owned.length,resources);
 const timeline={influence:plan,deactivateStart:3};
 for(const time of [0,.3,.7,2.9,3]){
  effects.draw(null,timeline,time,false,false);assert.equal(effects.snapshot().particles,0);
  assert.deepEqual(effects.snapshot().lights.cells,[source]);assert.equal(effects.snapshot().lights.strength,1);
 }
 effects.draw(null,timeline,3.275,false,false);assert.ok(Math.abs(effects.snapshot().lights.strength-.5)<1e-8);
 effects.draw(null,timeline,3.55,false,false);assert.deepEqual(effects.snapshot().lights.cells,[]);
 effects.draw(plan,null,1,true,false);assert.equal(effects.snapshot().particles,0);assert.deepEqual(effects.snapshot().lights.cells,[source]);assert.deepEqual(effects.snapshot().radialWaves,[]);
 effects.draw(null,timeline,3.08,true,false);assert.deepEqual(effects.snapshot().lights.cells,[]);
 effects.draw(plan,null,1,false,true);assert.deepEqual(effects.snapshot().lights.cells,[]);
 effects.draw(null,null,2,false,false);assert.deepEqual(effects.snapshot().lights.cells,[]);
 effects.reset();assert.equal(effects.snapshot().lights.strength,0);
 owned.forEach(r=>r.dispose());plane.dispose();
});
