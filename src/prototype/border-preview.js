import {hexDistance,cellId} from '../game/hex.js';
import {canPlaceMagnet} from './model.js';

export function previewBorderRings(state,cell,color){
  if(!cell||state.terminal||!state.magnets.includes(color)||!canPlaceMagnet(state,cell))return null;
  const rings=[[],[]];
  for(const candidate of state.cells){const distance=hexDistance(cell,candidate);if(distance===1||distance===2)rings[distance-1].push({...candidate});}
  return {magnet:{cell:{...cell},color},rings,key:cellId(cell)+':'+color};
}
export const BORDER_WAVE_DURATION = 2.4;
export const BORDER_WAVE_REACH = 3.4;
export const BORDER_WAVE_WIDTH = .16;
// World-space radii; each wrap occurs beyond the masked area with zero alpha.
export function sampleBorderWaves(seconds,reduced=false){
  if(reduced)return [];
  return Array.from({length:3},(_,i)=>{
    const phase=(Math.max(0,seconds)/BORDER_WAVE_DURATION+i/3)%1;
    return {radius:BORDER_WAVE_REACH*(1-phase),opacity:Math.min(1,phase/.08,(1-phase)/.08)};
  });
}
