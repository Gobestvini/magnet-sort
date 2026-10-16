import test from 'node:test';
import assert from 'node:assert/strict';
import {levelPalette,levelGroupCounts,spawnInterval} from '../src/prototype/difficulty.js';
import {createV4State, applyV4Magnet, spawnStacks,fillMagnetQueue} from '../src/prototype/model-v4.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {canPlaceMagnet,topColor} from '../src/prototype/model.js';

test('level palettes expand at the specified boundaries without removing colors',()=>{
  let previous=[];
  for(const [number,count] of [[1,3],[3,3],[4,4],[6,4],[7,5],[9,5],[10,6],[11,6],[12,7]]){
    const colors=levelPalette(number);assert.equal(colors.length,count);
    assert.deepEqual(colors.slice(0,previous.length),previous);previous=colors;
  }
  for(const n of [0,13,1.5,undefined])assert.throws(()=>levelPalette(n));
});
test('100 seeds per level keep initial and added units and queue inside the level palette',()=>{
  for(const level of v4Levels)for(let seed=0;seed<100;seed++){
    const palette=levelPalette(level.number),s=createV4State(level,seed);
    assert.deepEqual(s,createV4State(level,seed));
    const r=applyV4Magnet(s,{type:'placeMagnet',color:s.magnets[0],cell:s.cells.find(c=>canPlaceMagnet(s,c))});
    for(const state of [s,r.state]){
      assert.ok(state.magnets.every(c=>palette.includes(c)));
      assert.ok(state.stacks.every(stack=>stack.units.every(u=>palette.includes(u.color))));
      if(state.stacks.length)assert.ok(state.magnets.every(c=>state.stacks.some(stack=>topColor(stack)===c)));
    }
    const added=structuredClone(s);added.stacks=[];spawnStacks(added,2);
    assert.ok(added.stacks.every(stack=>stack.units.every(u=>palette.includes(u.color))));
    for(const stack of [...s.stacks,...added.stacks]){
      const groups=stack.units.filter((u,i)=>i===0||u.color!==stack.units[i-1].color);
      assert.ok(levelGroupCounts(level.number,stack.units.length).includes(groups.length));
      assert.equal(new Set(groups.map(u=>u.color)).size,groups.length);
      for(const group of groups)assert.equal(stack.units.filter(u=>u.color===group.color).length,stack.units.length/groups.length);
    }
  }
});
test('top-only choices discard stale colors, handle 1/2/3/4 exposed colors and empty-board fallback',()=>{
  const s=createV4State(v4Levels[11],0);
  const setTops=colors=>{s.stacks=colors.map((color,i)=>({cell:{col:1+i,row:2},units:[{id:'bottom'+i,color:'pink'},{id:'top'+i,color}]}));};
  for(const colors of [['blue'],['blue','coral'],['blue','coral','gold'],['blue','coral','gold','lime']]){
    setTops(colors);const queue=fillMagnetQueue(s,['pink','coral']);
    assert.equal(queue.length,Math.min(3,colors.length));assert.equal(new Set(queue).size,queue.length);
    assert.ok(queue.every(c=>colors.includes(c)));if(colors.includes('coral'))assert.equal(queue[0],'coral');
  }
  setTops(['blue','blue']);assert.deepEqual(fillMagnetQueue(s),['blue']);
  s.stacks[0].units.pop();assert.ok(fillMagnetQueue(s,['blue']).includes('pink'));
  s.stacks=[];assert.equal(fillMagnetQueue(s).length,3);
  // N=7 has no spawn at move one: clearing the entire field must still permit a next move.
  const empty=createV4State(v4Levels[6],0);empty.stacks=[{cell:{col:3,row:2},units:Array.from({length:6},(_,i)=>({id:'empty'+i,color:'blue'}))}];
  empty.magnets=['blue'];empty.spawnedUnits=6;
  const r=applyV4Magnet(empty,{type:'placeMagnet',cell:{col:3,row:3},color:'blue'});
  assert.equal(r.state.stacks.length,0);assert.equal(r.state.terminal,null);assert.equal(r.state.magnets.length,3);
});
test('every early opening mixes one/two colors; subsequent spawns supply both without rerolls',()=>{
 for(const level of v4Levels.slice(0,3)){
  const addedTypes=new Set();
  for(let seed=0;seed<100;seed++){
   const s=createV4State(level,seed);
   const types=s.stacks.map(stack=>new Set(stack.units.map(u=>u.color)).size);
   assert.deepEqual(new Set(types),new Set([1,2]));
   assert.deepEqual(s,createV4State(level,seed));
   const added=structuredClone(s);added.stacks=[];spawnStacks(added,1);
   for(const stack of added.stacks)addedTypes.add(new Set(stack.units.map(u=>u.color)).size);
  }
  assert.deepEqual(addedTypes,new Set([1,2]));
 }
});
test('late levels remain slower while supplying enough pieces without long empty waits',()=>{
  for(let number=1;number<=12;number++)assert.equal(spawnInterval(number),number<=6?1:number<=9?2:3);
});
