import { cellId, neighborCells } from '../game/hex.js';
import { COLORS, applyMagnet as resolveV3, canPlaceMagnet, remainingUnits } from './model.js';

export const V4_CONFIG = Object.freeze({ initialStacks: 7, stacksPerTurn: 2, minHeight: 6, maxHeight: 12, heightStep: 6, clearSize: 6 });
export const V4_CELLS = Object.freeze(Array.from({ length: 25 }, (_, i) => Object.freeze({ col: i % 5 + 1, row: Math.floor(i / 5) + 1 })));
const colors = Object.keys(COLORS);
const compare = (a,b) => a.row-b.row || a.col-b.col;

export function validateV4Level(level) {
  if (!level || typeof level.id !== 'string' || !level.id || !Number.isInteger(level.number) || level.number<1 || level.number>12
    || Object.keys(level).some(k=>!['id','number','blockers'].includes(k)) || !Array.isArray(level.blockers)
    || level.blockers.length<1 || level.blockers.length>4) throw new Error('Invalid v4 level');
  const ids = new Set(V4_CELLS.map(cellId)), blocked = new Set();
  for (const cell of level.blockers) {
    const id=cellId(cell);
    if (!Number.isInteger(cell.col)||!Number.isInteger(cell.row)||!ids.has(id)||blocked.has(id)) throw new Error('Invalid v4 blocker');
    blocked.add(id);
  }
  const free=V4_CELLS.filter(c=>!blocked.has(cellId(c)));
  const seen=new Set([cellId(free[0])]), queue=[free[0]];
  for(let i=0;i<queue.length;i++)for(const next of neighborCells(queue[i])){
    const id=cellId(next);if(ids.has(id)&&!blocked.has(id)&&!seen.has(id)){seen.add(id);queue.push(next);}
  }
  if(seen.size!==free.length)throw new Error('Disconnected v4 board');
  return level;
}

// State owns every random draw. 0 is a valid reproducible seed.
export function drawIndex(state, count) {
  if (!Number.isInteger(count)||count<1)throw new Error('Empty random choice');
  state.rng=(Math.imul(1664525,state.rng)+1013904223)>>>0;
  return Math.floor(state.rng/4294967296*count);
}
export function fillMagnetQueue(state, existing=[]) {
  const queue=[...existing];
  if(queue.length>3||new Set(queue).size!==queue.length||queue.some(c=>!COLORS[c]))throw new Error('Invalid magnet queue');
  while(queue.length<3){
    const available=colors.filter(c=>!queue.includes(c));
    queue.push(available[drawIndex(state,available.length)]);
  }
  return queue;
}
export function earnedStars(goal, movesUsed, terminal) {
  if(terminal!=='won')return 0;
  return movesUsed<=Math.ceil(goal/12)?3:movesUsed<=Math.ceil(goal/6)?2:1;
}
export function spawnStacks(state, requested) {
  const free=state.cells.filter(c=>canPlaceMagnet(state,c)).sort(compare);
  const count=Math.min(requested,Math.max(0,free.length-1)), events=[];
  for(let i=0;i<count;i++){
    const cell=free.splice(drawIndex(state,free.length),1)[0];
    const height=V4_CONFIG.minHeight+V4_CONFIG.heightStep*drawIndex(state,2);
    const color=colors[drawIndex(state,colors.length)];
    const units=Array.from({length:height},()=>({id:'v4-u'+state.nextUnitId++,color}));
    state.stacks.push({cell:{...cell},units});state.spawnedUnits+=height;
    events.push({type:'stackSpawned',cell:{...cell},units:structuredClone(units)});
  }
  state.stacks.sort((a,b)=>compare(a.cell,b.cell));
  return events;
}
export function createV4State(level, seed) {
  validateV4Level(level);
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid uint32 seed');
  const state={rulesVersion:4,puzzleId:level.id,levelNumber:level.number,cells:structuredClone(V4_CELLS),
    blockers:structuredClone(level.blockers),stacks:[],magnets:[],clearSize:V4_CONFIG.clearSize,
    goal:100*level.number,cleared:0,movesUsed:0,turn:0,spawnedUnits:0,nextUnitId:1,rng:seed,seed,terminal:null,stars:0};
  state.magnets=fillMagnetQueue(state);
  spawnStacks(state,V4_CONFIG.initialStacks);
  return state;
}
export function applyV4Magnet(state, action) {
  const reject=reason=>({accepted:false,reason,state,events:[]});
  if(state.terminal)return reject('terminal');
  if(action?.type!=='placeMagnet'||!state.magnets.includes(action.color))return reject('invalid-magnet');
  if(!canPlaceMagnet(state,action.cell))return reject('occupied-or-outside');
  // Reuse the proven adjacent routing kernel, with the CURRENT mass as its bound.
  // v3 terminal/limited-move semantics do not leave this bridge.
  const resolution=resolveV3({...state,remainingMoves:Number.MAX_SAFE_INTEGER,initialUnits:remainingUnits(state)},action);
  if(!resolution.accepted)throw new Error('V4 validated action rejected by routing kernel');
  const next=structuredClone(state);
  next.stacks=resolution.state.stacks;next.cleared=resolution.state.cleared;next.movesUsed++;next.turn++;
  const events=[...resolution.events];
  const retained=next.magnets.filter(c=>c!==action.color);
  if(next.cleared>=next.goal){
    next.terminal='won';next.stars=earnedStars(next.goal,next.movesUsed,'won');next.magnets=retained;
  }else{
    events.push(...spawnStacks(next,V4_CONFIG.stacksPerTurn));
    next.magnets=fillMagnetQueue(next,retained);
    events.push({type:'magnetsChanged',before:[...state.magnets],after:[...next.magnets],used:action.color});
    if(!next.cells.some(c=>canPlaceMagnet(next,c)))next.terminal='lost';
  }
  return {accepted:true,state:next,events,magnet:{cell:{...action.cell},color:action.color}};
}

