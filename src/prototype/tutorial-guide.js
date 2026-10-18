import { canPlaceMagnet } from './model.js';
import { previewMagnetInfluence } from './magnet-influence.js';

// Choose an effective, legal first placement without consuming gameplay RNG.
export function tutorialPlacement(state, color) {
  if (state.terminal || !state.magnets.includes(color)) return null;
  let best = null, bestScore = -Infinity;
  for (const cell of state.cells) {
    if (!canPlaceMagnet(state, cell)) continue;
    const sources = previewMagnetInfluence(state, cell, color)?.sources.length ?? 0;
    const score = sources * 100 - Math.hypot(cell.col - 3, cell.row - 3);
    if (score > bestScore) { best = cell; bestScore = score; }
  }
  return best ? { ...best } : null;
}

export function tutorialCurve(start, end) {
  const control = { x: start.x + (end.x - start.x) * .55 + Math.min(38, Math.abs(end.y - start.y) * .12), y: start.y + (end.y - start.y) * .38 };
  return { start, end, control, path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}` };
}
export function tutorialPoint({ start, control, end }, progress) {
  const p = Math.max(0, Math.min(1, progress)), a = 1 - p;
  return { x: a * a * start.x + 2 * a * p * control.x + p * p * end.x, y: a * a * start.y + 2 * a * p * control.y + p * p * end.y };
}
export function tutorialDragFrames(curve, scale) {
  return [[0,0,0],[.06,0,1],[.18,0,1],[.3,.14,1],[.42,.39,1],[.54,.72,1],[.66,1,1],[.78,1,1],[.86,1,0],[.87,0,0],[1,0,0]].map(([offset, progress, opacity]) => {
    const point = tutorialPoint(curve, progress);
    return { offset, opacity, transform: `translate3d(${point.x}px,${point.y}px,0) scale(${1 + (scale - 1) * progress})` };
  });
}
