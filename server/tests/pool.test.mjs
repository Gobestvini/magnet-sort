import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayPool } from '../leaderboards/pool.mjs';
import { replay, validateDailyCatalog } from '../leaderboards/profiles.mjs';
import { campaign, campaignActions, dailyActions, daily } from './helpers.mjs';

test('actual workers verify thirty daily witnesses plus shared campaign and reject nonterminal/extra actions', async () => {
  const pool = createReplayPool();
  try {
    await pool.ready; await validateDailyCatalog(pool);
    const payload = { mode: 'campaign', descriptor: campaign(), actions: campaignActions };
    assert.deepEqual(await pool.run(payload), replay(payload));
    await assert.rejects(pool.run({ ...payload, actions: [] }), /REPLAY_NOT_WON/);
    await assert.rejects(pool.run({ mode: 'daily', descriptor: daily(), actions: [...dailyActions, dailyActions[0]] }), /REPLAY_REJECTED/);
    assert(pool.healthy); assert.equal(pool.stats.queued, 0);
  } finally { await pool.close(); }
});
test('queue bound, active timeout, replacement, cancellation and close prevent late results', async () => {
  const pool = createReplayPool({ size: 2, maxQueue: 2, activeMs: 80, operationMs: 2000, workerUrl: new URL('./worker-fixture.mjs', import.meta.url) });
  try {
    await pool.ready;
    const pending = Array.from({ length: 4 }, () => pool.run({ hang: true }).catch(error => error.code));
    assert.equal(pool.stats.active, 2); assert.equal(pool.stats.queued, 2);
    await assert.rejects(pool.run({ hang: true }), /REPLAY_QUEUE_FULL/);
    assert.deepEqual(await Promise.all(pending), Array(4).fill('REPLAY_TIMEOUT'));
    assert.deepEqual(await pool.run({ value: 12 }), { fixture: 12 });
    const abort = new AbortController(); const cancelled = pool.run({ hang: true }, { signal: abort.signal }).catch(error => error.code); abort.abort();
    assert.equal(await cancelled, 'REQUEST_ABORTED');
    assert.deepEqual(await pool.run({ value: 13 }), { fixture: 13 });
    const closing = pool.run({ hang: true }).catch(error => error.code); await pool.close(); assert.equal(await closing, 'SERVICE_CLOSING');
  } finally { await pool.close(); }
});
test('operation deadline includes queued time and removes expired queue entries', async () => {
  const pool = createReplayPool({ size: 1, maxQueue: 2, activeMs: 500, operationMs: 60, workerUrl: new URL('./worker-fixture.mjs', import.meta.url) });
  try {
    await pool.ready;
    const first = pool.run({ hang: true }).catch(error => error.code), queued = pool.run({ value: 1 }).catch(error => error.code);
    assert.equal(await first, 'OPERATION_TIMEOUT'); assert.equal(await queued, 'OPERATION_TIMEOUT'); assert.equal(pool.stats.queued, 0);
  } finally { await pool.close(); }
});
