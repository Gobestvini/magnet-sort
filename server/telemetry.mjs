import { DatabaseSync } from 'node:sqlite';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TELEMETRY_SCHEMA_VERSION, TELEMETRY_MAX_BATCH, isTelemetryId, isDeletionToken,
  validateTelemetryEvent } from '../src/telemetry/schema.js';

const DAY_MS = 86_400_000;
const hash = value => createHash('sha256').update(value).digest('hex');
const dayOf = value => new Date(value).toISOString().slice(0, 10);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function failure(status, code) { return Object.assign(new Error(code), { status, code }); }
function validDay(day) { return typeof day === 'string' && datePattern.test(day) && Number.isFinite(Date.parse(day)) && dayOf(Date.parse(day)) === day; }
const sameHash = (a, b) => timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

// HTTP routing, origin checks, body size limits and admin authentication belong
// to the service entry. This module never receives or stores an IP/profile.
export function createTelemetryService({ storagePath = ':memory:', now = Date.now,
  maxEventsPerDay = 100_000, maxSessionsPerDay = 20_000, maxEventsPerVisitorPerDay = 3_000,
  retentionDays = 35 } = {}) {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 8 || retentionDays > 90) throw failure(500, 'invalid-retention');
  if (storagePath !== ':memory:') mkdirSync(dirname(storagePath), { recursive: true });
  const db = new DatabaseSync(storagePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS telemetry_visitors (
      visitor_hash TEXT PRIMARY KEY, deletion_hash TEXT NOT NULL, first_day TEXT NOT NULL, last_seen INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS telemetry_events (
      id TEXT PRIMARY KEY, visitor_hash TEXT NOT NULL, session_hash TEXT NOT NULL,
      name TEXT NOT NULL, timestamp TEXT NOT NULL, event_day TEXT NOT NULL, received_at INTEGER NOT NULL,
      environment TEXT NOT NULL, platform TEXT NOT NULL, build TEXT NOT NULL, properties TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS telemetry_daily ON telemetry_events(event_day,environment,platform);
    CREATE INDEX IF NOT EXISTS telemetry_visitor ON telemetry_events(visitor_hash,event_day);
    CREATE INDEX IF NOT EXISTS telemetry_received ON telemetry_events(received_at);
    CREATE INDEX IF NOT EXISTS telemetry_received_visitor ON telemetry_events(visitor_hash,received_at);
    CREATE INDEX IF NOT EXISTS telemetry_received_session ON telemetry_events(session_hash,received_at);
    CREATE TABLE IF NOT EXISTS telemetry_cohorts (
      visitor_hash TEXT NOT NULL, environment TEXT NOT NULL, platform TEXT NOT NULL,
      first_day TEXT NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY(visitor_hash,environment,platform));
    CREATE TABLE IF NOT EXISTS telemetry_deleted (
      visitor_hash TEXT PRIMARY KEY, deletion_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `);
  let closed = false;
  const assertOpen = () => { if (closed) throw failure(503, 'telemetry-closed'); };
  const transaction = run => { db.exec('BEGIN IMMEDIATE'); try { const value = run(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const eventExists = db.prepare('SELECT id FROM telemetry_events WHERE id=?');
  const visitorGet = db.prepare('SELECT deletion_hash FROM telemetry_visitors WHERE visitor_hash=?');
  const tombstoneGet = db.prepare('SELECT deletion_hash FROM telemetry_deleted WHERE visitor_hash=?');
  const eventInsert = db.prepare(`INSERT INTO telemetry_events
    (id,visitor_hash,session_hash,name,timestamp,event_day,received_at,environment,platform,build,properties)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const visitorUpsert = db.prepare(`INSERT INTO telemetry_visitors(visitor_hash,deletion_hash,first_day,last_seen)
    VALUES (?,?,?,?) ON CONFLICT(visitor_hash) DO UPDATE SET first_day=min(first_day,excluded.first_day),last_seen=excluded.last_seen`);

  function prune() {
    assertOpen();
    const cutoff = now() - retentionDays * DAY_MS;
    db.prepare('DELETE FROM telemetry_events WHERE received_at < ?').run(cutoff);
    db.prepare('DELETE FROM telemetry_visitors WHERE last_seen < ?').run(cutoff);
    db.prepare('DELETE FROM telemetry_cohorts WHERE last_seen < ?').run(cutoff);
    db.prepare('DELETE FROM telemetry_deleted WHERE expires_at < ?').run(now());
  }

  function ingest(payload) {
    assertOpen();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).some(key => !['schemaVersion', 'deletionToken', 'events'].includes(key)) ||
        payload.schemaVersion !== TELEMETRY_SCHEMA_VERSION || !isDeletionToken(payload.deletionToken) ||
        !Array.isArray(payload.events) || !payload.events.length || payload.events.length > TELEMETRY_MAX_BATCH) throw failure(400, 'invalid-telemetry-batch');
    if (Buffer.byteLength(JSON.stringify(payload)) > 32_768) throw failure(413, 'telemetry-batch-too-large');
    const timestamp = now();
    if (payload.events.some(event => !validateTelemetryEvent(event, timestamp)) || new Set(payload.events.map(event => event.visitorId)).size !== 1) throw failure(400, 'invalid-telemetry-event');
    prune();
    const visitorHash = hash(payload.events[0].visitorId), deletionHash = hash(payload.deletionToken);
    const visitor = visitorGet.get(visitorHash);
    if (visitor && !sameHash(visitor.deletion_hash, deletionHash)) throw failure(403, 'telemetry-credential-mismatch');
    if (tombstoneGet.get(visitorHash)) throw failure(410, 'telemetry-visitor-deleted');
    return transaction(() => {
      let accepted = 0, duplicates = 0;
      for (const event of payload.events) {
        if (eventExists.get(event.id)) { duplicates++; continue; }
        const receivedDay = dayOf(timestamp), eventDay = dayOf(Date.parse(event.timestamp));
        const dailyCount = db.prepare('SELECT count(*) AS n FROM telemetry_events WHERE received_at >= ?').get(Date.parse(receivedDay)).n;
        if (dailyCount >= maxEventsPerDay) throw failure(429, 'telemetry-daily-budget');
        const visitorCount = db.prepare('SELECT count(*) AS n FROM telemetry_events WHERE visitor_hash=? AND received_at >= ?').get(visitorHash, Date.parse(receivedDay)).n;
        if (visitorCount >= maxEventsPerVisitorPerDay) throw failure(429, 'telemetry-visitor-budget');
        const sessionHash = hash(event.sessionId);
        const knownSession = db.prepare('SELECT 1 FROM telemetry_events WHERE session_hash=? AND received_at >= ? LIMIT 1').get(sessionHash, Date.parse(receivedDay));
        if (!knownSession) {
          const sessions = db.prepare('SELECT count(DISTINCT session_hash) AS n FROM telemetry_events WHERE received_at >= ?').get(Date.parse(receivedDay)).n;
          if (sessions >= maxSessionsPerDay) throw failure(429, 'telemetry-session-budget');
        }
        visitorUpsert.run(visitorHash, deletionHash, eventDay, timestamp);
        const { environment, platform, build, ...properties } = event.properties;
        db.prepare(`INSERT INTO telemetry_cohorts(visitor_hash,environment,platform,first_day,last_seen) VALUES (?,?,?,?,?)
          ON CONFLICT(visitor_hash,environment,platform) DO UPDATE SET first_day=min(first_day,excluded.first_day),last_seen=excluded.last_seen`)
          .run(visitorHash,environment,platform,eventDay,timestamp);
        eventInsert.run(event.id, visitorHash, sessionHash, event.name, event.timestamp, eventDay,
          timestamp, environment, platform, build, JSON.stringify(properties));
        accepted++;
      }
      return { accepted, duplicates, rejected: 0 };
    });
  }

  function deleteVisitor(visitorId, deletionToken) {
    assertOpen();
    if (!isTelemetryId(visitorId) || !isDeletionToken(deletionToken)) throw failure(400, 'invalid-telemetry-deletion');
    const visitorHash = hash(visitorId), deletionHash = hash(deletionToken);
    const visitor = visitorGet.get(visitorHash) ?? tombstoneGet.get(visitorHash);
    if (visitor && !sameHash(visitor.deletion_hash, deletionHash)) throw failure(403, 'telemetry-credential-mismatch');
    // A tombstone also handles deletion overtaking a still-in-flight first batch.
    return transaction(() => {
      const removed = db.prepare('DELETE FROM telemetry_events WHERE visitor_hash=?').run(visitorHash).changes;
      db.prepare('DELETE FROM telemetry_visitors WHERE visitor_hash=?').run(visitorHash);
      db.prepare('DELETE FROM telemetry_cohorts WHERE visitor_hash=?').run(visitorHash);
      db.prepare(`INSERT INTO telemetry_deleted(visitor_hash,deletion_hash,expires_at) VALUES (?,?,?)
        ON CONFLICT(visitor_hash) DO UPDATE SET expires_at=excluded.expires_at`).run(visitorHash, deletionHash, now() + retentionDays * DAY_MS);
      return { deleted: true, removed: Number(removed) };
    });
  }

  function summary({ from = dayOf(now() - 6 * DAY_MS), to = dayOf(now()), environment = 'production', platform } = {}) {
    assertOpen(); prune();
    if (!validDay(from) || !validDay(to) || from > to || Date.parse(to) - Date.parse(from) > 90 * DAY_MS || !['production', 'qa'].includes(environment) ||
        (platform !== undefined && (typeof platform !== 'string' || !/^[a-z0-9_.:-]{1,96}$/i.test(platform)))) throw failure(400, 'invalid-telemetry-summary');
    const where = 'event_day >= ? AND event_day <= ? AND environment=?' + (platform ? ' AND platform=?' : '');
    const args = [from, to, environment, ...(platform ? [platform] : [])];
    const daily = db.prepare(`SELECT event_day AS day,count(*) AS events,count(DISTINCT visitor_hash) AS activePlayers,
      count(DISTINCT session_hash) AS sessions FROM telemetry_events WHERE ${where} GROUP BY event_day ORDER BY event_day`).all(...args);
    const events = db.prepare(`SELECT name,count(*) AS count,count(DISTINCT visitor_hash) AS visitors,
      count(DISTINCT session_hash) AS sessions,
      count(DISTINCT CASE WHEN json_extract(properties,'$.attemptId') IS NOT NULL
        THEN visitor_hash || ':' || json_extract(properties,'$.attemptId') END) AS attempts
      FROM telemetry_events WHERE ${where} GROUP BY name ORDER BY name`).all(...args);
    // A loss can be undone and the same logical attempt can later win. Count
    // only its latest terminal/undo observation, rather than both terminals.
    // Sequence resolves equal-millisecond timestamps even when retry/journal
    // batches arrive out of order; received_at/rowid support older producers.
    const outcomes = db.prepare(`WITH observed AS (
      SELECT name,json_extract(properties,'$.mode') AS mode,json_extract(properties,'$.outcome') AS outcome,
        row_number() OVER (
          PARTITION BY visitor_hash,json_extract(properties,'$.attemptId')
          ORDER BY timestamp DESC,coalesce(json_extract(properties,'$.observationSequence'),0) DESC,received_at DESC,rowid DESC
        ) AS observation_rank
      FROM telemetry_events WHERE ${where}
        AND name IN ('ms_attempt_completed','ms_undo_used')
        AND json_extract(properties,'$.attemptId') IS NOT NULL
    ) SELECT mode,outcome,count(*) AS attempts FROM observed
      WHERE observation_rank=1 AND name='ms_attempt_completed' AND outcome IN ('won','lost','abandoned')
      GROUP BY mode,outcome ORDER BY mode,outcome`).all(...args);
    const totals = db.prepare(`SELECT count(*) AS events,count(DISTINCT visitor_hash) AS activePlayers,count(DISTINCT session_hash) AS sessions
      FROM telemetry_events WHERE ${where}`).get(...args);
    // Compute cohorts separately per requested environment/platform. QA visits
    // cannot make an otherwise new production player look returning.
    const filter = 'environment=?' + (platform ? ' AND platform=?' : '');
    const filterArgs = [environment, ...(platform ? [platform] : [])];
    const firstVisits = db.prepare(`SELECT visitor_hash,min(first_day) AS firstDay FROM telemetry_cohorts WHERE ${filter} GROUP BY visitor_hash`).all(...filterArgs);
    const activity = db.prepare(`SELECT DISTINCT visitor_hash,event_day FROM telemetry_events WHERE ${filter}`).all(...filterArgs);
    const activitySet = new Set(activity.map(row => row.visitor_hash + ':' + row.event_day));
    const today = dayOf(now());
    const earliestCompleteDay = dayOf(now() - retentionDays * DAY_MS + DAY_MS);
    const retention = [1, 7].map(days => {
      let eligiblePlayers = 0, returningPlayers = 0;
      for (const visitor of firstVisits) {
        const returnDay = dayOf(Date.parse(visitor.firstDay) + days * DAY_MS);
        if (visitor.firstDay < from || visitor.firstDay > to || visitor.firstDay < earliestCompleteDay || returnDay >= today) continue;
        eligiblePlayers++; if (activitySet.has(visitor.visitor_hash + ':' + returnDay)) returningPlayers++;
      }
      return { day: days, eligiblePlayers, returningPlayers, rate: eligiblePlayers ? returningPlayers / eligiblePlayers : null };
    });
    return { schemaVersion: 1, from, to, environment, platform: platform ?? 'all', retentionDays,
      totals, daily, events, outcomes, retention,
      limitations: ['Opted-in visitors only; device IDs are not verified people.', 'Client-reported game facts are not payment records.',
        'Retention uses complete UTC days; only the retained observation window is available.'] };
  }
  prune();
  return Object.freeze({ ingest, deleteVisitor, summary, prune, close() { if (!closed) { closed = true; db.close(); } } });
}
