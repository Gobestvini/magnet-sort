import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createV4State,applyV4Magnet} from '../src/prototype/model-v4.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {makeTransferTimeline} from '../src/prototype/motion.js';
import {createInfluenceEffects} from '../src/prototype/influence-effects.js';

for(const reduced of [false,true])test(`each source fades after its own last arrival, including across collection batches (reduced=${reduced})`,()=>{
 const before=createV4State(v4Levels[0],1);
 before.magnets=['blue'];before.magnetRadii={blue:2};
 const cells=[{col:3,row:2},{col:4,row:3},{col:5,row:3}];
 before.stacks=cells.map((cell,s)=>({cell,units:[
  ...(s===0?[{id:'foreign-bottom',color:'coral'}]:[]),
  ...Array.from({length:[6,8,5][s]},(_,i)=>({id:`s${s}u${i}`,color:'blue'}))]}));
 before.spawnedUnits=20;
 const resolution=applyV4Magnet(before,{type:'placeMagnet',cell:{col:3,row:3},color:'blue'});
 const timeline=makeTransferTimeline(before,resolution,reduced),fade=reduced?.08:.55;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),owned=[],plane=new THREE.PlaneGeometry();
 const effects=createInfluenceEffects(scene,camera,plane,r=>(owned.push(r),r),c=>new THREE.Vector3(c.col,0,c.row),()=>0);
 const sample=t=>{effects.draw(null,timeline,t,reduced,false);return effects.snapshot().lights;};
 const strength=(view,cell)=>view.sources.find(s=>s.cell.row===cell.row&&s.cell.col===cell.col).strength;
 const end=cell=>timeline.sourceArrivals.find(s=>s.cell.row===cell.row&&s.cell.col===cell.col).end;
 assert.equal(timeline.sourceArrivals.length,3);
 assert.deepEqual(sample(0).cells,cells);
 const firstEnd=end(cells[0]),lastEnd=end(cells[2]);
 assert.equal(strength(sample(firstEnd),cells[0]),1);
 assert.ok(Math.abs(strength(sample(firstEnd+fade/2),cells[0])-.5)<1e-8);
 const early=sample(firstEnd+fade+1e-6);
 assert.equal(strength(early,cells[0]),0);assert.equal(strength(early,cells[2]),1);
 // An unrelated lower color remains: completion concerns only the matching pull.
 assert(resolution.state.stacks.some(s=>s.units.some(u=>u.id==='foreign-bottom')));
 const middleMoves=timeline.segments.filter(s=>s.type==='unitMoved'&&s.from.col===4&&s.from.row===3);
 assert(new Set(middleMoves.map(s=>s.batch)).size>1);
 const gap=middleMoves[0].end+fade+1e-6;
 assert(gap<end(cells[1]));assert.equal(strength(sample(gap),cells[1]),1);
 assert.deepEqual(sample(lastEnd+fade+1e-6).cells,[]);
 assert(lastEnd+fade<timeline.duration);
 effects.draw(null,timeline,firstEnd+fade/2,reduced,true);assert.deepEqual(effects.snapshot().lights.cells,[]);
 assert.ok(Math.abs(strength(sample(firstEnd+fade/2),cells[0])-.5)<1e-8);
 effects.reset();assert.deepEqual(effects.snapshot().lights.cells,[]);
 owned.forEach(r=>r.dispose());plane.dispose();
});
