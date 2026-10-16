import {hexDistance,cellId} from '../game/hex.js';
import {canPlaceMagnet} from './model.js';

export function previewBorderRings(state,cell,color){
  if(!cell||state.terminal||!state.magnets.includes(color)||!canPlaceMagnet(state,cell))return null;
  const rings=[[],[]];
  const blocked=new Set(state.blockers.map(cellId));
  for(const candidate of state.cells){const distance=hexDistance(cell,candidate);if((distance===1||distance===2)&&!blocked.has(cellId(candidate)))rings[distance-1].push({...candidate});}
  return {magnet:{cell:{...cell},color},rings,key:cellId(cell)+':'+color};
}
