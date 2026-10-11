import {cellId} from '../../../../src/game/hex.js';
import {sampleTransferTimeline} from '../../../../src/prototype/motion.js';
export function topRunCount(units) {const c=units.at(-1)?.color;let n=0;for(let i=units.length-1;i>=0&&units[i].color===c;i--)n++;return n;}
export function presentation(timeline,time) {
 const sampled=sampleTransferTimeline(timeline,time),clearing=new Set(sampled.units.filter(p=>p.collecting).map(p=>p.id)),cleared=new Set();
 for(const s of timeline.segments)if(s.type==='unitsCleared')for(const flight of s.flights)if(time>=flight.end)cleared.add(flight.unit.id);
 const resting=sampled.units.filter(p=>!p.from&&!clearing.has(p.id)),flying=sampled.units.filter(p=>p.from&&!clearing.has(p.id));
 const stacks=new Map();
 for(const p of resting){const key=cellId(p.cell);if(!stacks.has(key))stacks.set(key,{cell:p.cell,units:[]});stacks.get(key).units.push(p);}
 for(const s of stacks.values())s.units.sort((a,b)=>a.index-b.index);
 return {...sampled,stacks:[...stacks.values()],phases:{resting:resting.map(p=>p.id),flying:flying.map(p=>p.id),clearing:[...clearing],cleared:[...cleared]}};
}
