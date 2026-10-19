import test from 'node:test';
import assert from 'node:assert/strict';
import { forecast, displayedForecast, forecastText } from '../src/prototype/spawn-forecast.js';
import { createV4State, applyV4Magnet, stacksForMove } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { canPlaceMagnet } from '../src/prototype/model.js';
import { makeTransferTimeline } from '../src/prototype/motion.js';

test('forecast reports the nearest scheduled spawn including quantity thresholds',()=>{
 for(const [n,moves,k,count] of [[1,4,1,1],[1,5,1,2],[1,10,1,3],[7,0,2,1],[7,1,1,1],[10,0,3,1],[10,499,2,2],[10,1000,2,3]]){
  const state={...createV4State(v4Levels[n-1],0),movesUsed:moves};
  assert.deepEqual(forecast(state),{turnsUntilSpawn:k,plannedCount:count});
 }
});
test('forecast is read only and matches the first actual nonzero schedule at all level/threshold boundaries',()=>{
 for(let n=1;n<=12;n++)for(const m of [0,1,2,5*n*n-1,5*n*n,5*n*n+1,10*n*n,10*n*n+1]){
  const s={...createV4State(v4Levels[n-1],42),movesUsed:m},before=structuredClone(s),f=forecast(s);
  assert.deepEqual(s,before);assert.equal(stacksForMove(m+f.turnsUntilSpawn,n),f.plannedCount);
  for(let k=1;k<f.turnsUntilSpawn;k++)assert.equal(stacksForMove(m+k,n),0);
 }
 for(const terminal of ['won','lost'])assert.equal(forecast({...createV4State(v4Levels[0],0),terminal}),null);
 assert.equal(forecastText({turnsUntilSpawn:1,plannedCount:2}),'New stacks next move: +2');
 assert.equal(forecastText({turnsUntilSpawn:3,plannedCount:1}),'New stacks in 3 moves: +1');
});
test('display holds before until first spawn or queue, normal/reduced and terminal result',()=>{
 for(const reduced of [false,true])for(const n of [1,7,10]){
  const before=createV4State(v4Levels[n-1],1),action={type:'placeMagnet',color:before.magnets[0],cell:before.cells.find(c=>canPlaceMagnet(before,c))};
  const result=applyV4Magnet(before,action),timeline=makeTransferTimeline(before,result,reduced);
  const start=timeline.segments.find(s=>s.type==='stackSpawned')?.start??timeline.queueStart;
  assert.deepEqual(displayedForecast(result.state,timeline,0),forecast(before));
  assert.deepEqual(displayedForecast(result.state,timeline,start-.001),forecast(before));
  assert.deepEqual(displayedForecast(result.state,timeline,start),forecast(result.state));
  const terminal={...result.state,terminal:'won'};
  assert.deepEqual(displayedForecast(terminal,timeline,timeline.duration-.001),forecast(before));
  assert.equal(displayedForecast(terminal,timeline,timeline.duration),null);
 }
});
