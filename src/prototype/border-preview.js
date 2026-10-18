import {hexDistance,cellId} from '../game/hex.js';
import {canPlaceMagnet} from './model.js';
import {previewMagnetInfluence} from './magnet-influence.js';
import {magnetRadius} from './magnet-radius.js';

export function previewBorderRings(state,cell,color){
  if(!cell||state.terminal||!state.magnets.includes(color)||!canPlaceMagnet(state,cell))return null;
  const radius=magnetRadius(state,color),rings=Array.from({length:radius},()=>[]);
  for(const candidate of state.cells){const distance=hexDistance(cell,candidate);if(distance>=1&&distance<=radius)rings[distance-1].push({...candidate});}
  const plan=previewMagnetInfluence(state,cell,color);
  return {...plan,rings,key:cellId(cell)+':'+color+':'+radius};
}
export const BORDER_WAVE_DURATION = 2.4;
export const BORDER_WAVE_REACH = 3.4;
export const BORDER_WAVE_WIDTH = .16;
// Original inward waves intersect only the retained upper-rim masks.
export function sampleBorderWaves(seconds,reduced=false){
  if(reduced)return [];
  return Array.from({length:3},(_,i)=>{
    const phase=(Math.max(0,seconds)/BORDER_WAVE_DURATION+i/3)%1;
    return {radius:BORDER_WAVE_REACH*(1-phase),opacity:Math.min(1,phase/.08,(1-phase)/.08)};
  });
}
