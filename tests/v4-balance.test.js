import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyReplay,simulate} from '../tools/verify-v4-balance.mjs';
const witnesses=JSON.parse(fs.readFileSync(new URL('../tools/fixtures/v4-progression-witnesses.json',import.meta.url)));
const alternatives=JSON.parse(fs.readFileSync(new URL('../tools/fixtures/v4-balance-alternatives.json',import.meta.url)));
test('three current-rules routes on different seeds win every active level',()=>{
 assert.equal(witnesses.length,36);
 for(let number=1;number<=12;number++){
  const routes=witnesses.filter(r=>r.number===number);assert.equal(routes.length,3);assert.equal(new Set(routes.map(r=>r.seed)).size,3);
  for(const route of routes)assert.equal(verifyReplay(route).terminal,'won');
 }
 const broken=structuredClone(witnesses[0]);broken.actions[0].color='not-a-color';assert.throws(()=>verifyReplay(broken));
});
test('same seed admits a winning and a worse alternative on four difficulty bands',()=>{
 assert.deepEqual(alternatives.map(r=>r.number),[4,7,10,12]);
 for(const pair of alternatives){
  assert.equal(pair.win.seed,pair.other.seed);assert.equal(verifyReplay(pair.win).terminal,'won');
  assert.ok(pair.other.outcome==='lost'||pair.other.moves>pair.win.moves);
  if(pair.other.outcome!=='timeout')verifyReplay(pair.other);
 }
});
test('bounded policies distinguish timeouts and preserve deterministic choices',()=>{
 for(const policy of ['greedy','random']){
  const a=simulate(12,0,policy,1),b=simulate(12,0,policy,1);
  assert.equal(a.outcome,'timeout');assert.equal(a.moves,1);
  const {elapsedMs:ignoreA,...first}=a,{elapsedMs:ignoreB,...second}=b;assert.deepEqual(first,second);
 }
});
