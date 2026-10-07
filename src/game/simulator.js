import { cellId, hexDistance, neighborCells } from './hex.js';
import { assertSupportedState, cloneState, compareIds, createInitialState as createState, hasLegalPlacement } from './state.js';

const MAX_WAVES = 50; // 49 possible cells plus the final resting pass.

export const createInitialState = createState;

export function applyAction(state, action) {
  assertSupportedState(state);
  const invalid = validateAction(state, action);
  if (invalid) return { accepted: false, reason: invalid, state };

  const next = cloneState(state);
  const events = [];
  const emit = (type, wave, fields = {}) => events.push({ seq: events.length + 1, type, turn: next.turn + 1, wave, ...fields });
  const actionColor = action.color;
  const magnetCell = { ...action.cell };
  const blockedIds = new Set(next.blockedCells.map(cellId));
  let wave = 0;
  let finished = false;

  emit('actionAccepted', 0, { color: actionColor, cell: { ...magnetCell } });
  while (!finished) {
    wave += 1;
    if (wave > MAX_WAVES) throw new Error(`Simulator invariant failed: resolve exceeded ${MAX_WAVES} waves`);
    const occupied = new Map(next.tokens.map((token) => [cellId(token.cell), token.tokenId]));
    const movingColor = next.tokens.filter((token) => token.color === actionColor)
      .sort((a, b) => compareIds(a.tokenId, b.tokenId));
    const proposals = [];
    for (const token of movingColor) {
      if (cellId(token.cell) === cellId(magnetCell)) continue;
      const step = firstRouteStep(token.cell, magnetCell, blockedIds);
      if (!step || occupied.has(cellId(step))) continue;
      proposals.push({ token, step, distance: hexDistance(token.cell, magnetCell) });
    }
    const byDestination = new Map();
    for (const proposal of proposals) {
      const destination = cellId(proposal.step);
      const current = byDestination.get(destination);
      if (!current || proposal.distance < current.distance
        || (proposal.distance === current.distance && compareIds(proposal.token.tokenId, current.token.tokenId) < 0)) {
        byDestination.set(destination, proposal);
      }
    }
    const moved = [...byDestination.values()].sort((a, b) => compareIds(a.token.tokenId, b.token.tokenId));
    for (const { token, step } of moved) {
      const from = { ...token.cell };
      token.cell = { ...step };
      emit('tokenMoved', wave, { tokenId: token.tokenId, from, to: { ...step } });
    }

    const mergeResult = resolveComponents(next, emit, wave);
    if (mergeResult.clearedMass > 0) next.chainLinks += 1;
    const stillMoves = moved.length > 0;
    if (!stillMoves && mergeResult.mergedCount === 0 && mergeResult.clearedMass === 0) finished = true;
    // If movement or a merge changed occupancy, take a fresh wave snapshot. A no-op pass ends the chain.
  }

  next.turn += 1;
  if (next.remainingMoves !== null) next.remainingMoves -= 1;
  next.selectedMagnetOptions = optionsAtTurn(getLevelSchedule(state), next.turn);
  const remainingMass = next.tokens.reduce((sum, token) => sum + token.mass, 0);
  const goalMet = isGoalMet(next, remainingMass);
  emit('goalProgress', wave, {
    clearedMass: next.clearedMass,
    remainingMass,
    goal: { ...next.goal },
    met: goalMet,
  });
  if (goalMet) next.terminal = { outcome: 'win', reason: next.goal.kind === 'clearAll' ? 'clear-all' : 'clear-count' };
  else if (next.remainingMoves === 0) next.terminal = { outcome: 'loss', reason: 'move-limit' };
  else if (!hasLegalPlacement(next)) next.terminal = { outcome: 'loss', reason: 'no-legal-action' };
  if (next.terminal) emit('runEnded', wave, { ...next.terminal });
  next.tokens.sort((a, b) => compareIds(a.tokenId, b.tokenId));
  return { accepted: true, state: next, events };
}

