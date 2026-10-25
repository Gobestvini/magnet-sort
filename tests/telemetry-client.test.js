import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry, createBrowserTelemetry, TELEMETRY_STORAGE_PREFIX } from '../src/telemetry/client.js';

const initialTime = Date.parse('2026-10-25T12:00:00Z');
function memory() { const values = new Map(); return { values, get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
  getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }
function harness(overrides = {}) {
  let clock = initialTime, calls = 0;
  const storage = memory(), sends = [];
  const options = { endpoint: 'https://example.test/analytics/events', platform: 'web', build: 'abc123', environment: 'production',
    storage, now: () => clock, id: () => `00000000-0000-4000-8000-${String(++calls).padStart(12, '0')}`,
    send: async payload => { sends.push(payload); return true; }, ...overrides };
  return { options, storage, sends, create: () => createTelemetry(options), advance: ms => { clock += ms; }, idCalls: () => calls };
}

test('telemetry creates no identifiers and sends nothing before explicit opt-in', async () => {
  const h = harness(), telemetry = h.create();
  assert.equal(telemetry.consent(), false);
  assert.equal(telemetry.track('ms_game_ready'), false);
  assert.equal((await telemetry.flush()).status, 'disabled');
  assert.equal(h.idCalls(), 0); assert.deepEqual(h.sends, []); assert.equal(h.storage.values.size, 0);
  await telemetry.setConsent(true);
  assert.equal(h.idCalls(), 0, 'consent alone need not create tracking identity');
  assert.equal(telemetry.track('not_a_game_event'), false);
  assert.equal(h.idCalls(), 0);
  telemetry.dispose();
});

test('only allowlisted game facts are sent and caller cannot spoof fixed platform context', async () => {
  const h = harness(), telemetry = h.create(); await telemetry.setConsent(true);
  assert.equal(telemetry.track('ms_attempt_started', { attemptId: 'run-1', mode: 'campaign', levelId: 'level-1',
    url: 'https://private.test/?token=secret', initData: 'secret', userId: 123, price: 999, platform: 'fake',
    reason: 'raw error with private words', assisted: false, moves: -1, constructor: 'bad' }), true);
  await telemetry.flush();
  const event = h.sends[0].events[0];
  assert.deepEqual(event.properties, { attemptId: 'run-1', mode: 'campaign', levelId: 'level-1', assisted: false,
    platform: 'web', build: 'abc123', environment: 'production' });
  assert.equal(JSON.stringify(h.sends).includes('secret'), false);
  assert.equal(telemetry.snapshot().queued, 0); telemetry.dispose();
});

test('retry preserves exact event ids and does not resend successful batches', async () => {
  const sends = []; let fail = true;
  const h = harness({ send: async payload => { sends.push(structuredClone(payload)); return !fail; } }), telemetry = h.create();
  await telemetry.setConsent(true); telemetry.track('ms_game_ready', {}, 'ready');
  assert.equal(telemetry.track('ms_game_ready', {}, 'ready'), false);
  assert.equal((await telemetry.flush()).status, 'error');
  assert.equal(telemetry.snapshot().queued, 1);
  assert.equal((await telemetry.flush()).status, 'retry-later');
  fail = false; h.advance(2_000);
  assert.equal((await telemetry.flush()).status, 'ok');
  assert.deepEqual(sends[0], sends[1]);
  assert.equal((await telemetry.flush()).status, 'empty'); assert.equal(sends.length, 2);
  telemetry.dispose();
});

test('revoke aborts flight, clears stored identifiers and uses separate deletion credential', async () => {
  let resolveSend, signal, deletion;
  const h = harness({ send: async (_payload, abortSignal) => { signal = abortSignal; return new Promise(resolve => { resolveSend = resolve; }); },
    erase: async data => { deletion = data; return true; } });
  const telemetry = h.create(); await telemetry.setConsent(true); telemetry.track('ms_game_ready');
  const send = telemetry.flush(); assert.equal(telemetry.snapshot().flight, true);
  const result = await telemetry.setConsent(false);
  assert.equal(signal.aborted, true); assert.deepEqual(result, { deleted: true });
  assert.equal(telemetry.consent(), false); assert.equal(telemetry.snapshot().queued, 0);
  assert.equal(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'state'), null);
  assert.equal(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'consent'), 'no');
  assert.match(deletion.visitorId, /^[0-9a-f-]{36}$/); assert.equal(deletion.deletionToken.length, 72);
  assert.notEqual(deletion.visitorId, deletion.deletionToken);
  resolveSend(true); assert.equal((await send).status, 'cancelled');
  assert.equal(telemetry.track('ms_game_ready'), false); telemetry.dispose();
});

