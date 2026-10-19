import { cellId, neighborCells } from '../game/hex.js';
import { COLORS, canPlaceMagnet, topColor } from './model.js';
import { resolveMagnetInfluence } from './magnet-influence.js';
import { levelPalette, levelGroupCounts, spawnInterval } from './difficulty.js';

export const V4_CONFIG = Object.freeze({ initialStacks: 5, maxStacksPerTurn: 3, minHeight: 6, maxHeight: 10, heightStep: 4, clearSize: 10 });
export function stacksForMove(movesUsed, levelNumber=1) {
  return countStacksForMove(movesUsed, levelNumber, spawnInterval(levelNumber));
}
function countStacksForMove(movesUsed, levelNumber, interval) {
  const span=5*levelNumber*levelNumber;
  if(movesUsed%interval!==0)return 0;
  return movesUsed<=span?1:movesUsed<=2*span?2:V4_CONFIG.maxStacksPerTurn;
}
export const V4_CELLS = Object.freeze(Array.from({ length: 25 }, (_, i) => Object.freeze({ col: i % 5 + 1, row: Math.floor(i / 5) + 1 })));
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
  if(existing.length>3||new Set(existing).size!==existing.length||existing.some(c=>!COLORS[c]))throw new Error('Invalid magnet queue');
  const palette=levelPalette(state.levelNumber);
  const tops=new Set(state.stacks.map(topColor).filter(Boolean));
  // Empty boards still need placements to reach the next scheduled spawn.
  const colors=state.stacks.length?palette.filter(c=>tops.has(c)):palette;
  const queue=existing.filter(c=>colors.includes(c));
  while(queue.length<Math.min(3,colors.length)){
    const available=colors.filter(c=>!queue.includes(c));
    queue.push(available[drawIndex(state,available.length)]);
  }
  return queue;
}
function fillMagnetRadii(state,retained=[]) {
  return Object.fromEntries(state.magnets.map(color=>[color,
    retained.includes(color)&&[1,2].includes(state.magnetRadii?.[color])
      ?state.magnetRadii[color]:1+drawIndex(state,2)]));
}
export function potentialStars(goal, movesUsed) {
  return movesUsed<=Math.ceil(goal/12)?3:movesUsed<=Math.ceil(goal/6)?2:1;
}
export function earnedStars(goal, movesUsed, terminal) {
  return terminal==='won'?potentialStars(goal,movesUsed):0;
}
export function spawnStacks(state, requested, openingGroups=[]) {
  const free=state.cells.filter(c=>canPlaceMagnet(state,c)).sort(compare);
  const count=Math.min(requested,free.length), events=[];
  for(let i=0;i<count;i++){
    const cell=free.splice(drawIndex(state,free.length),1)[0];
    const height=V4_CONFIG.minHeight+V4_CONFIG.heightStep*drawIndex(state,2);
    const counts=levelGroupCounts(state.levelNumber,height);
    const groupCount=openingGroups[i]??(counts.length===1?counts[0]:counts[drawIndex(state,counts.length)]), available=levelPalette(state.levelNumber), groupColors=[];
    for(let group=0;group<groupCount;group++)groupColors.push(available.splice(drawIndex(state,available.length),1)[0]);
    const units=Array.from({length:height},(_,i)=>({id:'v4-u'+state.nextUnitId++,color:groupColors[Math.floor(i/(height/groupCount))]}));
    state.stacks.push({cell:{...cell},units});state.spawnedUnits+=height;
    events.push({type:'stackSpawned',cell:{...cell},units:units.map(u=>({...u}))});
  }
  state.stacks.sort((a,b)=>compare(a.cell,b.cell));
  return events;
}
function createState(level, seed, goal) {
  validateV4Level(level);
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid uint32 seed');
  const state={rulesVersion:4,puzzleId:level.id,levelNumber:level.number,cells:V4_CELLS.map(c=>({...c})),
    blockers:level.blockers.map(c=>({...c})),stacks:[],magnets:[],clearSize:V4_CONFIG.clearSize,
    goal:goal??50*level.number,cleared:0,movesUsed:0,turn:0,spawnedUnits:0,nextUnitId:1,rng:seed,seed,terminal:null,stars:0};
  // Distinct seeded locations guarantee a visibly varied early opening,
  // without re-rolling boards or changing the later spawn distribution.
  spawnStacks(state,V4_CONFIG.initialStacks,level.number<=3?[1,2]:[]);
  state.magnets=fillMagnetQueue(state);
  state.magnetRadii=fillMagnetRadii(state);
  return state;
}
function applyMagnet(state, action, interval) {
  const reject=reason=>({accepted:false,reason,state,events:[]});
  if(state.terminal)return reject('terminal');
  if(action?.type!=='placeMagnet'||!state.magnets.includes(action.color))return reject('invalid-magnet');
  if(!canPlaceMagnet(state,action.cell))return reject('occupied-or-outside');
  const resolution=resolveMagnetInfluence(state,action);
  const next={...state};
  next.stacks=resolution.state.stacks;next.cleared=resolution.state.cleared;next.movesUsed++;next.turn++;
  const events=[...resolution.events];
  const retained=next.magnets.filter(c=>c!==action.color);
  if(next.cleared>=next.goal){
    next.terminal='won';next.stars=earnedStars(next.goal,next.movesUsed,'won');next.magnets=retained;
    next.magnetRadii=Object.fromEntries(retained.map(c=>[c,state.magnetRadii?.[c]??2]));
  }else{
    events.push(...spawnStacks(next,countStacksForMove(next.movesUsed,next.levelNumber,interval??spawnInterval(next.levelNumber))));
    next.magnets=fillMagnetQueue(next,retained);
    next.magnetRadii=fillMagnetRadii(next,retained);
    events.push({type:'magnetsChanged',before:[...state.magnets],after:[...next.magnets],used:action.color});
    if(!next.cells.some(c=>canPlaceMagnet(next,c)))next.terminal='lost';
  }
  return {accepted:true,state:next,events,magnet:resolution.magnet,influence:{magnet:resolution.magnet,affectedCells:resolution.affectedCells,paths:resolution.paths,sources:resolution.sources}};
}

export function createV4State(level, seed) { return createState(level, seed); }
export function applyV4Magnet(state, action) { return applyMagnet(state, action); }

// Explicit experiment seam: the production entry always uses the two defaults
// above. No profile is serialized into v4 saves or changes its content version.
export function createV4Rules({ goals, spawnIntervals }) {
  if (!Array.isArray(goals) || goals.length !== 12 || goals.some(n => !Number.isInteger(n) || n < 1 || n > 1000000) ||
      !Array.isArray(spawnIntervals) || spawnIntervals.length !== 12 || spawnIntervals.some(n => !Number.isInteger(n) || n < 1 || n > 3))
    throw new TypeError('Invalid experiment profile');
  const targets = [...goals], intervals = [...spawnIntervals];
  return Object.freeze({
    createV4State: (level, seed) => createState(level, seed, targets[level?.number - 1]),
    applyV4Magnet: (state, action) => applyMagnet(state, action, intervals[state.levelNumber - 1]),
    stacksForMove: (moves, number) => countStacksForMove(moves, number, intervals[number - 1]),
    spawnInterval: number => intervals[number - 1]
  });
}

