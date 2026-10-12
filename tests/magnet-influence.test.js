import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMagnetInfluence,previewMagnetInfluence,sampleInfluenceArc} from '../src/prototype/magnet-influence.js';
import {offsetToAxial,axialToOffset,cellId,hexDistance} from '../src/game/hex.js';
import {createV4State,applyV4Magnet,spawnStacks,earnedStars} from '../src/prototype/model-v4.js';
import {remainingUnits} from '../src/prototype/model.js';
const dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const stack=(cell,colors)=>({cell,units:colors.map((color,i)=>({id:cellId(cell)+'-'+i,color}))});
const base=(stacks=[],blockers=[])=>({rulesVersion:4,cells:Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)})),blockers,stacks,magnets:['blue','gold','pink'],clearSize:6,cleared:0});
const shifted=(c,d,n)=>{const a=offsetToAxial(c);return axialToOffset({q:a.q+d[0]*n,r:a.r+d[1]*n});};
test('six straight directions in even/odd rows accept one/two steps, reject third and bent radius-two positions',()=>{
 for(const row of [2,3])for(const dir of dirs){
  const target={col:3,row},a=shifted(target,dir,1),b=shifted(target,dir,2),far=shifted(target,dir,3);
  const state=base([stack(a,['blue']),stack(b,['blue']),...(far?[stack(far,['blue'])]:[])]);
  const r=resolveMagnetInfluence(state,{cell:target,color:'blue'});
  assert.equal(r.events.filter(e=>e.type==='unitMoved'&&cellId(e.to)===cellId(target)).length,2);
  if(far)assert.ok(r.state.stacks.some(s=>cellId(s.cell)===cellId(far)));
  for(const e of r.events)if(e.type==='unitMoved')assert.equal(hexDistance(e.from,e.to),1);
 }
 const target={col:3,row:3},a=offsetToAxial(target),bent=axialToOffset({q:a.q+1,r:a.r+1});
 assert.equal(hexDistance(target,bent),2);assert.deepEqual(resolveMagnetInfluence(base([stack(bent,['blue'])]),{cell:target,color:'blue'}).events,[]);
});
test('blockers, foreign tops and absent intermediate cells stop a ray even with free bypass',()=>{
 const target={col:3,row:3},near=shifted(target,dirs[0],1),far=shifted(target,dirs[0],2);
 for(const s of [base([stack(far,['blue'])],[near]),base([stack(near,['pink']),stack(far,['blue'])])]){
  assert.deepEqual(resolveMagnetInfluence(s,{cell:target,color:'blue'}).events,[]);
  assert.deepEqual(previewMagnetInfluence(s,target,'blue').affectedCells,[]);
 }
 const absent=base([stack(far,['blue'])]);absent.cells=absent.cells.filter(c=>cellId(c)!==cellId(near));
 assert.deepEqual(resolveMagnetInfluence(absent,{cell:target,color:'blue'}).events,[]);
});
test('newly exposed foreign bottom stops farther stack, fully cleared near stack opens straight path',()=>{
 const target={col:3,row:3},near=shifted(target,dirs[0],1),far=shifted(target,dirs[0],2);
 const r=resolveMagnetInfluence(base([stack(near,['pink','blue']),stack(far,['blue'])]),{cell:target,color:'blue'});
 assert.equal(r.events.filter(e=>e.type==='unitMoved').length,1);assert.equal(r.state.stacks.find(s=>cellId(s.cell)===cellId(near)).units[0].color,'pink');
 assert.deepEqual(r.affectedCells,[near]);
 const open=resolveMagnetInfluence(base([stack(near,['blue']),stack(far,['blue'])]),{cell:target,color:'blue'});
 assert.equal(open.events.filter(e=>e.type==='unitMoved').length,3);
});
test('preview is immutable and matches actual affected movement cells without RNG draws',()=>{
 const s=createV4State({id:'test',number:1,blockers:[{col:1,row:1}]},12),target={col:3,row:3};
 const near=shifted(target,dirs[0],1),far=shifted(target,dirs[0],2);
 s.stacks=[stack(far,['pink',...Array(7).fill('blue')])];s.magnets=['blue','gold','pink'];s.spawnedUnits=remainingUnits(s);
 const before=structuredClone(s),plan=previewMagnetInfluence(s,target,'blue');assert.deepEqual(s,before);
 assert.deepEqual(new Set(plan.affectedCells.map(cellId)),new Set([cellId(near),cellId(far)]));
 const r=applyV4Magnet(s,{type:'placeMagnet',cell:target,color:'blue'});
 assert.deepEqual(r.influence,plan);assert.deepEqual(s,before);
 assert.equal(r.state.spawnedUnits,remainingUnits(r.state)+r.state.cleared);
});
test('100 seeds produce only 2/3 distinct contiguous groups in every initial and added stack',()=>{
 for(let seed=0;seed<100;seed++){
  const s=createV4State({id:'test',number:1,blockers:[{col:1,row:1}]},seed);
  const initial=[...s.stacks];s.stacks=[];spawnStacks(s,2);
  for(const stack of [...initial,...s.stacks]){
   const groups=stack.units.filter((u,i)=>i===0||u.color!==stack.units[i-1].color);
   assert.ok([2,3].includes(groups.length));assert.equal(new Set(groups.map(u=>u.color)).size,groups.length);
   const counts=groups.map(u=>stack.units.filter(v=>v.color===u.color).length);
   assert.ok(counts.every(c=>c===stack.units.length/groups.length));
  }
 }
 assert.equal(earnedStars(50,5,'won'),3);assert.equal(earnedStars(50,9,'won'),2);
});
test('parabolic particles start at the source, end at magnet, and rise in the middle',()=>{
 const a={x:2,y:.1,z:1},b={x:0,y:.1,z:0};
 assert.deepEqual(sampleInfluenceArc(a,b,0),a);assert.deepEqual(sampleInfluenceArc(a,b,1),b);
 const middle=sampleInfluenceArc(a,b,.5);assert.equal(middle.x,1);assert.ok(middle.y>a.y);
});
