import test from 'node:test';
import assert from 'node:assert/strict';
import {topRunCount,presentation} from '../docs/design/prototypes/gameplay-counted-hex/presentation.js';
import {fixtures,scenario} from '../docs/design/prototypes/gameplay-counted-hex/fixtures.js';
import {position,contour,geometry,DESIGN,posePosition} from '../docs/design/prototypes/gameplay-counted-hex/geometry.js';
import {neighborCells,cellId} from '../src/game/hex.js';
test('count is the uninterrupted top run, not total or all occurrences',()=>{
 const list=colors=>colors.map(color=>({color}));
 assert.equal(topRunCount([]),0);assert.equal(topRunCount(list(['violet','blue','violet'])),1);
 assert.equal(topRunCount(list(['blue','blue','violet','violet','violet'])),3);
 for(const n of [1,6,12,20])assert.equal(topRunCount(list(Array(n).fill('blue'))),n);
});
test('all fixtures conserve IDs through launch, landing and clear; reverse scrub is pure',()=>{
 for(const fixture of fixtures)for(const reduced of [false,true]){
  const {before,timeline}=scenario(fixture.id,reduced),ids=before.stacks.flatMap(s=>s.units.map(u=>u.id)).sort();
  const times=[0,timeline.duration,...timeline.segments.flatMap(s=>[s.start,s.start+.00001,(s.start+s.end)/2,s.end])];
  for(const t of times){
   const p=presentation(timeline,t),flat=Object.values(p.phases).flat().sort();
   assert.deepEqual(flat,ids,`${fixture.id} @${t}`);assert.equal(new Set(flat).size,ids.length);
   assert.equal(p.units.length,p.phases.resting.length+p.phases.flying.length+p.phases.clearing.length);
   for(const s of p.stacks)assert.equal(s.units.some(u=>u.from),false);
   assert.deepEqual(presentation(timeline,t),p);
  }
  const result=presentation(timeline,timeline.duration).stacks.flatMap(s=>s.units.map(u=>({id:u.id,cell:s.cell}))).sort((a,b)=>a.id.localeCompare(b.id));
  const expected=timeline.after.stacks.flatMap(s=>s.units.map(u=>({id:u.id,cell:s.cell}))).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(result,expected);
 }
});
test('source count falls on launch and destination grows on landing',()=>{
 const {timeline}=scenario('mixed'),s=timeline.segments[0];
 const launch=presentation(timeline,s.start),before=presentation(timeline,s.start-.00001);
 assert.equal(topRunCount(before.stacks[0].units),3);
 assert.equal(topRunCount(launch.stacks.find(st=>cellId(st.cell)===cellId(s.from)).units),2);
 assert.equal(launch.phases.flying.length,1);
 const landed=presentation(timeline,s.end);
 assert.equal(topRunCount(landed.stacks.find(st=>cellId(st.cell)===cellId(s.to)).units),1);
});
test('a chain has more hop events than unique units without overlapping hops per ID',()=>{
 const {timeline}=scenario('chain'),moves=timeline.segments.filter(s=>s.type==='unitMoved');
 assert.equal(moves.length,8);assert.equal(new Set(moves.map(s=>s.unit.id)).size,4);
 for(const a of moves)for(const b of moves)if(a!==b&&a.unit.id===b.unit.id)assert.ok(a.end<=b.start||b.end<=a.start);
});
test('one point-up contour tessellates all model neighbors and exact landing indices',()=>{
 const points=contour();assert.ok(Math.abs(points[0].x-points[5].x)<1e-10);
 const c={col:3,row:3},p=position(c);
 for(const n of neighborCells(c)){const q=position(n);assert.ok(Math.abs(Math.hypot(p.x-q.x,p.z-q.z)-Math.sqrt(3))<1e-10);}
 const g=geometry(DESIGN.chipRadius,DESIGN.thickness);g.computeBoundingBox();
 assert.ok(Math.abs(g.boundingBox.min.y)<1e-6);
 assert.ok(Math.abs(g.boundingBox.max.y-DESIGN.thickness)<1e-6);g.dispose();
 const {timeline}=scenario('chain');
 for(const s of timeline.segments.filter(s=>s.type==='unitMoved')){
  const at=posePosition({...s.unit,cell:s.to,index:s.toIndex}),q=position(s.to);
  assert.equal(at.x,q.x);assert.equal(at.z,q.z);assert.equal(at.y,DESIGN.floor+s.toIndex*DESIGN.thickness);
 }
});
