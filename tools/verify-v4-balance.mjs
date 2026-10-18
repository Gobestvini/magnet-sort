import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as defaultModel from '../src/prototype/model-v4.js';
import {resolveMagnetInfluence} from '../src/prototype/magnet-influence.js';
import {canPlaceMagnet,remainingUnits} from '../src/prototype/model.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {levelPalette,levelGroupCounts,spawnInterval} from '../src/prototype/difficulty.js';
let model=defaultModel;

export function chooseGreedy(state) {
  let best=null;
  const free=state.cells.filter(c=>canPlaceMagnet(state,c));
  for(const color of state.magnets)for(const cell of free){
    const action={type:'placeMagnet',color,cell},r=resolveMagnetInfluence(state,action);
    // Read only the present board. No future spawn/queue or RNG lookahead.
    const empty=r.state.cells.filter(c=>canPlaceMagnet(r.state,c)).length;
    const groups=r.state.stacks.reduce((sum,s)=>sum+s.units.filter((u,i)=>i===0||u.color!==s.units[i-1].color).length,0);
    const moved=new Set(r.events.filter(e=>e.type==='unitMoved').map(e=>e.unit.id)).size;
    const score=(r.state.cleared-state.cleared)*40+empty*12+moved*8-groups*4;
    if(!best||score>best.score)best={action,score};
  }
  return best?.action;
}
export function simulate(number,seed,policy='greedy',limit=320){
  let state=model.createV4State(v4Levels[number-1],seed),policyRng=(seed^0x9e3779b9)>>>0;
  const actions=[];let minFree=state.cells.filter(c=>canPlaceMagnet(state,c)).length;
  const started=performance.now();
  while(!state.terminal&&actions.length<limit){
    let action;
    if(policy==='greedy')action=chooseGreedy(state);
    else{
      const cells=state.cells.filter(c=>canPlaceMagnet(state,c));
      policyRng=(Math.imul(1664525,policyRng)+1013904223)>>>0;
      const index=Math.floor(policyRng/2**32*(state.magnets.length*cells.length));
      action={type:'placeMagnet',color:state.magnets[Math.floor(index/cells.length)],cell:cells[index%cells.length]};
    }
    if(!action)throw new Error('No action in nonterminal state');
    const r=model.applyV4Magnet(state,action);if(!r.accepted)throw new Error('Policy issued rejected action');
    state=r.state;actions.push(action);minFree=Math.min(minFree,state.cells.filter(c=>canPlaceMagnet(state,c)).length);
  }
  return {number,seed,policy,outcome:state.terminal??'timeout',moves:state.movesUsed,cleared:state.cleared,stars:state.stars,minFree,
    elapsedMs:Math.round(performance.now()-started),limit,actions};
}
export function verifyReplay(route){
  let state=model.createV4State(v4Levels[route.number-1],route.seed);
  for(const action of route.actions){const r=model.applyV4Magnet(state,action);if(!r.accepted)throw new Error('Rejected replay action');state=r.state;}
  if(state.terminal!==route.outcome||state.cleared!==route.cleared||state.movesUsed!==route.moves||state.stars!==route.stars)throw new Error('Replay outcome mismatch');
  if(state.spawnedUnits!==remainingUnits(state)+state.cleared)throw new Error('Replay conservation failure');
  return state;
}
export function summarize(records){
  return v4Levels.map(level=>{
    const byPolicy=policy=>records.filter(r=>r.number===level.number&&r.policy===policy);
    const count=(rows,outcome)=>rows.filter(r=>r.outcome===outcome).length;
    const greedy=byPolicy('greedy'),random=byPolicy('random'),won=greedy.filter(r=>r.outcome==='won');
    return {number:level.number,greedyWins:count(greedy,'won'),randomWins:count(random,'won'),greedyLost:count(greedy,'lost'),greedyTimeout:count(greedy,'timeout'),
      randomLost:count(random,'lost'),randomTimeout:count(random,'timeout'),medianMoves:won.length?[...won].sort((a,b)=>a.moves-b.moves)[Math.floor(won.length/2)].moves:null,
      stars:[1,2,3].map(n=>won.filter(r=>r.stars===n).length)};
  });
}
async function main(){
  const label=process.argv[2]??'final',measureOnly=process.argv.includes('--measure-only'),records=[];
  const modelArg=process.argv.indexOf('--model');
  if(modelArg>=0)model=await import(pathToFileURL(path.resolve(process.argv[modelArg+1])).href);
  for(const level of v4Levels){
    for(let seed=0;seed<50;seed++)for(const policy of ['greedy','random'])records.push(simulate(level.number,seed,policy));
    const s=summarize(records).find(r=>r.number===level.number);
    console.log(`L${s.number}: greedy ${s.greedyWins}/50, random ${s.randomWins}/50; greedy lost ${s.greedyLost}, timeout ${s.greedyTimeout}; median moves ${s.medianMoves}`);
  }
  const summary=summarize(records),witnesses=[],alternatives=[];
  for(const level of v4Levels){
    const won=records.filter(r=>r.number===level.number&&r.policy==='greedy'&&r.outcome==='won').slice(0,3);
    for(const r of won){verifyReplay(r);witnesses.push(r);}
    if([4,7,10,12].includes(level.number)){
      const pair=records.find(r=>r.number===level.number&&r.policy==='greedy'&&r.outcome==='won'&&records.some(a=>a.seed===r.seed&&a.number===r.number&&a.policy==='random'&&(a.outcome==='lost'||a.moves>r.moves)));
      if(pair){const other=records.find(r=>r.number===pair.number&&r.seed===pair.seed&&r.policy==='random');verifyReplay(pair);if(other.outcome!=='timeout')verifyReplay(other);alternatives.push({number:pair.number,seed:pair.seed,win:pair,other});}
    }
  }
  const difficulty=model.difficulty??{levelPalette,levelGroupCounts,spawnInterval};
  const report={label,date:'2026-10-18',config:model.V4_CONFIG,bands:v4Levels.map(l=>({number:l.number,palette:difficulty.levelPalette(l.number),groups6:difficulty.levelGroupCounts(l.number,6),groups10:difficulty.levelGroupCounts(l.number,10),spawnInterval:difficulty.spawnInterval(l.number)})),summary,
    records:records.map(({actions,...r})=>r),witnesses,alternatives};
  const output=`artifacts/v4-balance/${label}.json`;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  const failures=summary.filter(s=>s.greedyWins<(s.number<=3?45:35)||(s.number>=4&&s.greedyWins-s.randomWins<5));
  if(!measureOnly&&(failures.length||witnesses.length!==36||alternatives.length!==4))throw new Error(`Balance criteria not met: levels ${failures.map(s=>s.number)}, witnesses ${witnesses.length}/36, alternatives ${alternatives.length}/4. Report: ${output}`);
  console.log(`Saved ${output}, ${witnesses.length} verified witnesses, ${alternatives.length} alternatives.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
