import { cellId, offsetToAxial, axialToOffset } from '../game/hex.js';
import { canPlaceMagnet, topColor } from './model.js';

const directions = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
// Pure dry resolve shared by the preview and active v4 rules. No random draws.
export function resolveMagnetInfluence(state, action) {
  if (!canPlaceMagnet(state, action.cell)) return null;
  const next={...state,stacks:state.stacks.map(s=>({cell:{...s.cell},units:s.units.map(u=>({...u}))}))}, target=action.cell, targetId=cellId(target);
  const board=new Set(state.cells.map(cellId)),blocked=new Set(state.blockers.map(cellId));
  const origin=offsetToAxial(target), rays=directions.map(([q,r])=>{
    const cells=[];
    for(let i=1;i<=2;i++){
      const c=axialToOffset({q:origin.q+q*i,r:origin.r+r*i});
      if(!c||!board.has(cellId(c))||blocked.has(cellId(c)))break;
      cells.push(c);
    }
    return cells;
  });
  const events=[],sources=[],paths=[],affected=new Map(),sourceIds=new Set(),original=new Set(state.stacks.map(s=>cellId(s.cell)));let batch=0;
  const stackAt=cell=>next.stacks.find(s=>cellId(s.cell)===cellId(cell));
  while(true){
    const candidates=[];
    for(const ray of rays)for(let i=0;i<ray.length;i++){
      const s=stackAt(ray[i]);
      if(s&&topColor(s)!==action.color)break;
      if(s){candidates.push({s,distance:i+1,path:[...ray.slice(0,i+1)].reverse().concat([target])});break;}
    }
    candidates.sort((a,b)=>a.distance-b.distance||a.s.cell.row-b.s.cell.row||a.s.cell.col-b.s.cell.col);
    const candidate=candidates[0];if(!candidate)break;
    const {s,path}=candidate;
    if(original.has(cellId(s.cell))&&!sourceIds.has(cellId(s.cell))){sources.push({...s.cell});sourceIds.add(cellId(s.cell));}
    paths.push(path.map(c=>({...c})));
    for(const c of path)if(cellId(c)!==targetId)affected.set(cellId(c),{...c});
    // Complete each edge group before the next; compatible units on the next
    // intermediate tile are then pulled as a group, preserving identity/order.
    const to=path[1];let destination=stackAt(to);
    if(!destination){destination={cell:{...to},units:[]};next.stacks.push(destination);}
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
    next.stacks=next.stacks.filter(s=>s.units.length);
  }
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
