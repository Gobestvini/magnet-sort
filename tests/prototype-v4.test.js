import test from 'node:test';
import assert from 'node:assert/strict';
import { createV4State, applyV4Magnet, drawIndex, spawnStacks, fillMagnetQueue, earnedStars, V4_CELLS, validateV4Level } from '../src/prototype/model-v4.js';
import { canPlaceMagnet, remainingUnits, topColor } from '../src/prototype/model.js';
import { cellId, neighborCells } from '../src/game/hex.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
const level={id:'v4-test',number:1,blockers:[{col:1,row:1}]};
const action=(color,cell)=>({type:'placeMagnet',color,cell});
function assertMass(s){assert.equal(s.spawnedUnits,remainingUnits(s)+s.cleared);const ids=s.stacks.flatMap(x=>x.units.map(u=>u.id));assert.equal(ids.length,new Set(ids).size);}
test('v4 seeded initialization and LCG are exact, reproducible, zero seed is valid',()=>{
 const r={rng:0};assert.equal(drawIndex(r,7),1);assert.equal(r.rng,1013904223);
 const a=createV4State(level,0);assert.deepEqual(a,createV4State(level,0));assert.notDeepEqual(a,createV4State(level,1));
 assert.equal(a.stacks.length,5);assert.equal(a.goal,50);assert.equal(a.movesUsed,0);assert.ok(a.magnets.length>=1&&a.magnets.length<=3);assertMass(a);
 for(const s of a.stacks){assert.ok([6,12].includes(s.units.length));assert.equal(new Set(s.units.map(u=>u.color)).size,1);assert.notEqual(cellId(s.cell),'r1c1');}
 assert.throws(()=>createV4State(level,-1));assert.throws(()=>createV4State(level,2**32));
});
test('invalid placement returns original state without draws, steps or queue consumption',()=>{
 const s=createV4State(level,42);
 for(const a of [action(s.magnets[0],level.blockers[0]),action(s.magnets[0],s.stacks[0].cell),action('invalid',{col:3,row:3}),action(s.magnets[0],{col:0,row:0})]){
  const r=applyV4Magnet(s,a);assert.equal(r.accepted,false);assert.equal(r.state,s);assert.deepEqual(r.events,[]);
 }
});
test('accepted zero-pull advances exactly once, creates bounded stacks and leaves input immutable',()=>{
 const s=createV4State(level,1);s.stacks=[];s.spawnedUnits=0;
 const before=structuredClone(s),r=applyV4Magnet(s,action(s.magnets[0],{col:3,row:3}));
 assert.deepEqual(s,before);assert.equal(r.accepted,true);assert.equal(r.state.movesUsed,1);assert.equal(r.state.stacks.length,1);assert.equal(r.state.terminal,null);
 assert.equal(r.events.some(e=>e.type==='unitMoved'),false);assertMass(r.state);
});
test('spawn fills the last places and never occupies blockers or stacks',()=>{
 const s=createV4State(level,10);s.stacks=s.cells.filter(c=>!s.blockers.some(b=>cellId(b)===cellId(c))).slice(0,-2).map((cell,i)=>({cell,units:[{id:'test'+i,color:'pink'}]}));
 s.spawnedUnits=remainingUnits(s);s.cleared=0;
 assert.equal(spawnStacks(s,3).length,2);assert.equal(s.cells.filter(c=>canPlaceMagnet(s,c)).length,0);
 const rng=s.rng;assert.deepEqual(spawnStacks(s,2),[]);assert.equal(s.rng,rng);assertMass(s);
});
test('winning 48+6 overshoots goal without spawn/refill, empty field below goal continues',()=>{
 const s=createV4State(level,10);s.magnets=['violet','blue','coral'];s.cleared=48;s.spawnedUnits=54;
 s.stacks=[{cell:{col:3,row:2},units:Array.from({length:6},(_,i)=>({id:'clear'+i,color:'violet'}))}];
 const r=applyV4Magnet(s,action('violet',{col:3,row:3}));
 assert.equal(r.state.cleared,54);assert.equal(r.state.terminal,'won');assert.equal(r.state.rng,s.rng);assert.equal(r.state.magnets.length,2);assert.equal(r.events.some(e=>e.type==='stackSpawned'),false);assertMass(r.state);
 const below={...s,cleared:0,spawnedUnits:6};const next=applyV4Magnet(below,action('violet',{col:3,row:3}));
 assert.equal(next.state.terminal,null);assert.equal(next.state.stacks.length,1);assert.equal(next.state.cleared,6);assertMass(next.state);
 assert.equal(applyV4Magnet(r.state,action('blue',{col:2,row:3})).reason,'terminal');
});
test('queue retains exposed colors in order, is unique, and permits used color again',()=>{
 let sawUsed=false;
 for(let seed=0;seed<1000;seed++){
  const s=createV4State(level,seed),before=[...s.magnets],slot=seed%before.length,used=before[slot];
  s.stacks=[];s.spawnedUnits=0;
  const r=applyV4Magnet(s,action(used,{col:3,row:3})).state;
  const tops=new Set(r.stacks.map(topColor)),retained=before.filter((c,i)=>i!==slot&&tops.has(c));
  assert.deepEqual(r.magnets.slice(0,retained.length),retained);
  assert.equal(new Set(r.magnets).size,r.magnets.length);assert.ok(r.magnets.every(c=>tops.has(c)));
  sawUsed||=r.magnets.at(-1)===used;
 }
 assert.equal(sawUsed,true);assert.throws(()=>fillMagnetQueue({rng:0},['blue','blue']));
});
test('100 deterministic turns conserve identities and every movement is adjacent',()=>{
 let s=createV4State(level,11),replay=createV4State(level,11);
 for(let i=0;i<100&&!s.terminal;i++){
  const cell=s.cells.find(c=>canPlaceMagnet(s,c)),a=action(s.magnets[i%s.magnets.length],cell);
  const r=applyV4Magnet(s,a),again=applyV4Magnet(replay,a);
  assert.deepEqual(r,again);assertMass(r.state);
  for(const e of r.events.filter(e=>e.type==='unitMoved'))assert.ok(neighborCells(e.from).some(c=>cellId(c)===cellId(e.to)));
  s=r.state;replay=again.state;
 }
 assert.deepEqual(createV4State(level,11),createV4State(level,11),'retry seed restores start');
});
test('stars are inclusive at both boundaries and monotonic for every goal',()=>{
 for(const goal of [50,100,600]){
  const a=Math.ceil(goal/12),b=Math.ceil(goal/6);
  for(const m of [a-1,a])assert.equal(earnedStars(goal,m,'won'),3);
  assert.equal(earnedStars(goal,a+1,'won'),2);assert.equal(earnedStars(goal,b,'won'),2);assert.equal(earnedStars(goal,b+1,'won'),1);
  for(let m=1;m<100;m++)assert.ok(earnedStars(goal,m,'won')>=earnedStars(goal,m+1,'won'));
  assert.equal(earnedStars(goal,1,'lost'),0);
 }
});
test('level schema forbids authored state and disconnected or invalid blockers',()=>{
 assert.equal(validateV4Level(level),level);
 for(const change of [{goal:100},{stacks:[]},{number:0},{blockers:[{col:1,row:1},{col:1,row:1}]},{blockers:[{col:6,row:1}]}])assert.throws(()=>validateV4Level({...level,...change}));
 assert.equal(V4_CELLS.length,25);
});
test('all twelve active layouts contain only identity and sparse distinct crosses',()=>{
 assert.equal(v4Levels.length,12);assert.equal(new Set(v4Levels.map(l=>l.id)).size,12);
 for(const [i,l]of v4Levels.entries()){
  assert.deepEqual(Object.keys(l).sort(),['blockers','id','number']);assert.equal(l.number,i+1);
  for(const seed of [0,1,42]){const s=createV4State(l,seed);assert.equal(s.goal,50*(i+1));assertMass(s);assert.ok(s.cells.some(c=>canPlaceMagnet(s,c)));}
 }
});
test('a partial pull that fills the final empty tile loses without a move-limit message',()=>{
 const s=createV4State(level,0),target={col:3,row:3},source={col:3,row:2};s.magnets=['blue','gold','lime'];
 s.stacks=s.cells.filter(c=>cellId(c)!==cellId(target)&&!s.blockers.some(b=>cellId(b)===cellId(c))).map((cell,i)=>({cell,units:[{id:'bottom'+i,color:'gold'},...(cellId(cell)===cellId(source)?[{id:'partial-blue',color:'blue'}]:[])]}));
 s.spawnedUnits=remainingUnits(s);s.cleared=0;
 const r=applyV4Magnet(s,action('blue',target));assert.equal(r.state.terminal,'lost');assert.equal(r.state.stars,0);assert.equal(r.state.movesUsed,1);assertMass(r.state);
 assert.equal(r.events.some(e=>e.type==='stackSpawned'),false);
});

