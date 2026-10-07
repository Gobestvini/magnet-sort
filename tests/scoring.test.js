import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRunResults, createRunResult } from '../src/game/scoring.js';
import { formatDuration } from '../src/ui/result.js';

function state(overrides = {}) {
  return {
    rulesVersion: 1, puzzleId: 'score-fixture', contentVersion: 2, seed: 'seed', mode: 'prototype',
    terminal: { outcome: 'win', reason: 'clear-count' }, turn: 3, clearedMass: 5, initialMass: 20,
    mergedUnits: 4, chainLinks: 2, ...overrides,
  };
}

test('score follows RULES v1, clear percentage floors, and wall time stays outside score', () => {
  const first = createRunResult(state(), 1234.6);
  const slower = createRunResult(state(), 60000);
  assert.equal(first.score, 590);
  assert.equal(first.movesUsed, 3);
  assert.equal(first.clearPercent, 25);
  assert.equal(first.clearedMass, 5);
  assert.equal(first.activeTimeMs, 1235);
  assert.equal(slower.score, first.score);
  assert.equal(first.outcome, 'win');
  assert.equal(first.eligibleForChallenge, true);
});

test('zero initial mass and partial losing clears report safely without implying success', () => {
  const empty = createRunResult(state({ initialMass: 0, clearedMass: 0, terminal: { outcome: 'loss', reason: 'no-legal-action' } }), 0);
  assert.equal(empty.clearPercent, 0);
  assert.equal(empty.outcome, 'loss');
  const partial = createRunResult(state({ clearedMass: 4, initialMass: 9, terminal: { outcome: 'loss', reason: 'move-limit' } }), -100);
  assert.equal(partial.clearPercent, 44);
  assert.equal(partial.activeTimeMs, 0);
  assert.equal(partial.outcome, 'loss');
});

test('assisted flags stay with a run and disqualify it from challenge eligibility', () => {
  const assisted = createRunResult(state(), 1000, { hint: true, undo: false, extraMove: true, custom: false });
  assert.deepEqual(assisted.assistedFlags, { hint: true, undo: false, extraMove: true, custom: false });
  assert.equal(assisted.eligibleForChallenge, false);
});

test('one comparator ranks outcome, score, moves, time, then ties and rejects incompatible puzzles', () => {
  const base = createRunResult(state(), 2000);
  assert.equal(compareRunResults(base, { ...base, outcome: 'loss', score: 9999 }), 1);
  assert.equal(compareRunResults({ ...base, score: 591, movesUsed: 20 }, base), 1);
  assert.equal(compareRunResults(base, { ...base, score: 590, movesUsed: 4 }), 1);
  assert.equal(compareRunResults(base, { ...base, score: 590, movesUsed: 3, activeTimeMs: 2001 }), 1);
  assert.equal(compareRunResults(base, { ...base }), 0);
  assert.equal(compareRunResults(base, { ...base, puzzleId: 'another-puzzle' }), null);
  assert.equal(compareRunResults(base, { ...base, contentVersion: 3 }), null);
  assert.equal(compareRunResults(base, { ...base, mode: 'daily' }), null);
});

test('result builder rejects an unfinished state', () => {
  assert.throws(() => createRunResult(state({ terminal: null }), 0), /terminal GameState/);
});

test('result duration is formatted as minutes, seconds and tenths', () => {
  assert.equal(formatDuration(0), '0:00.0');
  assert.equal(formatDuration(1999), '0:01.9');
  assert.equal(formatDuration(65000), '1:05.0');
});
