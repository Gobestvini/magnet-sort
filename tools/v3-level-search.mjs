import { performance } from 'node:perf_hooks';
import { createPrototypeState, applyMagnet, canPlaceMagnet } from '../src/prototype/model.js';

// IDs do not affect routing, legal moves or wins. Ordered colours DO affect
// routing, so retain every layer, cell, blocker, magnet and remaining move.
export function searchKey(s) {
  return JSON.stringify([s.remainingMoves,s.clearSize,s.magnets,s.cells,s.blockers,
    s.stacks.map(t=>[t.cell,t.units.map(u=>u.color)])]);
}
export function actions(s) {
  return s.cells.filter(c=>canPlaceMagnet(s,c)).flatMap(cell=>s.magnets.map(color=>({type:'placeMagnet',color,cell})));
}
export function createSearch({maxStates=200000}={}) {
  const memo=new Map();let visited=0;
  function solve(state) {
    if(state.terminal==='won') return {min:0,paths:[[]]};
    if(state.terminal==='lost') return {min:Infinity,paths:[]};
    const key=searchKey(state);if(memo.has(key)) return memo.get(key);
    if(++visited>maxStates) throw new Error(`Search unknown: budget ${maxStates} exceeded`);
    const result={min:Infinity,paths:[]};
    // A placement can only clear its own colour. Fewer moves than colours is
    // an exact impossibility bound, not a difficulty heuristic.
    const colours=new Set(state.stacks.flatMap(t=>t.units.map(u=>u.color)));
    if(colours.size<=state.remainingMoves) for(const action of actions(state)) {
      const child=solve(applyMagnet(state,action).state);
      result.min=Math.min(result.min,child.min+1);
      if(result.paths.length<3) for(const path of child.paths) {
        result.paths.push([action,...path]);if(result.paths.length===3)break;
      }
    }
    memo.set(key,result);return result;
  }
  return {solve,stats:()=>({visited,memo:memo.size})};
}
export function analyzeLevel(level,options) {
  const start=performance.now(),initial=createPrototypeState(level),search=createSearch(options);
  const outcome=search.solve(initial),first=[];
  for(const action of actions(initial)) {
    const resolution=applyMagnet(initial,action);
    if(!resolution.events.some(e=>e.type==='unitMoved'))continue;
    const solved=search.solve(resolution.state);
    first.push({action,won:solved.paths.length>0,min:solved.min,paths:solved.paths,
      signature:JSON.stringify(resolution.events.filter(e=>e.type==='unitMoved').map(e=>[e.from,e.to]))});
  }
  const winning=first.filter(f=>f.won),bad=first.find(f=>!f.won);
  // Different neighbour-to-neighbour routes, not merely permutations of
  // independent colours. Same-colour first placements use different cells.
  const pair=winning.flatMap((a,i)=>winning.slice(i+1).filter(b=>a.action.color===b.action.color && a.signature!==b.signature).map(b=>[a,b]))[0];
  const witnesses=pair ? pair.map(f=>[f.action,...f.paths[0]]) : [];
  for(const f of winning)for(const path of f.paths) {
    const candidate=[f.action,...path];
    if(witnesses.length<3&&!witnesses.some(p=>JSON.stringify(p)===JSON.stringify(candidate)))witnesses.push(candidate);
  }
  return {min:outcome.min,witnesses,winningFirst:winning.length,usefulFirst:first.length,
    losingFirst:first.filter(f=>!f.won).length,
    branch:bad&&winning.length?{prefix:[],good:winning[0].action,bad:bad.action,badResult:'unsolvable'}:null,
    differentRoutes:Boolean(pair),...search.stats(),milliseconds:Math.round(performance.now()-start)};
}