test('erase failure is reported without re-enabling analytics or retaining local IDs', async () => {
  const h = harness({ erase: async () => { throw Error('offline'); } }), telemetry = h.create();
  await telemetry.setConsent(true); telemetry.track('ms_game_ready');
  assert.deepEqual(await telemetry.setConsent(false), { deleted: false, reason: 'erase-unavailable' });
  assert.equal(telemetry.consent(), false); assert.equal(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'state'), null);
  telemetry.dispose();
});

test('revoke in one tab disables track and flush in another without new IDs or resurrecting state', async () => {
  const h = harness({ erase: async () => true });
  const first = h.create(); await first.setConsent(true); first.track('ms_game_ready');
  const second = h.create(); second.track('ms_attempt_started', { attemptId: 'run-2' });
  const previousCalls = h.idCalls();
  await first.setConsent(false);
  assert.equal(second.track('ms_move_accepted', { moves: 1 }), false);
  assert.equal((await second.flush()).status, 'disabled');
  assert.equal(second.consent(), false); assert.equal(second.snapshot().queued, 0);
  assert.equal(h.idCalls(), previousCalls); assert.equal(h.sends.length, 0);
  assert.equal(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'state'), null);
  await first.setConsent(true);
  assert.equal(second.syncConsent(), false, 'external opt-in never silently re-enables a running opted-out instance');
  first.dispose(); second.dispose();
});

test('storage consent synchronization aborts a second-tab in-flight request', async () => {
  let resolveSend, signal;
  const h = harness({ send: async (_payload, abortSignal) => { signal = abortSignal; return new Promise(resolve => { resolveSend = resolve; }); },
    erase: async () => true });
  const first = h.create(); await first.setConsent(true); first.track('ms_game_ready');
  const second = h.create(), pending = second.flush();
  await first.setConsent(false);
  assert.equal(second.syncConsent(), false); assert.equal(signal.aborted, true);
  resolveSend(true); assert.equal((await pending).status, 'cancelled');
  assert.equal(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'state'), null);
  first.dispose(); second.dispose();
});

test('canonical ad completion and purchase error events survive the allowlist', async () => {
  const h = harness(), telemetry = h.create(); await telemetry.setConsent(true);
  assert.equal(telemetry.track('ms_ad_completed', { placement: 'between-levels', provider: 'poki' }), true);
  assert.equal(telemetry.track('ms_purchase_error', { productId: 'starter', reason: 'cancelled' }), true);
  await telemetry.flush();
  assert.deepEqual(h.sends[0].events.map(event => event.name), ['ms_ad_completed', 'ms_purchase_error']);
  telemetry.dispose();
});

test('two live clients and a later reload never lose the other tab pending event', async () => {
  const delivered = new Map(), pending = [];
  const h = harness({ send: async payload => {
    pending.push(structuredClone(payload));
    for (const event of payload.events) delivered.set(event.id, event.name);
    return true;
  } });
  const first = h.create(); await first.setConsent(true); first.track('ms_game_ready');
  const second = h.create(); second.track('ms_first_move', { attemptId: 'second-run' });
  await first.flush();
  first.dispose(); second.dispose();
  const afterReload = h.create(); await afterReload.flush();
  assert.deepEqual([...delivered.values()].sort(), ['ms_first_move', 'ms_game_ready']);
  assert.equal(afterReload.snapshot().queued, 0);
  assert.equal([...h.storage.values.keys()].some(key => key.startsWith(TELEMETRY_STORAGE_PREFIX + 'pending:')), false);
  afterReload.dispose();
});

