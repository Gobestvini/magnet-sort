import { cellId, isCell, neighborCells } from '../game/hex.js';

export const COLORS = Object.freeze({
  violet: { label: 'Violet', hex: '#7800e8' },
  blue: { label: 'Blue', hex: '#0087f5' },
  coral: { label: 'Coral', hex: '#ff542b' },
});
const copy = (value) => structuredClone(value);
const compareCells = (a, b) => a.row - b.row || a.col - b.col;
export const topColor = (stack) => stack?.units.at(-1)?.color ?? null;
export const remainingUnits = (state) => state.stacks.reduce((sum, stack) => sum + stack.units.length, 0);

export function createPrototypeState(level) {
  if (level.rulesVersion !== 3 || !Number.isInteger(level.moves) || level.moves < 1
    || !Number.isInteger(level.clearSize) || level.clearSize < 2) throw new Error('Invalid rules v3 level');
  const cells = new Set();
  for (const cell of level.cells) {
    if (!isCell(cell) || cells.has(cellId(cell))) throw new Error('Invalid board cell');
    cells.add(cellId(cell));
  }
  const blockers = new Set();
  for (const cell of level.blockers) {
    const id = cellId(cell);
    if (!cells.has(id) || blockers.has(id)) throw new Error('Invalid blocker');
    blockers.add(id);
  }
  const occupied = new Set();
  const units = new Set();
  for (const stack of level.stacks) {
    const id = cellId(stack.cell);
    if (!cells.has(id) || blockers.has(id) || occupied.has(id) || !stack.units.length) throw new Error('Invalid stack');
    occupied.add(id);
    for (const unit of stack.units) {
      if (!unit.id || units.has(unit.id) || !COLORS[unit.color]) throw new Error('Invalid unit');
      units.add(unit.id);
    }
  }
  if (!units.size || !level.magnets.length || level.magnets.some(color => !COLORS[color])) throw new Error('Invalid magnets');
  return { rulesVersion: 3, puzzleId: level.id, cells: copy(level.cells), blockers: copy(level.blockers),
    stacks: copy(level.stacks).sort((a, b) => compareCells(a.cell, b.cell)),
    magnets: [...level.magnets], clearSize: level.clearSize, remainingMoves: level.moves,
    initialUnits: units.size, cleared: 0, turn: 0, terminal: null };
}

export function canPlaceMagnet(state, cell) {
  if (!isCell(cell)) return false;
  const id = cellId(cell);
  return state.cells.some(c => cellId(c) === id) && !state.blockers.some(c => cellId(c) === id)
    && !state.stacks.some(stack => cellId(stack.cell) === id);
}

// Paths are recomputed after each edge batch. Incompatible tops close a cell;
// exposed lower layers can therefore change which route exists next.
function distancesToMagnet(state, target, color) {
  const blocked = new Set(state.blockers.map(cellId));
  for (const stack of state.stacks) if (topColor(stack) !== color) blocked.add(cellId(stack.cell));
  const board = new Set(state.cells.map(cellId));
  const distances = new Map([[cellId(target), 0]]);
  const queue = [target];
  for (let i = 0; i < queue.length; i++) {
    for (const cell of neighborCells(queue[i])) {
      const id = cellId(cell);
      if (!board.has(id) || blocked.has(id) || distances.has(id)) continue;
      distances.set(id, distances.get(cellId(queue[i])) + 1);
      queue.push(cell);
    }
  }
  return distances;
}

export function applyMagnet(state, action) {
  if (state.terminal || state.remainingMoves <= 0) return { accepted: false, reason: 'terminal', state };
  if (action?.type !== 'placeMagnet' || !state.magnets.includes(action.color)) return { accepted: false, reason: 'invalid-magnet', state };
  if (!canPlaceMagnet(state, action.cell)) return { accepted: false, reason: 'occupied-or-outside', state };
  const next = copy(state);
  const targetId = cellId(action.cell);
  const events = [];
  let batch = 0;
  // Every unit travels along decreasing route distance. Even when a newly
  // exposed top opens a route, there are at most N top exposures and N*C hops.
  const bound = next.initialUnits * next.cells.length * (next.initialUnits + 1);
  let transfers = 0;
  while (true) {
    const distances = distancesToMagnet(next, action.cell, action.color);
    const candidates = next.stacks.filter(stack => topColor(stack) === action.color
      && cellId(stack.cell) !== targetId && distances.has(cellId(stack.cell)))
      .sort((a, b) => distances.get(cellId(a.cell)) - distances.get(cellId(b.cell)) || compareCells(a.cell, b.cell));
    const source = candidates[0];
    if (!source) break;
    const distance = distances.get(cellId(source.cell));
    const to = neighborCells(source.cell).find(cell => distances.get(cellId(cell)) === distance - 1);
    if (!to) throw new Error('Missing decreasing route');
    let destination = next.stacks.find(stack => cellId(stack.cell) === cellId(to));
    if (!destination) { destination = { cell: { ...to }, units: [] }; next.stacks.push(destination); }
    batch++;
    while (topColor(source) === action.color) {
      if (++transfers > bound) throw new Error('Transfer termination invariant failed');
      const fromIndex = source.units.length - 1;
      const unit = source.units.pop();
      const toIndex = destination.units.length;
      destination.units.push(unit);
      events.push({ type: 'unitMoved', batch, unit: { ...unit }, from: { ...source.cell }, to: { ...to }, fromIndex, toIndex });
      if (cellId(to) === targetId && destination.units.length === next.clearSize) {
        const cleared = destination.units.splice(0);
        next.cleared += cleared.length;
        events.push({ type: 'unitsCleared', batch, cell: { ...to }, units: cleared });
        batch++;
      }
    }
    next.stacks = next.stacks.filter(stack => stack.units.length);
  }
  next.turn++;
  next.remainingMoves--;
  next.stacks.sort((a, b) => compareCells(a.cell, b.cell));
  if (remainingUnits(next) === 0) next.terminal = 'won';
  else if (!next.remainingMoves || !next.cells.some(cell => canPlaceMagnet(next, cell))) next.terminal = 'lost';
  return { accepted: true, state: next, events, magnet: { cell: { ...action.cell }, color: action.color } };
}
