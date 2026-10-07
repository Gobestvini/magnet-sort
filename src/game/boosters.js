import { applyAction, canonicalStringify, createInitialState } from './simulator.js';
import { cloneState, hasLegalPlacement } from './state.js';

export const BOOSTER_LIMITS = Object.freeze({ undo: 1, hint: 1, extraMove: 1 });
export const MAX_HINT_REPLAY_ACTIONS = 16;

// Standalone fallback used until a real rewarded provider is separately approved/configured.
export function grantStandaloneTestReward(kind) {
  return kind === 'extraMove'
    ? { granted: true, provider: 'standalone-test' }
    : { granted: false, provider: 'standalone-test', reason: 'unsupported-reward' };
}

export function findAuthoredHint(level, currentState, { maxActions = MAX_HINT_REPLAY_ACTIONS } = {}) {
  const actions = level?.solution?.actions;
  if (!Array.isArray(actions) || actions.length === 0) return { available: false, reason: 'no-authored-solution', replayed: 0 };
  if (!Number.isInteger(maxActions) || maxActions < 0 || maxActions > MAX_HINT_REPLAY_ACTIONS) {
    return { available: false, reason: 'invalid-bound', replayed: 0 };
  }
  let state;
  try { state = createInitialState(level); }
  catch { return { available: false, reason: 'invalid-level', replayed: 0 }; }
  const wanted = canonicalStringify(currentState);
  if (canonicalStringify(state) === wanted) {
    const action = actions[0];
    return applyAction(state, action).accepted
      ? { available: true, action: structuredClone(action), replayed: 0 }
      : { available: false, reason: 'invalid-authored-solution', replayed: 0 };
  }
  const replayLimit = Math.min(actions.length, maxActions);
  for (let index = 0; index < replayLimit; index++) {
    const replay = applyAction(state, actions[index]);
    if (!replay.accepted) return { available: false, reason: 'invalid-authored-solution', replayed: index };
    state = replay.state;
    if (canonicalStringify(state) === wanted) {
      const action = actions[index + 1];
      if (!action) return { available: false, reason: 'solution-complete', replayed: index + 1 };
      return applyAction(state, action).accepted
        ? { available: true, action: structuredClone(action), replayed: index + 1 }
        : { available: false, reason: 'invalid-authored-solution', replayed: index + 1 };
    }
  }
  return { available: false, reason: actions.length > maxActions ? 'replay-bound-exceeded' : 'state-outside-solution', replayed: replayLimit };
}

export function createHintResolver() {
  let generation = 0;
  let disposed = false;
  return {
    request(level, state) {
      if (disposed) return { available: false, reason: 'resolver-disposed', replayed: 0 };
      const requestedAt = generation;
      const result = findAuthoredHint(level, state);
      return requestedAt === generation ? result : { available: false, reason: 'cancelled', replayed: result.replayed ?? 0 };
    },
    cancel() { generation += 1; },
    dispose() { if (disposed) return; generation += 1; disposed = true; },
  };
}

export function canAddExtraMove(state, phase) {
  if (!state || state.remainingMoves === null || !Number.isInteger(state.remainingMoves)) return false;
  if (!hasLegalPlacement(state)) return false;
  if (phase === 'playing') return state.terminal === null && state.remainingMoves > 0;
  return phase === 'lost' && state.terminal?.outcome === 'loss' && state.terminal.reason === 'move-limit';
}

export function addOneMove(state) {
  if (!state || state.remainingMoves === null || !Number.isInteger(state.remainingMoves) || state.remainingMoves < 0) return null;
  const next = cloneState(state);
  next.remainingMoves += 1;
  next.terminal = null;
  return next;
}
