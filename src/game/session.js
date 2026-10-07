import { applyAction, createInitialState } from './simulator.js';
import { loadPrototypeLevel, prototypeLevelIds, validateLevelDefinition } from './levels.js';
import { cloneState } from './state.js';

const DEFAULT_RESOLVE_SECONDS = 0.22;

function phaseForState(state) {
  if (state.terminal?.outcome === 'win') return 'won';
  if (state.terminal?.outcome === 'loss') return 'lost';
  return 'playing';
}

export function createSession({ initialPuzzleId = 'prototype-03-blocker', resolveSeconds = DEFAULT_RESOLVE_SECONDS } = {}) {
  const puzzleIds = prototypeLevelIds();
  let puzzleIndex = Math.max(0, puzzleIds.indexOf(initialPuzzleId));
  let level = null;
  let state = null;
  let phase = 'loading';
  let error = null;
  let lastEvents = [];
  let resolveRemaining = 0;

  function installLevel(nextLevel) {
    try {
      level = validateLevelDefinition(nextLevel);
      state = createInitialState(level);
      phase = phaseForState(state);
      error = null;
      lastEvents = [];
      resolveRemaining = 0;
      return true;
    } catch (caught) {
      level = null;
      state = null;
      phase = 'error';
      error = caught instanceof Error ? caught.message : String(caught);
      lastEvents = [];
      resolveRemaining = 0;
      return false;
    }
  }

  function loadCurrent() {
    return installLevel(loadPrototypeLevel(puzzleIds[puzzleIndex]));
  }

  function settleResolution() {
    resolveRemaining = 0;
    phase = phaseForState(state);
  }

  loadCurrent();

  return {
    getLevel() { return level; },
    getState() { return state; },
    dispatch(action) {
      if (phase !== 'playing') return { accepted: false, reason: `session-${phase}`, state };
      const result = applyAction(state, action);
      if (!result.accepted) return result;
      state = result.state;
      lastEvents = result.events.map((event) => structuredClone(event));
      resolveRemaining = Math.max(0, Number.isFinite(resolveSeconds) ? resolveSeconds : DEFAULT_RESOLVE_SECONDS);
      phase = 'resolving';
      if (resolveRemaining === 0) settleResolution();
      return result;
    },
    update(dt) {
      if (phase !== 'resolving' || !Number.isFinite(dt) || dt <= 0) return false;
      resolveRemaining = Math.max(0, resolveRemaining - dt);
      if (resolveRemaining === 0) settleResolution();
      return true;
    },
    finishResolution() {
      if (phase !== 'resolving') return false;
      settleResolution();
      return true;
    },
    reset() {
      if (!level) return loadCurrent();
      return installLevel(level);
    },
    retry() { return this.reset(); },
    nextPuzzle() {
      puzzleIndex = (puzzleIndex + 1) % puzzleIds.length;
      return loadCurrent();
    },
    loadTestLevel(testLevel) { return installLevel(testLevel); },
    snapshot() {
      return {
        phase,
        error,
        puzzleId: level?.puzzleId ?? puzzleIds[puzzleIndex],
        goal: level ? { ...level.goal } : null,
        colors: level ? [...level.colors] : [],
        state: state ? cloneState(state) : null,
        movesUsed: state?.turn ?? 0,
        remainingMoves: state?.remainingMoves ?? null,
        availableColors: state ? [...state.selectedMagnetOptions] : [],
        events: lastEvents.map((event) => structuredClone(event)),
        resolveRemaining,
      };
    },
  };
}
