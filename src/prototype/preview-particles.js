// Stateless visual variation: independent from the game's seeded RNG and FPS.
const noise = value => {
  let n = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
export function samplePreviewParticle(cell,index,seconds,from,to) {
  const seed=Math.imul(cell.row+17,73856093)^Math.imul(cell.col+31,19349663)^Math.imul(index+1,83492791);
  const duration=1.05+noise(seed)*.8;
  const clock=Math.max(0,seconds)/duration+noise(seed+1);
  const cycle=Math.floor(clock),progress=clock-cycle;
  const variation=seed^Math.imul(cycle+1,2654435761);
  const height=.75+noise(variation+2)*.8,bend=(noise(variation+3)-.5)*.7;
  const envelope=4*progress*(1-progress);
  const dx=to.x-from.x,dz=to.z-from.z,distance=Math.hypot(dx,dz)||1;
  return {progress,duration,height,bend,size:.7+noise(seed+4)*.35,
    position:{x:from.x+dx*progress-dz/distance*bend*envelope,
      y:from.y+(to.y-from.y)*progress+height*envelope,
      z:from.z+dz*progress+dx/distance*bend*envelope}};
}
