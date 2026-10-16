import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {previewBorderRings} from '../src/prototype/border-preview.js';
import {createInfluenceEffects} from '../src/prototype/influence-effects.js';
import {sampleInfluenceArc} from '../src/prototype/magnet-influence.js';
import {hexDistance,cellId} from '../src/game/hex.js';
const cells=Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)}));
const state={cells,blockers:[{col:3,row:2}],stacks:[{cell:{col:4,row:3},units:[{color:'pink'}]}],magnets:['blue'],terminal:null,rng:42};
test('particle rings include empty/occupied cells but exclude X, target, invalid placement and third ring',()=>{
 for(const center of [{col:3,row:3},{col:3,row:4},{col:0,row:0}]){
  const before=structuredClone(state),plan=previewBorderRings(state,center,'blue');assert.deepEqual(state,before);
  plan.rings.forEach((ring,index)=>assert.deepEqual(ring.map(cellId),cells.filter(c=>hexDistance(center,c)===index+1&&!state.blockers.some(b=>cellId(b)===cellId(c))).map(cellId)));
  assert.equal(plan.rings.flat().some(c=>cellId(c)===cellId(center)),false);
  if(center.row===3){assert.ok(plan.rings.flat().some(c=>cellId(c)==='r3c4'));assert.equal(plan.rings.flat().length,17);}
 }
 for(const [cell,color]of [[{col:3,row:2},'blue'],[{col:4,row:3},'blue'],[{col:3,row:3},'gold'],[{col:9,row:9},'blue']])assert.equal(previewBorderRings(state,cell,color),null);
});
test('retained particle pool serves every cell, follows anchors, and hides all source outlines including reduced/pause/reset',()=>{
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),owned=[];
 const own=r=>{owned.push(r);return r;},anchor=c=>new THREE.Vector3(c.col,.1,c.row),plane=new THREE.PlaneGeometry();
 const effects=createInfluenceEffects(scene,camera,plane,own,anchor,c=>c.row*1000);
 const s={...state,blockers:[],stacks:[]},plan=previewBorderRings(s,{col:3,row:3},'blue');
 effects.draw(plan,null,0,false,false);effects.draw(plan,null,.5,false,false);
 let view=effects.snapshot();assert.equal(view.particles,54);assert.equal(view.pool.marks,0);assert.equal(view.pool.rims,0);assert.deepEqual(view.cells,[]);
 const counts=new Map();
 for(const arc of view.arcs){
  counts.set(cellId(arc.cell),(counts.get(cellId(arc.cell))??0)+1);
  assert.deepEqual(arc.position,sampleInfluenceArc(arc.from,arc.to,arc.progress));
  assert.deepEqual(arc.to,{x:3,y:.1,z:3});
 }
 assert.equal(counts.size,18);assert.ok([...counts.values()].every(n=>n===3));
 const resources=owned.length;
 for(let i=0;i<20;i++){effects.reset();effects.draw(plan,null,i,false,false);}
 assert.equal(owned.length,resources);
 for(const [reduced,paused]of [[true,false],[false,true]]){
  effects.draw(plan,null,1,reduced,paused);view=effects.snapshot();
  assert.equal(view.particles,0);assert.deepEqual(view.cells,[]);assert.ok(scene.children[0].children.every(m=>!m.visible));
 }
 effects.draw(null,null,2,false,false);assert.equal(effects.snapshot().particles,0);
 effects.reset();assert.equal(effects.snapshot().particles,0);
 owned.forEach(r=>r.dispose());plane.dispose();
});
