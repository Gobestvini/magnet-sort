import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../leaderboards/http.mjs';
import { keys, signedInit, baseTime, campaign, campaignActions, daily, dailyActions, attemptId } from './helpers.mjs';

async function setup(t, options = {}) {
  let now = baseTime; const logs = [];
  const app = createApp({ clock: () => now, authOptions: { publicKey: keys.publicKey }, verifyDaily: false, logger: event => logs.push(event), ...options });
  await app.ready; await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close()); const base = `http://127.0.0.1:${app.server.address().port}/v1`;
  async function request(path, { method = 'GET', token, body, raw, headers = {} } = {}) {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    return { status: response.status, headers: response.headers, value: response.status === 204 ? null : await response.json() };
  }
  async function auth(id = 101) { const response = await request('/auth/telegram', { method: 'POST', body: { initData: signedInit({ id, now }) } }); assert.equal(response.status, 200); return response.value; }
  async function register(token, mode = 'campaign', descriptor = campaign(), id = attemptId()) {
    const response = await request('/runs', { method: 'POST', token, body: { clientAttemptId: id, mode, descriptor, publishConsent: true } }); assert.equal(response.status, 200); return response.value;
  }
  return { app, logs, request, auth, register, base, tick: millis => { now += millis; } };
}
test('HTTP auth, both rankings, native worker concurrency, canonical stats and deletion', async t => {
  const { request, auth, register, tick } = await setup(t);
  const a = await auth(), b = await auth(202), run = await register(a.token);
  const post = token => request(`/runs/${run.runId}/result`, { method: 'POST', token, body: { actions: campaignActions, assisted: true } });
  assert.equal((await post(b.token)).status, 404);
  const [one, retry] = await Promise.all([post(a.token), post(a.token)]);
  assert.equal(one.status, 200); assert.deepEqual(one.value, retry.value); assert.equal(one.value.metrics.moves, campaignActions.length);
  assert.equal(one.value.personalBest.completedLevels, 1);
  const other = await register(b.token);
  assert.equal((await request(`/runs/${other.runId}/result`, { method: 'POST', token: b.token, body: { actions: campaignActions, assisted: false } })).status, 200);
  const board = await request('/leaderboards/campaign', { token: a.token }); assert.equal(board.value.rows.length, 2); assert.deepEqual(board.value.rows.map(row => row.rank), [1,1]); assert.equal(board.value.ownRow.completedLevels, 1);
  tick(60000);
  const dayRun = await register(a.token, 'daily', daily());
  const result = await request(`/runs/${dayRun.runId}/result`, { method: 'POST', token: a.token, body: { actions: dailyActions, assisted: false } }); assert.equal(result.status, 200);
  const dayBoard = await request('/leaderboards/daily?date=2026-01-01', { token: a.token }); assert.equal(dayBoard.value.ownRow.moves, dailyActions.length); assert.equal(dayBoard.value.date, '2026-01-01');
  assert.equal((await request('/capabilities')).value.daily, true);
  assert.equal((await request('/me', { method: 'DELETE', token: a.token, body: { confirm: 'delete-leaderboards' } })).status, 200);
  assert.equal((await request('/leaderboards/campaign', { token: a.token })).status, 401);
  assert.equal((await request('/leaderboards/campaign')).value.rows.length, 1);
});
test('invalid auth/body/origin/replay/stats/version cannot write and logs redact inputs', async t => {
  const { app, request, auth, register, tick, logs } = await setup(t);
  assert.equal((await request('/auth/telegram', { method: 'POST', body: { initData: 'not-signed' } })).status, 401);
  assert.equal((await request('/auth/telegram', { method: 'POST', raw: '{"initData":"x","initData":"y"}' })).status, 400);
  assert.equal((await request('/auth/telegram', { method: 'POST', raw: Buffer.from([0xff]) })).status, 400);
  assert.equal((await request('/health/live', { headers: { Origin: 'null' } })).status, 403);
  const cors = await request('/health/live', { headers: { Origin: 'https://play.plusvibegames.com' } }); assert.equal(cors.headers.get('access-control-allow-origin'), 'https://play.plusvibegames.com'); assert.equal(cors.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/auth/telegram', { method: 'POST', raw: 'x'.repeat(16385) })).status, 413);
  const account = await auth(), run = await register(account.token);
  let invalid = await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: { actions: campaignActions, assisted: false, stars: 999 } }); assert.equal(invalid.status, 400);
  invalid = await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: { actions: [], assisted: false } }); assert.equal(invalid.status, 422);
  invalid = await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: { actions: [{ type: 'placeMagnet', color: 'wrong', cell: { col: 1,row: 1 } }], assisted: false } }); assert.equal(invalid.status, 422);
  assert.equal(app.store.db.prepare('SELECT count(*) AS total FROM submissions').get().total, 0);
  tick(60000);
  assert.equal((await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: { actions: Array(2049).fill(campaignActions[0]), assisted: false } })).status, 413);
  assert.equal((await request('/leaderboards/campaign?contentVersion=wrong')).status, 409);
  assert.equal((await request('/leaderboards/daily?date=2026-01-01&date=2026-01-02')).status, 400);
  assert(!JSON.stringify(logs).includes(account.token)); assert(!JSON.stringify(logs).includes('initData')); assert(!JSON.stringify(logs).includes('Fixture'));
});
test('receipt survives run expiry with a fresh bearer and midnight never registers yesterday', async t => {
  const { request, auth, register, tick } = await setup(t);
  let account = await auth(); const run = await register(account.token);
  const payload = { actions: campaignActions, assisted: false };
  const accepted = await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: payload }); assert.equal(accepted.status, 200);
  tick(3 * 86400000); account = await auth();
  const retry = await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: payload }); assert.equal(retry.status, 200); assert.deepEqual(retry.value.receipt, accepted.value.receipt);
  const conflict = await request(`/runs/${run.runId}/result`, { method: 'POST', token: account.token, body: { ...payload, actions: campaignActions.slice(1) } }); assert.equal(conflict.status, 409);
  const oldDay = await request('/runs', { method: 'POST', token: account.token, body: { clientAttemptId: attemptId(), mode: 'daily', descriptor: daily(), publishConsent: true } }); assert.equal(oldDay.status, 409); assert.equal(oldDay.value.error.code, 'DAILY_DATE_CHANGED');
});
test('chunked input limit and body deadline bound incomplete requests', async t => {
  const { base } = await setup(t, { bodyMs: 100 });
  async function raw(chunks, end) {
    const url = new URL(base + '/auth/telegram');
    return new Promise((resolve, reject) => {
      const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, data })); });
      req.on('error', reject); for (const chunk of chunks) req.write(chunk); if (end) req.end();
    });
  }
  assert.equal((await raw(['x'.repeat(17000)], true)).status, 413);
  assert.equal((await raw(['{'], false)).status, 408);
});
test('busy replay workers leave HTTP health/auth responsive; forwarded headers cannot bypass global auth rate', async t => {
  const { app, request, auth } = await setup(t, { poolOptions: { workerUrl: new URL('./worker-fixture.mjs', import.meta.url), activeMs: 100 } });
  const busy = [app.pool.run({ hang: true }).catch(error => error.code), app.pool.run({ hang: true }).catch(error => error.code)];
  assert.equal((await request('/health/live')).status, 200);
  assert((await auth()).token);
  for (let index = 0; index < 9; index++) assert.equal((await request('/auth/telegram', { method: 'POST', body: { initData: '' }, headers: { 'X-Forwarded-For': `192.0.2.${index}` } })).status, 401);
  const denied = await request('/auth/telegram', { method: 'POST', body: { initData: '' }, headers: { 'X-Forwarded-For': '198.51.100.1' } });
  assert.equal(denied.status, 429); assert(denied.headers.get('retry-after'));
  assert.deepEqual(await Promise.all(busy), ['REPLAY_TIMEOUT','REPLAY_TIMEOUT']);
});
