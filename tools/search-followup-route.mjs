import {createV4State,applyV4Magnet} from '../src/prototype/model-v4.js';
import {canPlaceMagnet,topColor} from '../src/prototype/model.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import fs from 'node:fs';
function score(s){
 const free=s.cells.filter(c=>canPlaceMagnet(s,c)).length;
 const groups=s.stacks.reduce((sum,stack)=>sum+stack.units.filter((u,i)=>i===0||u.color!==stack.units[i-1].color).length,0);
 return s.terminal==='lost'?-1e6:s.cleared*12+free*28-groups*4+s.stacks.filter(x=>s.magnets.includes(topColor(x))).length*2;
}
export function searchRoute(number,seed,weight=28){
 let state=createV4State(v4Levels[number-1],seed),actions=[];
 for(let turn=0;turn<2000&&!state.terminal;turn++){
  let best=null;
  for(const color of state.magnets)for(const cell of state.cells.filter(c=>canPlaceMagnet(state,c))){
   const action={type:'placeMagnet',color,cell},r=applyV4Magnet(state,action),value=score(r.state)+(weight-28)*r.state.cells.filter(c=>canPlaceMagnet(r.state,c)).length;
   if(!best||value>best.value)best={value,action,state:r.state};
  }
  if(!best)break;state=best.state;actions.push(best.action);
 }
 return {seed,number,actions,state};
}
export function beamRoute(number,seed,width=24,maxTurns=320){
 let frontier=[{state:createV4State(v4Levels[number-1],seed),actions:[]}];
 for(let turn=0;turn<maxTurns;turn++){
  const next=[],seen=new Set();
  for(const node of frontier)for(const color of node.state.magnets)for(const cell of node.state.cells.filter(c=>canPlaceMagnet(node.state,c))){
   const action={type:'placeMagnet',color,cell},r=applyV4Magnet(node.state,action);
   if(r.state.terminal==='lost')continue;
   const child={state:r.state,actions:[...node.actions,action],seed,number,value:score(r.state)};
   if(r.state.terminal==='won')return child;
   const key=JSON.stringify([r.state.rng,r.state.cleared,r.state.magnets,r.state.stacks.map(s=>[s.cell,s.units.map(u=>u.color)])]);
   if(!seen.has(key)){next.push(child);seen.add(key);}
  }
  next.sort((a,b)=>b.value-a.value);frontier=next.slice(0,width);if(!frontier.length)break;
 }
 return frontier[0]??null;
}
if(process.argv[1]?.endsWith('search-followup-route.mjs')){
 const number=Number(process.argv[2]??1),limit=Number(process.argv[3]??200);let max=0;
 if(['beam','stars3','stars2'].includes(process.argv[4])){
  for(let seed=0;seed<limit;seed++){
   const mode=process.argv[4],r=beamRoute(number,seed,mode==='beam'?24:80,mode==='stars3'?5:mode==='stars2'?9:320);if(r)max=Math.max(max,r.state.cleared);
   if(r?.state.terminal==='won'){fs.mkdirSync('artifacts/followup-routes',{recursive:true});fs.writeFileSync(`artifacts/followup-routes/${mode==='beam'?'level'+number:mode}.json`,JSON.stringify(r));console.log(`Beam level ${number} seed ${seed}: ${r.state.cleared}, ${r.actions.length} moves`);process.exit(0);}
  }
  console.log(`Beam no victory, max ${max}`);process.exit(1);
 }
 for(let seed=0;seed<limit;seed++)for(const weight of [8,16,28,48,80]){
  const r=searchRoute(number,seed,weight);max=Math.max(max,r.state.cleared);
  if(r.state.terminal==='won'){fs.mkdirSync('artifacts/followup-routes',{recursive:true});fs.writeFileSync(`artifacts/followup-routes/level${number}.json`,JSON.stringify(r));console.log(`Level ${number} seed ${seed}: ${r.state.cleared} in ${r.actions.length} moves`);process.exit(0);}
 }
 console.log(`No witness for level ${number} in ${limit} seeds, maximum collected ${max}`);process.exitCode=1;
}
