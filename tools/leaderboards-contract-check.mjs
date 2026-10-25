// Real client + HTTP + SQLite + replay workers. Test keys stay inside this
// isolated process; this tool never calls the public API or publishes players.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/leaderboards/http.mjs';
import { createLeaderboardsClient } from '../src/prototype/leaderboards-client.js';
import { keys, signedInit, baseTime, campaign, campaignActions, daily, dailyActions } from '../server/tests/helpers.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'magnet-leaderboards-contract-'));
let app;
const clients = [];
try {
  app = createApp({ path: path.join(directory, 'rankings.sqlite'), clock: () => baseTime, authOptions: { publicKey: keys.publicKey } });
  await app.ready;
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${app.server.address().port}/v1`;
  for (const id of [101, 202]) {
    clients.push(createLeaderboardsClient({ baseUrl, authenticate: async () => signedInit({ id, name: `Isolated player ${id}` }), sessionStorage: null, now: () => baseTime }));
  }
  for (const client of clients) {
    await client.bootstrap();
    assert.equal(client.signedIn, true);
    const descriptor = campaign(), clientAttemptId = randomUUID();
    const registered = await client.register('campaign', descriptor, clientAttemptId);
    const registeredAgain = await client.register('campaign', descriptor, clientAttemptId);
    assert.equal(registeredAgain.runId, registered.runId);
    const attempt = { levelId: descriptor.levelId, seed: descriptor.seed, actions: campaignActions, assisted: true };
    const first = await client.submit(registered.runId, attempt);
    const duplicate = await client.submit(registered.runId, attempt);
    assert.deepEqual(duplicate.receipt, first.receipt);
  }
  const campaignList = await clients[0].list('campaign');
  assert.equal(campaignList.rows.length, 2);
  assert.deepEqual(campaignList.rows.map(row => row.rank), [1, 1]);
  assert.ok(campaignList.rows.every(row => row.completedLevels === 1 && row.stars >= 1));
  assert.equal(campaignList.ownRow.playerId, clients[0].player.playerId);
  const descriptor = daily();
  const registered = await clients[1].register('daily', descriptor, randomUUID());
  await clients[1].submit(registered.runId, { levelId: descriptor.levelId, seed: descriptor.seed, actions: dailyActions, assisted: false });
  const dailyList = await clients[1].list('daily', '2026-01-01');
  assert.equal(dailyList.rows.length, 1);
  assert.equal(dailyList.ownRow.moves, dailyActions.length);
  const guest = createLeaderboardsClient({ baseUrl, sessionStorage: null, now: () => baseTime });
  clients.push(guest);
  const publicList = await guest.list('campaign');
  assert.equal(publicList.rows.length, 2);
  assert.equal(publicList.ownRow, null);
  console.log('Client/API contract passed: two isolated identities, real SQLite/workers, campaign ties, daily replay, ownRow, public reads and idempotent retry.');
} finally {
  for (const client of clients) client.dispose();
  await app?.close();
  if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('magnet-leaderboards-contract-')) throw Error('Unexpected test output directory');
  await rm(directory, { recursive: true, force: true });
}
