import { cellId, hexDistance } from '../game/hex.js';
import { canPlaceMagnet, topColor } from './model.js';

import { magnetRadius } from './magnet-radius.js';

const compare=(a,b)=>a.row-b.row||a.col-b.col;
// Pure dry resolve shared by the preview and active v4 rules. No random draws.
export function resolveMagnetInfluence(state, action) {
  if (!canPlaceMagnet(state, action.cell)) return null;
  const next={...state,stacks:state.stacks.map(s=>({cell:{...s.cell},units:s.units.map(u=>({...u}))}))}, target=action.cell;
  const radius=magnetRadius(state,action.color);
  const blocked=new Set(state.blockers.map(cellId));
  const ringCells=state.cells.filter(c=>!blocked.has(cellId(c))&&hexDistance(target,c)>=1&&hexDistance(target,c)<=radius)
    .sort((a,b)=>hexDistance(target,a)-hexDistance(target,b)||compare(a,b));
  const events=[],sources=[],paths=[];let batch=0;
  // Recover impossible imported/debug states before any transfer. Every ID is
  // presented by the same collection pipeline, including mixed-color overflow.
  for(const stack of next.stacks)if(stack.units.length>10){
    const units=stack.units.splice(0);next.cleared+=units.length;
    events.push({type:'unitsCleared',batch:++batch,cell:{...stack.cell},units});
  }
  const stackMap=new Map(next.stacks.filter(s=>s.units.length).map(s=>[cellId(s.cell),s]));
  const stackAt=cell=>stackMap.get(cellId(cell));
  for(const cell of ringCells){
    const s=stackAt(cell);if(!s||topColor(s)!==action.color)continue;
    sources.push({...cell});paths.push([{...cell},{...target}]);
    // Every exposed matching unit flies straight to the magnet. Intervening
    // blockers/foreign tops never participate in, or obstruct, this transfer.
    const to=target;let destination=stackAt(to);
    if(!destination){destination={cell:{...to},units:[]};next.stacks.push(destination);stackMap.set(cellId(to),destination);}
    batch++;
    while(topColor(s)===action.color){
      const fromIndex=s.units.length-1,unit=s.units.pop(),toIndex=destination.units.length;
      destination.units.push(unit);
      events.push({type:'unitMoved',batch,unit:{...unit},from:{...s.cell},to:{...to},fromIndex,toIndex});
      if(destination.units.length>=next.clearSize){
        const units=destination.units.splice(0);next.cleared+=units.length;
        events.push({type:'unitsCleared',batch,cell:{...to},units});batch++;
      }
    }
    if(!s.units.length)stackMap.delete(cellId(s.cell));
    // Keep the empty target object available to later sources after a clear.
  }
  next.stacks=next.stacks.filter(s=>s.units.length);
  next.stacks.sort((a,b)=>a.cell.row-b.cell.row||a.cell.col-b.cell.col);
  return {state:next,events,magnet:{cell:{...target},color:action.color,radius},sources,paths,affectedCells:sources.map(c=>({...c}))};
}

export function previewMagnetInfluence(state, cell, color) {
  if(!cell||!color||!state.magnets.includes(color)||state.terminal)return null;
  const plan=resolveMagnetInfluence(state,{cell,color});
  return plan&&{magnet:plan.magnet,sources:plan.sources,paths:plan.paths,affectedCells:plan.affectedCells};
}

export function sampleInfluenceArc(from,to,progress) {
  const p=Math.max(0,Math.min(1,progress));
  return {x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p+4*p*(1-p)*1.1,z:from.z+(to.z-from.z)*p};
}
