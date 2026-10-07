import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { applyAction, createInitialState } from '../src/game/simulator.js';
import { ftueLevelIds, loadFtueLevel } from '../src/game/levels.js';
import { createSession } from '../src/game/session.js';

const directory = new URL('../src/levels/ftue/', import.meta.url);

function replay(level) {
  let state = createInitialState(level);
  const allEvents = [];
  for (const action of level.solution.actions) {
    const result = applyAction(state, action);
    assert.equal(result.accepted, true, `${level.puzzleId} solution action must be accepted`);
    state = result.state;
    allEvents.push(...result.events);
  }
  assert.equal(state.terminal?.outcome, level.solution.expected.outcome, level.puzzleId);
  assert.equal(state.clearedMass, level.solution.expected.clearedMass, level.puzzleId);
  assert.equal(state.turn, level.solution.expected.movesUsed, level.puzzleId);
  return { state, events: allEvents };
}

test('campaign FTUE contains exactly five valid levels and every authored solution wins', async () => {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  assert.equal(files.length, 5);
  const levels = files.map(async (file) => JSON.parse(await readFile(new URL(file, directory), 'utf8')));
  const definitions = await Promise.all(levels);
  assert.deepEqual(definitions.map((level) => level.puzzleId).sort(), ftueLevelIds());
  assert.ok(definitions.every((level) => ['red', 'blue', 'yellow'].every((color) => level.colors.includes(color))));
  for (const id of ftueLevelIds()) {
    const level = loadFtueLevel(id);
    const { events, state } = replay(level);
    assert.ok(state.tokens.length < level.tokens.length || state.terminal.outcome === 'win');
    if (id === 'ftue-04-color-choice') assert.equal(level.solution.actions.length, 2);
    if (id === 'ftue-05-chain') assert.equal(events.filter((event) => event.type === 'stackCleared').length, 2);
    if (id === 'ftue-05-chain') assert.equal(state.chainLinks, 2);
  }
});

test('first launch shows a three-second hint that never places a magnet for the player', () => {
  const session = createSession();
  const initial = session.snapshot();
  assert.equal(initial.puzzleId, 'ftue-01-place');
  assert.equal(initial.tutorial.active, true);
  assert.equal(initial.tutorial.hint.active, true);
  session.advanceActiveTime(2.9);
  assert.equal(session.snapshot().tutorial.hint.active, true);
  assert.equal(session.snapshot().movesUsed, 0);
  session.advanceActiveTime(0.2);
  assert.equal(session.snapshot().tutorial.hint, null);
  assert.equal(session.snapshot().movesUsed, 0);
});

test('lesson advances only on a real win; retry stays in the same lesson and clears its run', () => {
  const session = createSession();
  assert.equal(session.nextPuzzle(), false);
  assert.equal(session.dispatch({ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 3 } }).accepted, true);
  assert.equal(session.snapshot().tutorial.completed, false);
  assert.equal(session.finishResolution(), true);
  assert.equal(session.snapshot().phase, 'won');
  assert.equal(session.nextPuzzle(), true);
  assert.equal(session.snapshot().puzzleId, 'ftue-02-pull');
  session.dispatch({ type: 'placeMagnet', color: 'yellow', cell: { col: 4, row: 3 } });
  session.retry();
  assert.equal(session.snapshot().puzzleId, 'ftue-02-pull');
  assert.equal(session.snapshot().movesUsed, 0);
  assert.equal(session.snapshot().activeTimeMs, 0);
});

test('completion is recorded only after winning lesson five; then campaign opens', () => {
  const session = createSession();
  for (const id of ftueLevelIds()) {
    const level = loadFtueLevel(id);
    assert.equal(session.snapshot().puzzleId, id);
    for (const action of level.solution.actions) {
      assert.equal(session.dispatch(action).accepted, true);
      session.finishResolution();
    }
    if (id !== 'ftue-05-chain') {
      assert.equal(session.snapshot().tutorial.completed, false);
      assert.equal(session.nextPuzzle(), true);
    }
  }
  assert.equal(session.snapshot().tutorial.completed, true);
  assert.equal(session.snapshot().phase, 'won');
  assert.equal(session.nextPuzzle(), true);
  assert.equal(session.snapshot().tutorial.active, false);
  assert.equal(session.snapshot().tutorial.completed, true);
  assert.equal(session.snapshot().puzzleId, 'prototype-01-clear-all');
});

test('skip and explicit challenge entry bypass the tutorial without marking it complete', () => {
  const skipped = createSession();
  assert.equal(skipped.skipTutorial(), true);
  assert.equal(skipped.snapshot().tutorial.active, false);
  assert.equal(skipped.snapshot().tutorial.skipped, true);
  assert.equal(skipped.snapshot().tutorial.completed, false);
  assert.equal(skipped.snapshot().puzzleId, 'prototype-01-clear-all');
  const challenge = createSession({ initialPuzzleId: 'prototype-02-clear-count' });
  assert.equal(challenge.snapshot().puzzleId, 'prototype-02-clear-count');
  assert.equal(challenge.snapshot().tutorial.active, false);
});
