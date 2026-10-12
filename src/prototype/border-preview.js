import {hexDistance,cellId} from '../game/hex.js';
import {canPlaceMagnet} from './model.js';

export function previewBorderRings(state,cell,color){
  if(!cell||state.terminal||!state.magnets.includes(color)||!canPlaceMagnet(state,cell))return null;
  const rings=[[],[]];
  for(const candidate of state.cells){const distance=hexDistance(cell,candidate);if(distance===1||distance===2)rings[distance-1].push({...candidate});}
  return {magnet:{cell:{...cell},color},rings,key:cellId(cell)+':'+color};
}
export function sampleBorderPulse(seconds,reduced=false){
  if(reduced)return [.45,.45];
  const phase=((Math.max(0,seconds)%2.4)/1.2),ring=Math.floor(phase),strength=Math.sin((phase-ring)*Math.PI)**2;
  return ring===0?[strength,0]:[0,strength];
}
