import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {previewBorderRings,sampleBorderWaves,BORDER_WAVE_REACH} from '../src/prototype/border-preview.js';
import {createInfluenceEffects} from '../src/prototype/influence-effects.js';
import {samplePreviewParticle} from '../src/prototype/preview-particles.js';
import {hexDistance,cellId} from '../src/game/hex.js';
const cells=Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)}));
const state={cells,blockers:[{col:3,row:2}],stacks:[{cell:{col:4,row:3},units:[{color:'pink'}]}],magnets:['blue'],terminal:null,rng:42};
test('rim rings include occupied/X cells; particles use only ordinary cells; preview is pure and legal',()=>{
 for(const center of [{col:3,row:3},{col:3,row:4},{col:0,row:0}]){
  const before=structuredClone(state),plan=previewBorderRings(state,center,'blue');assert.deepEqual(state,before);
  plan.rings.forEach((ring,index)=>assert.deepEqual(ring.map(cellId),cells.filter(c=>hexDistance(center,c)===index+1).map(cellId)));
  assert.ok(plan.particleCells.every(c=>!state.blockers.some(b=>cellId(b)===cellId(c))));
  assert.equal(plan.rings.flat().some(c=>cellId(c)===cellId(center)),false);
  if(center.row===3){assert.equal(plan.rings.flat().length,18);assert.equal(plan.particleCells.length,17);}
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
test('retained masks and small particles coexist only in preview, reduced keeps masks, any timeline hides particles',()=>{
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),owned=[];
 const own=r=>{owned.push(r);return r;},anchor=c=>new THREE.Vector3(c.col,.1,c.row),plane=new THREE.PlaneGeometry();
 const effects=createInfluenceEffects(scene,camera,plane,own,anchor,c=>c.row*1000);
 const s={...state,blockers:[],stacks:[]},plan=previewBorderRings(s,{col:3,row:3},'blue');
 effects.draw(plan,null,0,false,false);effects.draw(plan,null,.5,false,false);
 let view=effects.snapshot();assert.equal(view.particles,54);assert.equal(view.pool.marks,0);assert.equal(view.pool.rims,18);assert.equal(view.cells.length,18);assert.equal(view.radialWaves.length,3);assert.ok(view.particleRadius<.03);
 const counts=new Map();
 for(const arc of view.arcs){
  counts.set(cellId(arc.cell),(counts.get(cellId(arc.cell))??0)+1);
  assert.deepEqual(arc,sampleArc(arc,anchor,plan,.5));
 }
 function sampleArc(arc,anchor,plan,age){
  const index=(counts.get(cellId(arc.cell))??1)-1;
  return {cell:arc.cell,color:'blue',...samplePreviewParticle(arc.cell,index,age,anchor(arc.cell),anchor(plan.magnet.cell)),from:arc.from,to:arc.to};
 }
 assert.equal(counts.size,18);assert.ok([...counts.values()].every(n=>n===3));
 const resources=owned.length;
 for(let i=0;i<20;i++){effects.reset();effects.draw(plan,null,i,false,false);}
 assert.equal(owned.length,resources);
 effects.draw(plan,null,1,true,false);view=effects.snapshot();
 assert.equal(view.particles,0);assert.equal(view.cells.length,18);assert.deepEqual(view.radialWaves,[]);
 for(const time of [0,.3,.7,3,9]){
  effects.draw(plan,{magnet:plan.magnet,influence:{sources:plan.particleCells},deactivateEnd:10},time,false,false);
  assert.equal(effects.snapshot().particles,0);assert.deepEqual(effects.snapshot().cells,[]);
  assert.ok(scene.children[0].children.every(m=>!m.visible));
 }
 effects.draw(plan,null,1,false,true);assert.equal(effects.snapshot().particles,0);assert.deepEqual(effects.snapshot().cells,[]);
 effects.draw(null,null,2,false,false);assert.equal(effects.snapshot().particles,0);
 effects.reset();assert.equal(effects.snapshot().particles,0);
 owned.forEach(r=>r.dispose());plane.dispose();
});
