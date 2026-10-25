import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTelemetryService } from '../server/telemetry.mjs';

const DAY = 86_400_000, start = Date.parse('2026-10-01T12:00:00Z');
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const token = number => uuid(number) + uuid(number + 1);
function packet({ timestamp = start, visitor = 1, id = 100, environment = 'production', platform = 'web', properties = {}, name = 'ms_game_ready' } = {}) {
  return { schemaVersion: 1, deletionToken: token(visitor + 1), events: [{ id: uuid(id), name,
    timestamp: new Date(timestamp).toISOString(), visitorId: uuid(visitor), sessionId: uuid(visitor + 10),
    properties: { platform, build: 'test-build', environment, ...properties } }] };
}

test('ingestion persists across reopen, deduplicates retry and separates QA/platform summaries', () => {
  const directory = mkdtempSync(join(tmpdir(), 'magnet-telemetry-'));
  const storagePath = join(directory, 'telemetry.sqlite'); let service;
  try {
    service = createTelemetryService({ storagePath, now: () => start });
    assert.deepEqual(service.ingest(packet()), { accepted: 1, duplicates: 0, rejected: 0 });
    assert.deepEqual(service.ingest(packet()), { accepted: 0, duplicates: 1, rejected: 0 });
    service.ingest(packet({ visitor: 2, id: 101, environment: 'qa' }));
    service.ingest(packet({ visitor: 3, id: 102, platform: 'telegram' }));
    service.close(); service = createTelemetryService({ storagePath, now: () => start });
    assert.equal(service.summary({ from: '2026-10-01', to: '2026-10-01' }).totals.activePlayers, 2);
    assert.equal(service.summary({ from: '2026-10-01', to: '2026-10-01', environment: 'qa' }).totals.events, 1);
    assert.equal(service.summary({ from: '2026-10-01', to: '2026-10-01', platform: 'telegram' }).totals.activePlayers, 1);
    assert.equal(JSON.stringify(service.summary()).includes(uuid(1)), false, 'summary cannot expose raw tracking IDs');
  } finally { service?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('malformed, future, stale and unexpected private fields are rejected atomically', () => {
  const service = createTelemetryService({ now: () => start });
  try {
    const privateEvent = packet(); privateEvent.events[0].properties.initData = 'secret';
    const wrongRoot = packet(); wrongRoot.url = 'https://private.test/';
    const mixed = packet(); mixed.events.push(packet({ visitor: 2, id: 200 }).events[0]);
    const nonCanonical = packet(); nonCanonical.events[0].timestamp = 'October 1, 2026 12:00 GMT (private text)';
    for (const value of [null, {}, privateEvent, wrongRoot, mixed, nonCanonical, packet({ timestamp: start + 300_001 }), packet({ timestamp: start - DAY - 1 })]) {
      assert.throws(() => service.ingest(value), error => error.status === 400);
    }
    const large = packet(); large.events = Array.from({ length: 21 }, (_, index) => packet({ id: index }).events[0]);
    assert.throws(() => service.ingest(large), error => error.status === 400);
    assert.equal(service.summary().totals.events, 0);
    assert.throws(() => service.summary({ from: '2026-02-30' }), error => error.status === 400);
  } finally { service.close(); }
});

test('ingestion budget rejects whole batch without partial writes', () => {
  const service = createTelemetryService({ now: () => start, maxEventsPerDay: 1 });
  try {
    const batch = packet(); batch.events.push(packet({ id: 101 }).events[0]);
    assert.throws(() => service.ingest(batch), error => error.status === 429);
    assert.equal(service.summary().totals.events, 0);
    service.ingest(packet());
    assert.throws(() => service.ingest(packet({ id: 102 })), error => error.status === 429);
    assert.equal(service.summary().totals.events, 1);
  } finally { service.close(); }
});

test('final observed attempt outcomes count lost then Undo then won once, even with tied timestamps and reordered delivery', () => {
  const service = createTelemetryService({ now: () => start });
  const observed = (id, name, sequence, outcome) => packet({ id, name, properties: {
    attemptId: 'logical-attempt-1', mode: 'campaign', observationSequence: sequence, ...(outcome ? { outcome } : {}),
  } });
  try {
    service.ingest(observed(100, 'ms_attempt_completed', 1, 'lost'));
    assert.deepEqual(service.summary().outcomes.map(row => ({ ...row })), [{ mode: 'campaign', outcome: 'lost', attempts: 1 }]);
    service.ingest(observed(102, 'ms_attempt_completed', 3, 'won'));
    service.ingest(observed(101, 'ms_undo_used', 2));
    assert.deepEqual(service.summary().outcomes.map(row => ({ ...row })), [{ mode: 'campaign', outcome: 'won', attempts: 1 }]);
    assert.equal(service.summary().totals.events, 3, 'raw event volume remains separately observable');
  } finally { service.close(); }
});

test('lost followed by Undo is unfinished and terminal events without attempt identity are excluded', () => {
  let clock = start;
  const service = createTelemetryService({ now: () => clock });
  try {
    service.ingest(packet({ name: 'ms_attempt_completed', properties: { attemptId: 'retryable', mode: 'daily', outcome: 'lost' } }));
    clock++;
    service.ingest(packet({ id: 101, name: 'ms_undo_used', timestamp: clock, properties: { attemptId: 'retryable', mode: 'daily' } }));
    assert.deepEqual(service.summary().outcomes, []);
    service.ingest(packet({ id: 102, name: 'ms_attempt_completed', timestamp: clock, properties: { mode: 'daily', outcome: 'won' } }));
    assert.deepEqual(service.summary().outcomes, []);
    assert.equal(service.summary().events.find(event => event.name === 'ms_attempt_completed').count, 2);
    service.ingest(packet({ visitor: 2, id: 103, timestamp: clock, name: 'ms_attempt_completed',
      properties: { attemptId: 'retryable', mode: 'daily', outcome: 'won' } }));
    assert.deepEqual(service.summary().outcomes.map(row => ({ ...row })), [{ mode: 'daily', outcome: 'won', attempts: 1 }],
      'separate visitors with the same attempt label cannot invalidate each other');
  } finally { service.close(); }
});

test('deletion requires a distinct credential and prevents in-flight request resurrection', () => {
  const service = createTelemetryService({ now: () => start });
  try {
    service.ingest(packet());
    assert.throws(() => service.deleteVisitor(uuid(1), token(80)), error => error.status === 403);
    assert.throws(() => service.ingest({ ...packet({ id: 103 }), deletionToken: token(80) }), error => error.status === 403);
    assert.deepEqual(service.deleteVisitor(uuid(1), token(2)), { deleted: true, removed: 1 });
    assert.equal(service.summary().totals.events, 0);
    assert.throws(() => service.ingest(packet()), error => error.status === 410);
    assert.deepEqual(service.deleteVisitor(uuid(1), token(2)), { deleted: true, removed: 0 });
    service.deleteVisitor(uuid(5), token(6));
    assert.throws(() => service.ingest(packet({ visitor: 5 })), error => error.status === 410);
  } finally { service.close(); }
});

test('retention uses mature UTC cohorts, exact-day returns and independent QA history', () => {
  let clock = start; const service = createTelemetryService({ now: () => clock });
  const add = (day, visitor, id, environment = 'production') => {
    clock = start + day * DAY; service.ingest(packet({ timestamp: clock, visitor, id, environment }));
  };
  try {
    add(0, 1, 100); add(0, 2, 101); add(0, 3, 102, 'qa');
    add(1, 1, 103); add(1, 3, 104);
    clock = start + 2 * DAY;
    let summary = service.summary({ from: '2026-10-01', to: '2026-10-01' });
    assert.deepEqual(summary.retention[0], { day: 1, eligiblePlayers: 2, returningPlayers: 1, rate: 0.5 });
    assert.equal(summary.retention[1].rate, null);
    add(7, 1, 105); clock = start + 8 * DAY;
    summary = service.summary({ from: '2026-10-01', to: '2026-10-01' });
    assert.deepEqual(summary.retention[1], { day: 7, eligiblePlayers: 2, returningPlayers: 1, rate: 0.5 });
    const fresh = service.summary({ from: '2026-10-02', to: '2026-10-02' });
    assert.equal(fresh.retention[0].eligiblePlayers, 1, 'QA-only first day does not contaminate production cohort');
  } finally { service.close(); }
});

test('retention pruning bounds events without reclassifying continuing older visitors as new', () => {
  let clock = start; const service = createTelemetryService({ now: () => clock, retentionDays: 8 });
  try {
    service.ingest(packet());
    clock = start + 7 * DAY; service.ingest(packet({ timestamp: clock, id: 101 }));
    clock = start + 9 * DAY; service.ingest(packet({ timestamp: clock, id: 102 }));
    const summary = service.summary({ from: '2026-10-08', to: '2026-10-10' });
    assert.equal(summary.totals.events, 2);
    assert.equal(summary.retention[0].eligiblePlayers, 0, 'first-ever day stays Oct1 while visitor remains active');
    const oldCohort = service.summary({ from: '2026-10-01', to: '2026-10-01' });
    assert.equal(oldCohort.retention[1].rate, null, 'expired observation periods never turn into false zero retention');
  } finally { service.close(); }
});
