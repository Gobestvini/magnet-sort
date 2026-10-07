import { allCells, cellId, isCell } from './hex.js';
import { validateLevelDefinition } from './levels.js';

export function createInitialState(levelDefinition) {
  const level = validateLevelDefinition(levelDefinition);
  const tokens = level.tokens.map(cloneToken).sort((a, b) => compareIds(a.tokenId, b.tokenId));
  const remainingMoves = level.moveLimit;
  const state = {
    schemaVersion: 1,
    rulesVersion: 1,
    puzzleId: level.puzzleId,
    contentVersion: level.contentVersion,
    seed: level.seed,
    mode: level.mode,
    turn: 0,
    remainingMoves,
    selectedMagnetOptions: [...level.magnetSchedule[0].options],
    magnetSchedule: level.magnetSchedule.map((entry) => ({ options: [...entry.options] })),
    tokens,
    blockedCells: level.blockedCells.map((cell) => ({ ...cell })),
    goal: { ...level.goal },
    clearedMass: 0,
    initialMass: tokens.reduce((sum, token) => sum + token.mass, 0),
    mergedUnits: 0,
    chainLinks: 0,
    terminal: null,
  };
  if (!hasLegalPlacement(state)) state.terminal = { outcome: 'loss', reason: 'no-legal-action' };
  return state;
}

export function cloneState(state) {
  assertSupportedState(state);
  return {
    ...state,
    selectedMagnetOptions: [...state.selectedMagnetOptions],
    magnetSchedule: state.magnetSchedule.map((entry) => ({ options: [...entry.options] })),
    tokens: state.tokens.map(cloneToken),
    blockedCells: state.blockedCells.map((cell) => ({ ...cell })),
    goal: { ...state.goal },
    terminal: state.terminal ? { ...state.terminal } : null,
  };
}

export function assertSupportedState(state) {
  if (!state || typeof state !== 'object' || state.schemaVersion !== 1 || state.rulesVersion !== 1) {
    throw new TypeError('GameState.schemaVersion/rulesVersion: unsupported game state');
  }
  if (!Array.isArray(state.tokens) || !Array.isArray(state.blockedCells) || !Array.isArray(state.selectedMagnetOptions)
    || !Number.isInteger(state.turn) || state.turn < 0 || !Number.isInteger(state.clearedMass) || state.clearedMass < 0) {
    throw new TypeError(`GameState ${String(state.puzzleId)}: malformed state`);
  }
  return state;
}

export function hasLegalPlacement(state) {
  if (state.selectedMagnetOptions.length === 0) return false;
  const cells = allCells({ blockedCells: state.blockedCells, tokens: state.tokens });
  return cells.some((entry) => entry.kind === 'empty');
}

export function cloneToken(token) {
  return { ...token, cell: { ...token.cell } };
}

export function isStateCell(cell) { return isCell(cell); }

export function compareIds(a, b) {
  const left = Array.from(a, (character) => character.codePointAt(0));
  const right = Array.from(b, (character) => character.codePointAt(0));
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

export { cellId };
