import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createStore, checkDatabase } from '../leaderboards/store.mjs';
import { backupDatabase } from '../leaderboards/backup.mjs';
import { verifySnapshot } from '../leaderboards/restore-check.mjs';
import { DAY } from '../leaderboards/config.mjs';
import { digestReplay } from '../leaderboards/profiles.mjs';
import { baseTime, campaign, daily, attemptId } from './helpers.mjs';
const identity = id => ({ telegramId: String(id), displayName: 'Fixture ' + id });
function accepted(store, playerId, descriptor = campaign(), metrics = { moves: 7, stars: 2, cleared: 50 }, mode = 'campaign') {
  const run = store.register(playerId, attemptId(), mode, descriptor), digest = digestReplay(mode, descriptor, []);
  return { run, digest, response: store.commit(playerId, run.runId, digest, metrics, [], false) };
}
test('native DB sessions hash tokens, expire and cap account sessions', () => {
  let now = baseTime; const store = createStore(':memory:', { clock: () => now });
  try {
    let first, latest;
    for (let index = 0; index < 11; index++) { latest = store.issueSession(identity(1)); first ??= latest; now++; }
    assert.equal(store.db.prepare('SELECT count(*) AS total FROM sessions').get().total, 10);
    assert.equal(store.db.prepare('SELECT count(*) AS total FROM sessions WHERE token_hash=?').get(latest.token).total, 0);
    assert.throws(() => store.session(first.token)); assert.equal(store.session(latest.token).playerId, latest.player.playerId);
    now += DAY; assert.throws(() => store.session(latest.token));
    assert.equal(checkDatabase(store.db).sqliteVersion, '3.53.4');
  } finally { store.close(); }
});
test('campaign best/ties/deletion and receipt retry after active expiry survive persistence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magnet-server-')); let now = baseTime, store = createStore(join(dir, 'live.sqlite'), { clock: () => now });
  try {
    const a = store.issueSession(identity(1)).player.playerId, b = store.issueSession(identity(2)).player.playerId;
    const saved = accepted(store, a); accepted(store, b); accepted(store, a, campaign(1), { moves: 8, stars: 1, cleared: 50 });
    let board = store.leaderboard('campaign', {}, a);
    assert.deepEqual(board.rows.map(row => row.rank), [1,1]); assert.equal(board.ownRow.completedLevels, 1); assert.equal(board.ownRow.stars, 2);
    accepted(store, a, campaign(2), { moves: 4, stars: 3, cleared: 50 }); board = store.leaderboard('campaign', {}, a); assert.equal(board.ownRow.stars, 3);
    now += 3 * DAY;
    assert.deepEqual(store.inspect(a, saved.run.runId, saved.digest).accepted, saved.response);
    assert.throws(() => store.inspect(a, saved.run.runId, 'different'), /RESULT_CONFLICT/);
    await backupDatabase(store.path, join(dir, 'snapshot.sqlite')); assert.equal(verifySnapshot(join(dir, 'snapshot.sqlite')).acceptedRuns, 4);
    assert.throws(() => store.inspect(b, saved.run.runId, saved.digest), /RUN_NOT_FOUND/);
    store.close(); store = createStore(join(dir, 'snapshot.sqlite'), { clock: () => now });
    assert.equal(store.leaderboard('campaign', {}, a).ownRow.stars, 3);
    now = baseTime + 31 * DAY; store.cleanup(); assert.equal(store.db.prepare('SELECT count(*) AS total FROM submissions WHERE actions_json IS NOT NULL').get().total, 0);
    assert.deepEqual(store.inspect(a, saved.run.runId, saved.digest).accepted, saved.response);
    now = baseTime + 91 * DAY; store.cleanup(); assert.equal(store.leaderboard('campaign', {}, a).ownRow.stars, 3);
    assert.equal(store.db.prepare('SELECT count(*) AS total FROM runs').get().total, 0);
    store.deletePlayer(a); assert.equal(store.leaderboard('campaign', {}, a).ownRow, null); assert.equal(store.leaderboard('campaign', {}).rows.length, 1);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('daily midnight, best and registration idempotency preserve the server day', () => {
  let now = baseTime; const store = createStore(':memory:', { clock: () => now });
  try {
    const player = store.issueSession(identity(1)).player.playerId, clientId = attemptId(), descriptor = daily();
    const first = store.register(player, clientId, 'daily', descriptor);
    now += DAY;
    assert.deepEqual(store.register(player, clientId, 'daily', descriptor), first);
    assert.throws(() => store.register(player, attemptId(), 'daily', descriptor), /DAILY_DATE_CHANGED/);
    const digest = digestReplay('daily', descriptor, []);
    store.commit(player, first.runId, digest, { moves: 7, stars: 2, cleared: 40 }, [], true);
    const result = store.leaderboard('daily', { date: '2026-01-01' }, player); assert.equal(result.ownRow.moves, 7);
    now += DAY; assert(store.inspect(player, first.runId, digest).accepted);
    assert.throws(() => store.register(player, clientId, 'campaign', campaign()), /ATTEMPT_CONFLICT/);
  } finally { store.close(); }
});
test('own row outside Top50 is computed on the same read snapshot', () => {
  const store = createStore();
  try {
    let own;
    for (let n = 1; n <= 55; n++) {
      const id = store.issueSession(identity(n)).player.playerId;
      accepted(store, id, campaign(0, 1), { moves: 7, stars: n === 55 ? 1 : 3, cleared: 50 }); if (n === 55) own = id;
    }
    const value = store.leaderboard('campaign', {}, own); assert.equal(value.rows.length, 50); assert.equal(value.ownRow.rank, 55);
  } finally { store.close(); }
});
test('unknown schema fails closed and backup refuses live overwrite/existing destination', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'magnet-schema-')), path = join(dir, 'bad.sqlite');
  const raw = new Database(path); raw.exec('CREATE TABLE unrelated(id)'); raw.close();
  try {
    assert.throws(() => createStore(path), /Unknown database schema/);
    const store = createStore(join(dir, 'live.sqlite'));
    try { await assert.rejects(backupDatabase(store.path, store.path)); await backupDatabase(store.path, join(dir, 'ok.sqlite')); await assert.rejects(backupDatabase(store.path, join(dir, 'ok.sqlite'))); }
    finally { store.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
