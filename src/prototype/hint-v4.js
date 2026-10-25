import { canPlaceMagnet, COLORS } from './model.js';
import { resolveMagnetInfluence } from './magnet-influence.js';
import { forecastText } from './spawn-forecast.js';

// Evaluate only the visible board. The dry resolver never draws gameplay RNG,
// spawns stacks or changes the queue; tray order and row/column break ties.
export function findV4Hint(state) {
  if (state.terminal) return null;
  const cells = state.cells.filter(cell => canPlaceMagnet(state, cell))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  let best = null;
  for (const color of state.magnets) for (const cell of cells) {
    const plan = resolveMagnetInfluence(state, { color, cell });
    const candidate = { color, cell: { ...cell }, clearedDelta: plan.state.cleared - state.cleared,
      freeDelta: plan.state.cells.filter(c => canPlaceMagnet(plan.state, c)).length - cells.length,
      movedCount: plan.events.filter(event => event.type === 'unitMoved').length };
    if (!best || candidate.clearedDelta > best.clearedDelta ||
      (candidate.clearedDelta === best.clearedDelta && candidate.freeDelta > best.freeDelta) ||
      (candidate.clearedDelta === best.clearedDelta && candidate.freeDelta === best.freeDelta && candidate.movedCount > best.movedCount)) best = candidate;
  }
  return best?.movedCount ? best : null;
}

export function hintText(hint, upcoming) {
  if (!hint) return 'Hint: No pulls right now. ' + (forecastText(upcoming) || 'Check again after the board changes') + '.';
  const color = COLORS[hint.color].label;
  if (hint.clearedDelta) return `Hint: ${color} can collect ${hint.clearedDelta} pieces${hint.freeDelta > 0 ? ` and free ${hint.freeDelta} tile${hint.freeDelta === 1 ? '' : 's'}` : ''} before new stacks.`;
  return `Hint: ${color} can move ${hint.movedCount} piece${hint.movedCount === 1 ? '' : 's'}${hint.freeDelta > 0 ? ` and free ${hint.freeDelta} tile${hint.freeDelta === 1 ? '' : 's'}` : ''} before new stacks.`;
}
