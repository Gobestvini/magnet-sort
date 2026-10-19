import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { v4Levels } from '../../src/prototype/levels-v4.js';
import { canPlaceMagnet, remainingUnits } from '../../src/prototype/model.js';
import { makeTransferTimeline } from '../../src/prototype/motion.js';
import { chooseGreedy } from '../verify-v4-balance.mjs';
import { paceRules, PACE_PROFILES, PACE_VERSION } from './pace-profiles.js';

export function runPace(id, number, seed, policy = 'greedy', limit = 320) {
  const rules=paceRules(id);
  let state=rules.createV4State(v4Levels[number-1],seed),policyRng=(seed^0x9e3779b9)>>>0;
  let minFree=state.cells.filter(c=>canPlaceMagnet(state,c)).length,normalSeconds=0,reducedSeconds=0;
  const actions=[];
  while(!state.terminal&&actions.length<limit) {
    let action;
    if(policy==='greedy')action=chooseGreedy(state);
    else {
      const cells=state.cells.filter(c=>canPlaceMagnet(state,c));
      policyRng=(Math.imul(1664525,policyRng)+1013904223)>>>0;
      const index=Math.floor(policyRng/2**32*(state.magnets.length*cells.length));
      action={type:'placeMagnet',color:state.magnets[Math.floor(index/cells.length)],cell:cells[index%cells.length]};
    }
    const before=state,result=rules.applyV4Magnet(state,action);
    if(!result.accepted)throw Error('Rejected experiment action');
    state=result.state;actions.push(action);
    normalSeconds+=makeTransferTimeline(before,result,false).duration;
    reducedSeconds+=makeTransferTimeline(before,result,true).duration;
    minFree=Math.min(minFree,state.cells.filter(c=>canPlaceMagnet(state,c)).length);
    if(state.spawnedUnits!==remainingUnits(state)+state.cleared)throw Error('Conservation failure');
  }
  return {profile:id,number,seed,policy,outcome:state.terminal??'unknown',moves:state.movesUsed,
    cleared:state.cleared,stars:state.stars,minFree,normalSeconds:+normalSeconds.toFixed(3),
    reducedSeconds:+reducedSeconds.toFixed(3),actions,state};
}
export function verifyPaceReplay(record) {
  const rules=paceRules(record.profile);
  let state=rules.createV4State(v4Levels[record.number-1],record.seed);
  for(const action of record.actions){const r=rules.applyV4Magnet(state,action);if(!r.accepted)throw Error('Rejected witness');state=r.state;}
  if(JSON.stringify(state)!==JSON.stringify(record.state))throw Error('Replay state mismatch');
  return state;
}
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(p*values.length)-1)]:null;
export function summarizePace(records) {
  const summaries=[];
  for(const id of Object.keys(PACE_PROFILES))for(const level of v4Levels) {
    const rows=records.filter(r=>r.profile===id&&r.number===level.number),g=rows.filter(r=>r.policy==='greedy'),w=g.filter(r=>r.outcome==='won');
    const outcomes=policy=>Object.fromEntries(['won','lost','unknown'].map(o=>[o,rows.filter(r=>r.policy===policy&&r.outcome===o).length]));
    summaries.push({profile:id,number:level.number,goal:PACE_PROFILES[id].goals[level.number-1],cadence:PACE_PROFILES[id].spawnIntervals[level.number-1],
      greedy:outcomes('greedy'),random:outcomes('random'),medianMoves:percentile(w.map(r=>r.moves),.5),p90Moves:percentile(w.map(r=>r.moves),.9),
      medianNormalSeconds:percentile(w.map(r=>r.normalSeconds),.5),p90NormalSeconds:percentile(w.map(r=>r.normalSeconds),.9),
      medianReducedSeconds:percentile(w.map(r=>r.reducedSeconds),.5),minFree:g.length?Math.min(...g.map(r=>r.minFree)):null,
      currentStars:[1,2,3].map(n=>w.filter(r=>r.stars===n).length),
      proposedStars:{threeAtMost:percentile(w.map(r=>r.moves),.25),twoAtMost:percentile(w.map(r=>r.moves),.6),sample:w.length}});
  }
  return summaries;
}
async function main() {
  const records=[],witnesses=[],out='artifacts/telegram-pace';fs.mkdirSync(out,{recursive:true});
  for(const id of Object.keys(PACE_PROFILES))for(const level of v4Levels) {
    for(let seed=0;seed<50;seed++)for(const policy of ['greedy','random']) {
      const record=runPace(id,level.number,seed,policy);verifyPaceReplay(record);records.push(record);
    }
    const won=records.filter(r=>r.profile===id&&r.number===level.number&&r.outcome==='won');
    const selected=[...won.filter(r=>r.policy==='greedy'),...won.filter(r=>r.policy==='random')].slice(0,3);
    witnesses.push(...selected.map(({state,...record})=>({...record,finalStateSha256:createHash('sha256').update(JSON.stringify(state)).digest('hex')})));
    const row=summarizePace(records).find(r=>r.profile===id&&r.number===level.number);
    console.log(id+' L'+level.number+': '+row.greedy.won+'/50 greedy, median '+row.medianMoves+' moves, '+row.medianNormalSeconds+'s locked timeline, witnesses '+selected.length);
  }
  const inputs=['src/prototype/model-v4.js','src/prototype/model.js','src/prototype/magnet-influence.js','src/prototype/magnet-radius.js','src/prototype/difficulty.js','src/prototype/levels-v4.js','src/prototype/motion.js','src/prototype/source-light.js','src/game/hex.js','tools/verify-v4-balance.mjs','tools/experiments/pace-profiles.js','tools/experiments/telegram-pace.mjs'];
  const metadata={date:'2026-10-19',version:PACE_VERSION,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),inputSha256:Object.fromEntries(inputs.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),
    seedRange:[0,49],cutoff:320,policies:['greedy','random'],quantiles:'nearest-rank ceil(p*n)-1 among greedy wins',
    evidence:'Model/replay and exact input-locked timeline budget. Not human completion time, CPU benchmark or device FPS.'};
  const summary={metadata,profiles:PACE_PROFILES,summary:summarizePace(records),witnessCounts:Object.fromEntries(Object.keys(PACE_PROFILES).map(id=>[id,witnesses.filter(w=>w.profile===id).length]))};
  fs.writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');
  fs.writeFileSync(out+'/records.json',JSON.stringify(records.map(({actions,state,...r})=>r),null,2)+'\n');
  fs.writeFileSync(out+'/witnesses.json',JSON.stringify(witnesses,null,2)+'\n');
  console.log('Saved '+records.length+' replay-verified runs and '+witnesses.length+' witnesses. Production preset unchanged.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
