import test from 'node:test';
import assert from 'node:assert/strict';
import { stacksForMove,createV4State,applyV4Magnet } from '../src/prototype/model-v4.js';
import { canPlaceMagnet,remainingUnits } from '../src/prototype/model.js';
import {cellId} from '../src/game/hex.js';
const level={id:'spawn-boundary',number:12,blockers:[{col:1,row:1}]};
test('accepted moves use the new move count across both spawn boundaries',()=>{
 for(const [moves,count] of [[1,1],[5,1],[6,2],[10,2],[11,3],[99,3]]){
  assert.equal(stacksForMove(moves),count);
  const state=createV4State({...level,number:1},0);state.stacks=[];state.spawnedUnits=0;state.movesUsed=moves-1;state.turn=moves-1;
  const before=structuredClone(state),result=applyV4Magnet(state,{type:'placeMagnet',color:state.magnets[0],cell:{col:3,row:3}});
  assert.equal(result.events.filter(e=>e.type==='stackSpawned').length,count);assert.equal(result.state.movesUsed,moves);
  assert.deepEqual(state,before);assert.equal(result.state.spawnedUnits,remainingUnits(result.state));
 }
});
test('later levels stretch stages and reduce spawn frequency deterministically',()=>{
 for(const number of [2,12])for(const [moves,count] of [[5*number*number,1],[5*number*number+(number<=2?1:number),2],[10*number*number,2],[10*number*number+(number<=2?1:number),3]]){
  assert.equal(stacksForMove(moves,number),count);
  const s=createV4State({...level,number},2);s.stacks=[];s.spawnedUnits=0;s.movesUsed=moves-1;s.turn=moves-1;
  const r=applyV4Magnet(s,{type:'placeMagnet',color:s.magnets[0],cell:{col:3,row:3}});
  assert.equal(r.events.filter(e=>e.type==='stackSpawned').length,count);
 }
 assert.equal(stacksForMove(61,12),0);assert.equal(stacksForMove(65,12),0);
});
test('spawn at a final free slot loses after a zero pull and rejects all further moves',()=>{
 const s=createV4State({...level,number:1},1),target={col:3,row:3};s.movesUsed=10;s.turn=10;s.magnets=['blue','gold','lime'];
 s.stacks=s.cells.filter(c=>cellId(c)!==cellId(target)&&canPlaceMagnet({...s,stacks:[]},c)).map((cell,i)=>({cell,units:[{id:'full-'+i,color:'pink'}]}));s.spawnedUnits=remainingUnits(s);
 const before=structuredClone(s),r=applyV4Magnet(s,{type:'placeMagnet',color:'blue',cell:target});
 assert.deepEqual(s,before);assert.equal(r.events.filter(e=>e.type==='stackSpawned').length,1);assert.equal(r.state.terminal,'lost');assert.equal(r.state.stars,0);
 assert.equal(r.state.cells.some(c=>canPlaceMagnet(r.state,c)),false);assert.equal(r.state.spawnedUnits,remainingUnits(r.state)+r.state.cleared);
 assert.equal(applyV4Magnet(r.state,{type:'placeMagnet',color:'gold',cell:target}).reason,'terminal');
});
