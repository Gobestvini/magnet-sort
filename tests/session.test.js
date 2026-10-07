import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/game/session.js';

const losingLevel = {
  schemaVersion: 1,
  rulesVersion: 1,
  puzzleId: 'session-loss-fixture',
  seed: 'session-loss-v1',
  contentVersion: 1,
  geometry: { kind: 'odd-r', rows: 7, cols: 7 },
  colors: ['red', 'blue', 'yellow'],
  blockedCells: [],
  tokens: [{ tokenId: 'small-red', color: 'red', mass: 1, cell: { col: 0, row: 0 } }],
  goal: { kind: 'clearCount', mass: 2 },
  moveLimit: 1,
  magnetSchedule: [{ options: ['red'] }],
  mode: 'prototype',
};

test('accepted actions enter resolving, then settle to the simulator outcome', () => {
  const session = createSession();
  assert.equal(session.snapshot().phase, 'playing');
  assert.equal(session.snapshot().puzzleId, 'prototype-03-blocker');
  const result = session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 3 } });
  assert.equal(result.accepted, true);
  assert.equal(session.snapshot().phase, 'resolving');
  assert.equal(session.snapshot().movesUsed, 1);
  assert.ok(session.snapshot().events.some((event) => event.type === 'tokenMoved'));
  assert.equal(session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 4, row: 3 } }).reason, 'session-resolving');
  assert.equal(session.update(0.1), true);
  assert.equal(session.snapshot().phase, 'resolving');
  assert.equal(session.update(0.2), true);
  assert.equal(session.snapshot().phase, 'won');
  assert.equal(session.snapshot().state.terminal.outcome, 'win');
  assert.equal(session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 4, row: 3 } }).reason, 'session-won');
});

test('reset cancels a pending resolution and retry starts the same puzzle', () => {
  const session = createSession();
  session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 3 } });
  session.reset();
  assert.equal(session.snapshot().phase, 'playing');
  assert.equal(session.snapshot().movesUsed, 0);
  assert.equal(session.snapshot().events.length, 0);
  assert.equal(session.update(1), false);
  session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 3 } });
  session.update(1);
  session.retry();
  assert.equal(session.snapshot().puzzleId, 'prototype-03-blocker');
  assert.equal(session.snapshot().phase, 'playing');
});

test('loss state and next prototype puzzle are available to the UI', () => {
  const session = createSession();
  assert.equal(session.loadTestLevel(losingLevel), true);
  const lost = session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 6, row: 6 } });
  assert.equal(lost.accepted, true);
  session.update(1);
  assert.equal(session.snapshot().phase, 'lost');
  assert.equal(session.snapshot().state.terminal.reason, 'move-limit');
  assert.equal(session.retry(), true);
  assert.equal(session.snapshot().phase, 'playing');
  assert.equal(session.snapshot().movesUsed, 0);
  assert.equal(session.nextPuzzle(), true);
  assert.equal(session.snapshot().puzzleId, 'prototype-01-clear-all');
  assert.deepEqual(session.snapshot().availableColors, ['red']);
});

test('invalid level data enters recoverable error phase', () => {
  const session = createSession();
  assert.equal(session.loadTestLevel({ puzzleId: 'bad' }), false);
  assert.equal(session.snapshot().phase, 'error');
  assert.match(session.snapshot().error, /LevelDefinition/);
  assert.equal(session.retry(), true);
  assert.equal(session.snapshot().phase, 'playing');
});
