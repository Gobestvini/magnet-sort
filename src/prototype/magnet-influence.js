import { cellId, neighborCells, hexDistance } from '../game/hex.js';
import { canPlaceMagnet, topColor } from './model.js';

const compare=(a,b)=>a.row-b.row||a.col-b.col;
// Pure dry resolve shared by the preview and active v4 rules. No random draws.
export function resolveMagnetInfluence(state, action) {
  if (!canPlaceMagnet(state, action.cell)) return null;
  const next={...state,stacks:state.stacks.map(s=>({cell:{...s.cell},units:s.units.map(u=>({...u}))}))}, target=action.cell, targetId=cellId(target);
  const board=new Set(state.cells.map(cellId)),blocked=new Set(state.blockers.map(cellId));
  const ringCells=state.cells.filter(c=>!blocked.has(cellId(c))&&hexDistance(target,c)>=1&&hexDistance(target,c)<=2)
    .sort((a,b)=>hexDistance(target,a)-hexDistance(target,b)||compare(a,b));
  const routes=ringCells.map(cell=>({cell,distance:hexDistance(target,cell),intermediates:
    neighborCells(cell).filter(c=>board.has(cellId(c))&&!blocked.has(cellId(c))&&hexDistance(target,c)===1).sort(compare)}));
  const events=[],sources=[],paths=[],affected=new Map(),sourceIds=new Set(),original=new Set(state.stacks.map(s=>cellId(s.cell)));let batch=0;
  const stackMap=new Map(next.stacks.map(s=>[cellId(s.cell),s]));
  const stackAt=cell=>stackMap.get(cellId(cell));
  while(true){
    let candidate=null;
    for(const {cell,distance,intermediates} of routes){
      const s=stackAt(cell);if(!s||topColor(s)!==action.color)continue;
      if(distance===1){candidate={s,path:[cell,target]};break;}
      const intermediate=intermediates.find(c=>!stackAt(c)||topColor(stackAt(c))===action.color);
      if(intermediate){candidate={s,path:[cell,intermediate,target]};break;}
    }
    if(!candidate)break;
    const {s,path}=candidate;
    if(original.has(cellId(s.cell))&&!sourceIds.has(cellId(s.cell))){sources.push({...s.cell});sourceIds.add(cellId(s.cell));}
    paths.push(path.map(c=>({...c})));
    for(const c of path)if(cellId(c)!==targetId)affected.set(cellId(c),{...c});
    // Complete each edge group before the next; compatible units on the next
    // intermediate tile are then pulled as a group, preserving identity/order.
    const to=path[1];let destination=stackAt(to);
    if(!destination){destination={cell:{...to},units:[]};next.stacks.push(destination);stackMap.set(cellId(to),destination);}
    batch++;
    while(topColor(s)===action.color){
      const fromIndex=s.units.length-1,unit=s.units.pop(),toIndex=destination.units.length;
      destination.units.push(unit);
      events.push({type:'unitMoved',batch,unit:{...unit},from:{...s.cell},to:{...to},fromIndex,toIndex});
      if(cellId(to)===targetId&&destination.units.length===next.clearSize){
        const units=destination.units.splice(0);next.cleared+=units.length;
        events.push({type:'unitsCleared',batch,cell:{...to},units});batch++;
      }
    }
    if(!s.units.length)stackMap.delete(cellId(s.cell));
    if(!destination.units.length)stackMap.delete(cellId(to));
  }
  next.stacks=next.stacks.filter(s=>s.units.length);
  next.stacks.sort((a,b)=>a.cell.row-b.cell.row||a.cell.col-b.cell.col);
  return {state:next,events,magnet:{cell:{...target},color:action.color},sources,paths,affectedCells:[...affected.values()]};
}

export function previewMagnetInfluence(state, cell, color) {
  if(!cell||!color||!state.magnets.includes(color)||state.terminal)return null;
  const plan=resolveMagnetInfluence(state,{cell,color});
  return plan&&{magnet:plan.magnet,sources:plan.sources,paths:plan.paths,affectedCells:plan.affectedCells};
}

export function sampleInfluenceArc(from,to,progress) {
  const p=Math.max(0,Math.min(1,progress));
  return {x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p+4*p*(1-p)*.65,z:from.z+(to.z-from.z)*p};
}
