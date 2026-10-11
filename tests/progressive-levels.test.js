import test from 'node:test';
import assert from 'node:assert/strict';
import { progressiveLevels } from '../src/prototype/progressive-levels.js';
import { createPrototypeState, applyMagnet } from '../src/prototype/model.js';
import { analyzeLevel, createSearch } from '../tools/v3-level-search.mjs';

test('nine puzzles have multiple routed wins and a useful provably losing choice',()=>{
  assert.equal(progressiveLevels.length,9);
  for(const [i,level] of progressiveLevels.entries()) {
    const report=analyzeLevel(level);
    assert.equal(report.min,2+Math.floor(i/3),level.id);
    assert.equal(report.witnesses.length,3,level.id);
    assert.ok(report.differentRoutes && report.winningFirst>=2);
    assert.ok(report.losingFirst>0 && report.branch);
    for(const path of report.witnesses) {
      let state=createPrototypeState(level);
      for(const action of path) {
        const result=applyMagnet(state,action);
        assert.ok(result.accepted && result.events.some(e=>e.type==='unitMoved'));
        state=result.state;
      }
      assert.equal(state.terminal,'won');
    }
    const bad=applyMagnet(createPrototypeState(level),report.branch.bad);
    assert.ok(bad.events.some(e=>e.type==='unitMoved'));
    assert.equal(createSearch().solve(bad.state).paths.length,0);
  }
});
test('exhausted search budget is unknown, never reported as a losing branch',()=>{
  assert.throws(()=>analyzeLevel(progressiveLevels[8],{maxStates:1}),/Search unknown/);
});
