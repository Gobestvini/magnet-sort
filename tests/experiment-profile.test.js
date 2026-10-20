import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createV4State, applyV4Magnet, createV4Rules } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { paceRules, PACE_PROFILES } from '../tools/experiments/pace-profiles.js';
import { createV4Session } from '../src/prototype/session.js';
import { forecast } from '../src/prototype/spawn-forecast.js';
const frozen=JSON.parse(readFileSync(new URL('../tools/experiments/default-traces.json',import.meta.url)));
test('default production and explicit A match all 36 current-content state/event trace hashes',()=>{
 const A=paceRules('A');
 for(const t of frozen.traces)for(const rules of [{createV4State,applyV4Magnet},A]){
  let s=rules.createV4State(v4Levels[t.number-1],t.seed);const hash=createHash('sha256').update(JSON.stringify(s));
  for(const action of t.actions){const r=rules.applyV4Magnet(s,action);assert.equal(r.accepted,true);hash.update(JSON.stringify(r));s=r.state;}
  assert.equal(hash.digest('hex'),t.sha256,'level '+t.number+' seed '+t.seed);
 }
});
test('only explicit goal/cadence differ, inputs are copied and invalid profiles rejected',()=>{
 for(const id of ['A','B','C'])for(const level of v4Levels){
  const rules=paceRules(id),s=rules.createV4State(level,0),base=createV4State(level,0);
  assert.deepEqual({...s,goal:base.goal},base);assert.equal(s.goal,PACE_PROFILES[id].goals[level.number-1]);
  const interval=PACE_PROFILES[id].spawnIntervals[level.number-1];
  assert.equal(rules.stacksForMove(interval,level.number),1);
  if(interval>1)assert.equal(rules.stacksForMove(1,level.number),0);
 }
 const profile={goals:[...PACE_PROFILES.B.goals],spawnIntervals:[...PACE_PROFILES.B.spawnIntervals]},rules=createV4Rules(profile);
 profile.goals[0]=999;assert.equal(rules.createV4State(v4Levels[0],0).goal,40);
 assert.throws(()=>createV4Rules({goals:[],spawnIntervals:[]}));assert.throws(()=>paceRules('D'));
});
test('experimental session is transient and its forecast follows the same explicit schedule',()=>{
 const rules=paceRules('C');
 assert.throws(()=>createV4Session({newSeed:()=>0,rules}));
 const session=createV4Session({newSeed:()=>0,fixedSeed:0,rules,initialLevelIndex:9});
 assert.equal(session.state.goal,130);assert.equal(session.status().reason,'transient');
 assert.deepEqual(forecast(session.state,rules),{turnsUntilSpawn:2,plannedCount:1});
});
