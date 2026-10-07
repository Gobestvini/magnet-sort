import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from '../src/analytics/events.js';

test('dev collector records safe event envelopes once per run without identifiers or URLs', () => {
  const analytics = createAnalytics({ createId: (prefix = 'run') => `${prefix}-test` });
  const context = {
    runId: analytics.createId(), flowId: 'ftue-flow', puzzleId: 'campaign-01',
    contentVersion: 1, rulesVersion: 2, mode: 'campaign', assisted: false,
    friendName: 'Alice', url: 'https://example.test/?challenge=secret', email: 'player@example.test',
  };

  assert.equal(analytics.track('level_start', context), true);
  assert.equal(analytics.track('level_start', context), false);
  assert.equal(analytics.track('challenge_created', { ...context, challengeUrl: context.url }), true);
  assert.deepEqual(analytics.snapshot(), [
    { schemaVersion: 1, name: 'level_start', runId: 'run-test', flowId: 'ftue-flow', puzzleId: 'campaign-01', contentVersion: 1, rulesVersion: 2, mode: 'campaign', assisted: false },
    { schemaVersion: 1, name: 'challenge_created', runId: 'run-test', flowId: 'ftue-flow', puzzleId: 'campaign-01', contentVersion: 1, rulesVersion: 2, mode: 'campaign', assisted: false },
  ]);
});

test('event allowlist and fire-and-forget production sink are safe while local collection is disabled', async () => {
  const delivered = [];
  const analytics = createAnalytics({
    enabled: false,
    sink(event) { delivered.push(event); return Promise.reject(new Error('offline')); },
  });
  for (const runId of ['a', 'b', 'c']) analytics.track('level_start', { runId, puzzleId: 'p', mode: 'campaign', assisted: false });
  assert.equal(analytics.track('unlisted_event', { runId: 'd' }), false);
  assert.deepEqual(analytics.snapshot(), []);
  assert.equal(delivered.length, 3);
  assert.equal(analytics.track('level_start', { runId: 'bad', score: -1, movesUsed: Infinity, mode: 'x'.repeat(97) }), true);
  assert.deepEqual(delivered[3], { schemaVersion: 1, name: 'level_start', runId: 'bad' });
  await Promise.resolve();
});

test('development collector only keeps the newest configured number of events', () => {
  const analytics = createAnalytics({ maxEvents: 2 });
  for (const runId of ['a', 'b', 'c']) analytics.track('level_start', { runId });
  assert.deepEqual(analytics.snapshot().map((event) => event.runId), ['b', 'c']);
});

test('rewarded_viewed needs an explicit verified, non-test SDK completion', () => {
  const analytics = createAnalytics();
  const context = { runId: 'run-1', puzzleId: 'campaign-01', contentVersion: 1, rulesVersion: 2, mode: 'campaign', assisted: false };
  assert.equal(analytics.track('rewarded_viewed', { ...context, provider: 'standalone-test' }), false);
  assert.equal(analytics.rewardedViewed(context, { verifiedCompletion: false, provider: 'instant-games' }), false);
  assert.equal(analytics.rewardedViewed(context, { verifiedCompletion: true, provider: 'standalone-test' }), false);
  assert.equal(analytics.rewardedViewed(context, { verifiedCompletion: true, provider: 'instant-games' }), true);
  assert.equal(analytics.snapshot()[0].name, 'rewarded_viewed');
  analytics.dispose();
  assert.deepEqual(analytics.snapshot(), []);
});