export function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort(compareIds).map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validateAction(state, action) {
  if (state.terminal) return 'terminal';
  if (state.remainingMoves === 0) return 'no-moves-remaining';
  if (!action || typeof action !== 'object' || action.type !== 'placeMagnet') return 'invalid-action';
  if (typeof action.color !== 'string' || !state.selectedMagnetOptions.includes(action.color)) return 'unavailable-color';
  if (!action.cell || !Number.isInteger(action.cell.col) || !Number.isInteger(action.cell.row)
    || action.cell.col < 0 || action.cell.col > 6 || action.cell.row < 0 || action.cell.row > 6) return 'cell-out-of-bounds';
  const id = cellId(action.cell);
  if (state.blockedCells.some((cell) => cellId(cell) === id)) return 'cell-blocked';
  if (state.tokens.some((token) => cellId(token.cell) === id)) return 'cell-occupied';
  return null;
}

function firstRouteStep(start, target, blockedIds) {
  const startId = cellId(start);
  const targetId = cellId(target);
  if (startId === targetId) return null;
  const queue = [{ cell: { ...start }, first: null }];
  const visited = new Set([startId]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const nextCell of neighborCells(current.cell)) {
      const nextId = cellId(nextCell);
      if (visited.has(nextId) || blockedIds.has(nextId)) continue;
      const first = current.first ?? nextCell;
      if (nextId === targetId) return first;
      visited.add(nextId);
      queue.push({ cell: nextCell, first });
    }
  }
  return null;
}

function resolveComponents(state, emit, wave) {
  const byCell = new Map(state.tokens.map((token) => [cellId(token.cell), token]));
  const seen = new Set();
  const components = [];
  for (const token of [...state.tokens].sort((a, b) => compareIds(a.tokenId, b.tokenId))) {
    if (seen.has(token.tokenId)) continue;
    const component = [];
    const queue = [token];
    seen.add(token.tokenId);
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      component.push(current);
      for (const neighbor of neighborCells(current.cell)) {
        const adjacent = byCell.get(cellId(neighbor));
        if (adjacent && adjacent.color === token.color && !seen.has(adjacent.tokenId)) {
          seen.add(adjacent.tokenId);
          queue.push(adjacent);
        }
      }
    }
    const totalMass = component.reduce((sum, member) => sum + member.mass, 0);
    if ((totalMass >= 3 && component.length > 1) || totalMass >= 5) {
      component.sort((a, b) => compareIds(a.tokenId, b.tokenId));
      components.push({ members: component, totalMass, keeper: component[0] });
    }
  }
  components.sort((a, b) => compareIds(a.keeper.tokenId, b.keeper.tokenId));

  let clearedMass = 0;
  let mergedCount = 0;
  const remove = new Set();
  for (const component of components) {
    const { members, totalMass, keeper } = component;
    const merged = members.length > 1;
    if (merged) {
      mergedCount += 1;
      state.mergedUnits += totalMass - 1;
    }
    keeper.mass = totalMass;
    for (const member of members) if (member !== keeper) remove.add(member.tokenId);
    if (merged) emit('stackMerged', wave, {
        tokenId: keeper.tokenId,
        memberIds: members.map((member) => member.tokenId),
        mass: totalMass,
        cell: { ...keeper.cell },
      });
    if (totalMass >= 5) {
      remove.add(keeper.tokenId);
      clearedMass += totalMass;
      emit('stackCleared', wave, { tokenId: keeper.tokenId, mass: totalMass, cell: { ...keeper.cell } });
    }
  }
  if (remove.size > 0) state.tokens = state.tokens.filter((token) => !remove.has(token.tokenId));
  state.clearedMass += clearedMass;
  return { clearedMass, mergedCount };
}

function isGoalMet(state, remainingMass) {
  return state.goal.kind === 'clearAll' ? remainingMass === 0 : state.clearedMass >= state.goal.mass;
}

function getLevelSchedule(state) {
  return state.magnetSchedule ?? [{ options: state.selectedMagnetOptions }];
}

function optionsAtTurn(schedule, turn) {
  const entry = schedule[Math.min(turn, schedule.length - 1)];
  return [...entry.options];
}

