import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, canonicalStringify, createInitialState } from '../src/game/simulator.js';
import { allCells } from '../src/game/hex.js';
import { loadFtueLevel } from '../src/game/levels.js';
import { createSession } from '../src/game/session.js';
import { canAddExtraMove, createHintResolver, findAuthoredHint, grantStandaloneTestReward } from '../src/game/boosters.js';

const losingLevel = {
  schemaVersion: 1, rulesVersion: 1, puzzleId: 'booster-loss', seed: 'booster-loss-v1', contentVersion: 1,
  geometry: { kind: 'odd-r', rows: 7, cols: 7 }, colors: ['red', 'blue', 'yellow'], blockedCells: [], crates: [],
  tokens: [{ tokenId: 'red-1', color: 'red', mass: 1, cell: { col: 0, row: 0 } }],
  goal: { kind: 'clearCount', mass: 2 }, moveLimit: 1, magnetSchedule: [{ options: ['red'] }], mode: 'prototype',
};

function loseOneTurn(session) {
  const loaded = session.loadTestLevel(losingLevel);
  assert.equal(loaded, true);
  assert.equal(session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 6, row: 6 } }).accepted, true);
  session.finishResolution();
  assert.equal(session.snapshot().phase, 'lost');
  assert.equal(session.snapshot().result.reason, 'move-limit');
}

test('Undo restores the complete pre-action GameState once and never clears its assisted flag by itself', () => {
  const session = createSession({ initialPuzzleId: 'prototype-03-blocker', resolveSeconds: 0 });
  loseOneTurn(session);
  const result = session.undo();
  assert.equal(result.accepted, true);
  assert.equal(canonicalStringify(session.snapshot().state), canonicalStringify(createInitialState(losingLevel)));
  assert.equal(session.snapshot().phase, 'playing');
  assert.equal(session.snapshot().result, null);
  assert.equal(session.snapshot().assistedFlags.undo, true);
  assert.equal(session.snapshot().boosters.undoAvailable, false);
  assert.equal(session.undo().accepted, false);
  session.retry();
  assert.equal(session.snapshot().assistedFlags.undo, undefined);
  assert.equal(session.snapshot().boosters.undoAvailable, false);
});

test('hint replays only an authored solution prefix, returns a legal next action, and marks the run assisted', () => {
  const level = loadFtueLevel('ftue-04-color-choice');
  const initial = createInitialState(level);
  const first = applyAction(initial, level.solution.actions[0]);
  const hint = findAuthoredHint(level, first.state);
  assert.equal(hint.available, true);
  assert.deepEqual(hint.action, level.solution.actions[1]);
  assert.equal(applyAction(first.state, hint.action).accepted, true);
  assert.equal(findAuthoredHint(level, first.state, { maxActions: 0 }).reason, 'replay-bound-exceeded');
  assert.equal(findAuthoredHint({ ...level, solution: undefined }, initial).reason, 'no-authored-solution');

  const session = createSession({ ftuePuzzleId: level.puzzleId, resolveSeconds: 0 });
  session.dispatch(level.solution.actions[0]);
  session.finishResolution();
  const requested = session.requestHint();
  assert.equal(requested.available, true);
  assert.deepEqual(session.snapshot().hintAction, level.solution.actions[1]);
  assert.equal(session.snapshot().assistedFlags.hint, true);
  assert.equal(session.requestHint().reason, 'hint-already-used');
  assert.equal(session.applyHint().accepted, true);
  session.finishResolution();
  assert.equal(session.snapshot().result.eligibleForChallenge, false);
  session.retry();
  assert.equal(session.snapshot().boosters.hintAvailable, true);
  assert.equal(session.snapshot().hintAction, null);
});

test('extra move uses the shared test grant callback once, only in an eligible limited run', () => {
  const requests = [];
  const session = createSession({ initialPuzzleId: 'prototype-03-blocker', grantReward: (kind) => { requests.push(kind); return grantStandaloneTestReward(kind); } });
  loseOneTurn(session);
  const before = session.snapshot();
  const grant = session.requestExtraMove();
  assert.equal(grant.granted, true);
  assert.equal(grant.provider, 'standalone-test');
  assert.equal(requests.length, 1);
  assert.equal(session.snapshot().phase, 'playing');
  assert.equal(session.snapshot().remainingMoves, before.remainingMoves + 1);
  assert.equal(session.snapshot().assistedFlags.extraMove, true);
  assert.equal(session.snapshot().boosters.extraMoveAvailable, false);
  assert.equal(session.requestExtraMove().reason, 'extra-move-already-used');
  session.retry();
  assert.equal(session.snapshot().remainingMoves, 1);
  assert.equal(session.snapshot().assistedFlags.extraMove, undefined);
});

test('extra move rejects wins, no-legal-action states, unlimited moves, and a denied grant', () => {
  const won = createSession({ initialPuzzleId: 'prototype-03-blocker', resolveSeconds: 0 });
  won.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 3 } });
  assert.equal(won.snapshot().phase, 'won');
  assert.equal(won.requestExtraMove().granted, false);

  const limited = createInitialState({ ...losingLevel, moveLimit: 2 });
  const full = { ...limited, tokens: allCells().map(({ cell }, index) => ({ tokenId: `full-${index}`, color: 'red', mass: 1, cell })) };
  assert.equal(canAddExtraMove(full, 'lost'), false);
  assert.equal(canAddExtraMove({ ...limited, remainingMoves: null }, 'playing'), false);
  const denied = createSession({ initialPuzzleId: 'prototype-03-blocker', grantReward: () => ({ granted: false, reason: 'denied' }) });
  loseOneTurn(denied);
  assert.equal(denied.requestExtraMove().reason, 'denied');
  assert.equal(denied.snapshot().assistedFlags.extraMove, undefined);
});

test('hint resolver is bounded, reset-safe, and cannot return work after dispose', () => {
  const resolver = createHintResolver();
  const level = loadFtueLevel('ftue-04-color-choice');
  assert.equal(resolver.request(level, createInitialState(level)).available, true);
  resolver.cancel();
  resolver.dispose();
  assert.equal(resolver.request(level, createInitialState(level)).reason, 'resolver-disposed');
});