test('acknowledging A while B appends preserves B across reload without shared-array overwrite', async () => {
  let finishFirst;
  const delivered = new Map(); let sends = 0;
  const h = harness({ send: async payload => {
    sends++;
    for (const event of payload.events) delivered.set(event.id, event.name);
    if (sends === 1) await new Promise(resolve => { finishFirst = resolve; });
    return true;
  } });
  const first = h.create(); await first.setConsent(true); first.track('ms_game_ready');
  const firstFlight = first.flush();
  const second = h.create(); second.track('ms_first_move', { attemptId: 'second-run' });
  finishFirst(); await firstFlight;
  first.dispose(); second.dispose();
  const afterReload = h.create(); assert.equal((await afterReload.flush()).sent, 1);
  assert.deepEqual([...delivered.values()].sort(), ['ms_first_move', 'ms_game_ready']);
  assert.equal(afterReload.snapshot().queued, 0); afterReload.dispose();
});

test('reduced non-enumerable StorageLike merges pending arrays and acknowledges only its sent IDs', async () => {
  const shared = memory(), delivered = new Map();
  const reduced = { getItem: shared.getItem, setItem: shared.setItem, removeItem: shared.removeItem };
  const h = harness({ storage: reduced, send: async payload => { for (const event of payload.events) delivered.set(event.id, event.name); return true; } });
  const first = h.create(); await first.setConsent(true); first.track('ms_game_ready');
  const second = h.create(); second.track('ms_first_move');
  await first.flush(); first.dispose(); second.dispose();
  const afterReload = h.create(); await afterReload.flush();
  assert.deepEqual([...delivered.values()].sort(), ['ms_first_move', 'ms_game_ready']); afterReload.dispose();
});

test('bounded queue restores opted-in unsent events, expires old events, and rotates idle session', async () => {
  const h = harness(); let telemetry = h.create(); await telemetry.setConsent(true);
  for (let i = 0; i < 205; i++) telemetry.track('ms_move_accepted', { moves: i });
  assert.equal(telemetry.snapshot().queued, 200);
  const saved = JSON.parse(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'state'));
  const pending = [...h.storage.values].filter(([key]) => key.startsWith(TELEMETRY_STORAGE_PREFIX + 'pending:')).map(([, value]) => JSON.parse(value).event)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  assert.equal(pending[0].properties.moves, 5);
  const firstSession = saved.sessionId; telemetry.dispose();
  telemetry = h.create(); assert.equal(telemetry.consent(), true);
  assert.equal((await telemetry.flush()).sent, 20);
  assert.equal(h.sends[0].events[0].id, pending[0].id);
  h.advance(1_800_000); telemetry.track('ms_session_started');
  const rotated = JSON.parse(h.storage.getItem(TELEMETRY_STORAGE_PREFIX + 'state'));
  assert.notEqual(rotated.sessionId, firstSession);
  h.advance(86_400_001); await telemetry.flush(); assert.equal(telemetry.snapshot().queued, 0);
  telemetry.dispose();
});

test('storage denial and disposed lifecycle do not break play', async () => {
  const storage = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  const h = harness({ storage }), telemetry = createBrowserTelemetry(h.options);
  await telemetry.setConsent(true); assert.equal(telemetry.track('ms_game_ready'), true);
  await telemetry.flush(); assert.equal(h.sends.length, 1);
  telemetry.dispose(); assert.equal(telemetry.track('ms_game_ready'), false);
  assert.equal((await telemetry.flush()).status, 'disabled');
  assert.deepEqual(await telemetry.setConsent(true), { deleted: false, reason: 'disposed' });
});
