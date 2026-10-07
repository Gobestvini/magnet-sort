import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/game/session.js';
import { campaignLevelIds } from '../src/game/levels.js';
import { DAILY_ROTATION_VERSION, getDailyPuzzle } from '../src/social/daily.js';

test('dailyId and frozen level are shared by clients at the same UTC instant', () => {
  const fromLateOffset = getDailyPuzzle('2026-10-06T23:30:00-02:00');
  const fromUtc = getDailyPuzzle('2026-10-07T01:30:00Z');
  assert.equal(fromLateOffset.dailyId, '2026-10-07');
  assert.equal(fromUtc.dailyId, fromLateOffset.dailyId);
  assert.equal(fromUtc.puzzleId, fromLateOffset.puzzleId);
  assert.equal(fromUtc.seed, fromLateOffset.seed);
  assert.equal(fromUtc.contentVersion, fromLateOffset.contentVersion);
  assert.equal(fromUtc.rulesVersion, fromLateOffset.rulesVersion);
  assert.equal(fromUtc.rotationVersion, DAILY_ROTATION_VERSION);
});

test('UTC midnight changes the daily selection without mutating an active run', () => {
  const beforeMidnight = getDailyPuzzle('2026-10-07T23:59:59Z');
  const session = createSession({ resolveSeconds: 0 });
  assert.equal(session.startDaily(beforeMidnight.dailyId, beforeMidnight.puzzleId), true);
  const started = session.snapshot();
  const nextDay = getDailyPuzzle('2026-10-08T00:00:00Z');
  assert.notEqual(nextDay.dailyId, started.dailyId);
  assert.equal(session.snapshot().dailyId, beforeMidnight.dailyId);
  assert.equal(session.snapshot().puzzleId, beforeMidnight.puzzleId);
  assert.equal(session.retry(), true);
  assert.equal(session.snapshot().dailyId, beforeMidnight.dailyId);
  assert.equal(session.snapshot().puzzleId, beforeMidnight.puzzleId);
  assert.equal(session.nextPuzzle(), false);
});

test('versioned daily rotation covers only reviewed campaign levels and rejects invalid instants', () => {
  const ids = new Set(campaignLevelIds().slice(5));
  for (const date of ['2026-01-01T00:00:00Z', '2026-10-07T12:00:00Z', '2040-12-31T23:59:59Z']) {
    const daily = getDailyPuzzle(date);
    assert.ok(ids.has(daily.puzzleId));
    assert.equal(daily.level.puzzleId, daily.puzzleId);
    assert.ok(daily.level.seed);
  }
  assert.throws(() => getDailyPuzzle('not a date'), /valid instant/);
});
