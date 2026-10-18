import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSourceLights,sourceLightFootprint,sampleSourceLightIdle} from '../src/prototype/source-light.js';

test('idle breathes and lifts continuously on a shared clock at 30/60/120/144 FPS, reduced stays static',()=>{
 const at=sampleSourceLightIdle(.8);assert.notDeepEqual(at,sampleSourceLightIdle(1.3));
 for(const fps of [30,60,120,144]){
  let time=0;for(let frame=0;frame<fps;frame++)time+=1/fps;
  const sample=sampleSourceLightIdle(time);assert.ok(Math.abs(sample.intensity-sampleSourceLightIdle(1).intensity)<1e-12);assert.ok(Math.abs(sample.rise-1/2.6)<1e-12);
 }
 for(const time of [0,.5,100])assert.deepEqual(sampleSourceLightIdle(time,true),{intensity:1,rise:0});
 assert.ok(Math.abs(sampleSourceLightIdle(3.2).intensity-sampleSourceLightIdle(0).intensity)<1e-12);
});

test('light footprint follows all six outer tile vertices; floor/back/front straddle chips without growing resources',()=>{
 const tile={width:1.3,height:1.4,offsetY:-.02},footprint=sourceLightFootprint(tile);
 const pixels=[[235,1],[469,136],[469,372],[235,510],[1,372],[1,136]];
 for(let i=0;i<6;i++)assert.deepEqual(footprint[i],[(pixels[i][0]-235)/471*1.3,(256-pixels[i][1])/512*1.4-.02]);
 assert.ok(Math.max(...footprint.map(p=>p[0]))-Math.min(...footprint.map(p=>p[0]))>tile.width*.99);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),owned=[],plane=new THREE.PlaneGeometry();
 const effects=createSourceLights(scene,camera,plane,r=>(owned.push(r),r),c=>new THREE.Vector3(c.col,0,c.row),()=>2000,tile);
 const sources=[{col:3,row:2}],count=owned.length;
 effects.draw(sources,'#48baff',1,.8,false);const s=effects.snapshot();
 assert.deepEqual(s.cells,sources);assert.equal(s.layers,3);assert.equal(s.pool,18);assert.deepEqual(s.footprint,footprint);assert(s.orders[0].back<2010);assert(s.orders[0].front>2030);
 for(let i=0;i<20;i++){effects.reset();effects.draw(sources,'#48baff',1,i,false);}
 assert.equal(owned.length,count);assert.equal(scene.children[0].children.length,54);
 effects.draw(sources,'#48baff',1,100,true);assert.deepEqual(effects.snapshot().idle,{intensity:1,rise:0});
 effects.reset();assert.equal(effects.snapshot().cells.length,0);owned.forEach(r=>r.dispose());plane.dispose();
});
