import { TELEMETRY_SCHEMA_VERSION, TELEMETRY_MAX_BATCH, TELEMETRY_MAX_AGE_MS,
  isTelemetryId, isDeletionToken, isTelemetryLabel, isTelemetryName,
  sanitizeTelemetryProperties, validateTelemetryEvent } from './schema.js';

export const TELEMETRY_STORAGE_PREFIX = 'magnet-sort-telemetry-v1:';
const MAX_QUEUE = 200, SESSION_IDLE_MS = 1_800_000;
export function createTelemetry(options = {}) {
  const now = options.now ?? Date.now;
  const id = options.id ?? (() => globalThis.crypto.randomUUID());
  const storage = options.storage;
  const read = key => { try { return storage?.getItem(TELEMETRY_STORAGE_PREFIX + key) ?? null; } catch { return null; } };
  const write = (key, value) => { try { if (!storage) return false; if (value === null) storage.removeItem(TELEMETRY_STORAGE_PREFIX + key); else storage.setItem(TELEMETRY_STORAGE_PREFIX + key, value); return true; } catch { return false; } };
  const platform = isTelemetryLabel(options.platform) ? options.platform : 'web';
  const build = isTelemetryLabel(options.build) ? options.build : 'unknown';
  const environment = options.environment === 'production' ? 'production' : 'qa';
  const configured = Boolean(options.endpoint || options.send);
  let enabled = read('consent') === 'yes', disposed = false, visitorId = '', deletionToken = '', sessionId = '', lastActivity = 0;
  let queue = [], revision = 0, flight = null, failures = 0, retryAt = 0;
  const seen = new Set();
  const memoryOnly = new Map(), credentials = new Map();

  function clearTracking() {
    revision++; flight?.abort(); flight = null; queue = []; seen.clear(); memoryOnly.clear(); credentials.clear();
    visitorId = ''; deletionToken = ''; sessionId = ''; lastActivity = 0; failures = 0; retryAt = 0;
  }
  // Every entry point checks the shared preference. A second tab must not keep
  // sending or recreate state after another tab has revoked consent. Enabling
  // remains an explicit setConsent(true) in this instance (or a fresh instance
  // reading the saved opt-in), rather than a storage notification side effect.
  function syncConsent() {
    if (enabled && read('consent') === 'no') {
      const pending = journal();
      enabled = false; clearTracking();
      for (const record of pending ?? []) write('pending:' + record.event.id, null);
      write('state', null);
    }
    return enabled;
  }
  // Browser localStorage has atomic operations per key, but a shared array
  // read/modify/write is not a cross-tab transaction. Each pending event owns
  // its own immutable key. Acknowledging A never rewrites/deletes B's event.
  function journal() {
    try {
      if (!storage || typeof storage.key !== 'function' || typeof storage.length !== 'number') return null;
      const keys = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (typeof key === 'string' && key.startsWith(TELEMETRY_STORAGE_PREFIX + 'pending:')) keys.push(key.slice(TELEMETRY_STORAGE_PREFIX.length));
      }
      const records = [];
      for (const key of keys) {
        try {
          const raw = read(key);
          const record = raw && raw.length <= 8_192 ? JSON.parse(raw) : null;
          if (record && isDeletionToken(record.deletionToken) && validateTelemetryEvent(record.event, now()) && key === 'pending:' + record.event.id) records.push(record);
          else write(key, null);
        } catch { write(key, null); }
      }
      return records;
    } catch { return null; }
  }
  function refreshJournal(records = journal()) {
    if (records === null) return false;
    const pending = new Map();
    for (const record of records) { pending.set(record.event.id, record.event); credentials.set(record.event.visitorId, record.deletionToken); }
    for (const [key, event] of memoryOnly) {
      if (validateTelemetryEvent(event, now())) pending.set(key, event); else memoryOnly.delete(key);
    }
    const ordered = [...pending.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
    for (const event of ordered.slice(0, Math.max(0, ordered.length - MAX_QUEUE))) { write('pending:' + event.id, null); memoryOnly.delete(event.id); }
    queue = ordered.slice(-MAX_QUEUE); return true;
  }
  function persist(newEvent = null, acknowledged = []) {
    if (!syncConsent() || !visitorId) return false;
    const records = journal();
    if (records !== null) {
      if (newEvent && !write('pending:' + newEvent.id, JSON.stringify({ event: newEvent, deletionToken }))) memoryOnly.set(newEvent.id, newEvent);
      for (const eventId of acknowledged) { write('pending:' + eventId, null); memoryOnly.delete(eventId); }
      refreshJournal();
      if (!syncConsent()) return false;
      write('state', JSON.stringify({ visitorId, deletionToken, sessionId, lastActivity }));
    } else {
      // Reduced StorageLike test/embedded adapters may not enumerate keys. Merge
      // their current pending array and remove only this response's exact IDs.
      let saved = [];
      try { const state = JSON.parse(read('state') || 'null'); if (state?.visitorId === visitorId && Array.isArray(state.queue)) saved = state.queue; } catch { /* Optional storage. */ }
      const pending = new Map([...saved, ...queue].filter(event => validateTelemetryEvent(event, now())).map(event => [event.id, event]));
      for (const eventId of acknowledged) pending.delete(eventId);
      queue = [...pending.values()].slice(-MAX_QUEUE);
      write('state', JSON.stringify({ visitorId, deletionToken, sessionId, lastActivity, queue }));
    }
    return true;
  }
  function identity() {
    if (visitorId) return;
    try {
      const saved = JSON.parse(read('state') || 'null');
      if (saved && isTelemetryId(saved.visitorId) && isDeletionToken(saved.deletionToken)) {
        visitorId = saved.visitorId; deletionToken = saved.deletionToken;
        if (isTelemetryId(saved.sessionId) && Number.isFinite(saved.lastActivity) && saved.lastActivity <= now() && now() - saved.lastActivity < SESSION_IDLE_MS) {
          sessionId = saved.sessionId; lastActivity = saved.lastActivity;
        }
        if (Array.isArray(saved.queue)) queue = saved.queue.filter(event => event.visitorId === visitorId && validateTelemetryEvent(event, now())).slice(-MAX_QUEUE);
      }
    } catch { /* Malformed local data never blocks play. */ }
    if (!visitorId) { visitorId = id(); deletionToken = id() + id(); }
    credentials.set(visitorId, deletionToken);
    // One-time migration of an older shared-array queue keeps its event IDs.
    if (queue.length && journal() !== null) {
      for (const event of queue) if (!write('pending:' + event.id, JSON.stringify({ event, deletionToken }))) memoryOnly.set(event.id, event);
    }
    refreshJournal();
  }
  const send = options.send ?? (async (payload, signal) => {
    const response = await fetch(options.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), credentials: 'omit', signal, keepalive: true });
    return response.ok;
  });
  const erase = options.erase ?? (async ({ visitorId: visitor, deletionToken: token }) => {
    if (!options.endpoint) return false;
    const endpoint = options.deleteEndpoint ?? options.endpoint.replace(/\/events\/?$/, '/visitor');
    if (endpoint === options.endpoint) return false;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ visitorId: visitor }), credentials: 'omit', signal: controller.signal });
      return response.ok;
    } finally { clearTimeout(timeout); }
  });

  function track(name, properties = {}, dedupe) {
    if (disposed || !syncConsent() || !configured || !isTelemetryName(name)) return false;
    if (dedupe !== undefined && (typeof dedupe !== 'string' || dedupe.length > 200 || seen.has(dedupe))) return false;
    identity();
    if (!sessionId || now() < lastActivity || now() - lastActivity >= SESSION_IDLE_MS) sessionId = id();
    lastActivity = now();
    const event = { id: id(), name, timestamp: new Date(now()).toISOString(), visitorId, sessionId,
      properties: { ...sanitizeTelemetryProperties(properties), platform, build, environment } };
    if (!validateTelemetryEvent(event, now())) return false;
    if (dedupe !== undefined) { seen.add(dedupe); if (seen.size > 1_000) seen.delete(seen.values().next().value); }
    queue = queue.filter(item => Date.parse(item.timestamp) >= now() - TELEMETRY_MAX_AGE_MS).slice(-(MAX_QUEUE - 1));
    queue.push(event); return persist(event);
  }

  async function flush() {
    if (disposed || !syncConsent() || !configured) return { status: 'disabled', sent: 0 };
    // Restored opt-in data is loaded lazily, never before consent.
    identity();
    refreshJournal();
    queue = queue.filter(event => validateTelemetryEvent(event, now()));
    if (!queue.length) return { status: 'empty', sent: 0 };
    if (flight) return { status: 'busy', sent: 0 };
    if (now() < retryAt) return { status: 'retry-later', sent: 0 };
    const batchVisitor = queue[0].visitorId;
    const batch = queue.filter(event => event.visitorId === batchVisitor).slice(0, TELEMETRY_MAX_BATCH), version = revision, controller = new AbortController();
    const batchDeletionToken = credentials.get(batchVisitor) ?? deletionToken;
    flight = controller;
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const success = await send({ schemaVersion: TELEMETRY_SCHEMA_VERSION, deletionToken: batchDeletionToken, events: batch }, controller.signal);
      syncConsent();
      if (disposed || version !== revision) return { status: 'cancelled', sent: 0 };
      if (!success) throw new Error('send-failed');
      const accepted = new Set(batch.map(event => event.id));
      queue = queue.filter(event => !accepted.has(event.id)); failures = 0; retryAt = 0; persist(null, [...accepted]);
      return { status: 'ok', sent: batch.length };
    } catch {
      syncConsent();
      if (disposed || version !== revision) return { status: 'cancelled', sent: 0 };
      failures = Math.min(failures + 1, 10); retryAt = now() + Math.min(60_000, 1_000 * 2 ** failures);
      return { status: 'error', sent: 0 };
    } finally { clearTimeout(timeout); if (flight === controller) flight = null; }
  }

  function setConsent(value) {
    if (disposed) return Promise.resolve({ deleted: false, reason: 'disposed' });
    if (value === true) { enabled = true; write('consent', 'yes'); return Promise.resolve({ deleted: false }); }
    // Capture only the deletion credential before removing every local tracking value.
    if (enabled && !visitorId) {
      try { const saved = JSON.parse(read('state') || 'null'); if (isTelemetryId(saved?.visitorId) && isDeletionToken(saved?.deletionToken)) { visitorId = saved.visitorId; deletionToken = saved.deletionToken; } } catch { /* Nothing to delete. */ }
    }
    const deletions = new Map(credentials);
    if (visitorId) deletions.set(visitorId, deletionToken);
    const pendingRecords = journal();
    for (const record of pendingRecords ?? []) deletions.set(record.event.visitorId, record.deletionToken);
    enabled = false; clearTracking();
    write('consent', 'no'); write('state', null);
    for (const record of pendingRecords ?? []) write('pending:' + record.event.id, null);
    if (!deletions.size) return Promise.resolve({ deleted: true });
    return Promise.all([...deletions].map(([visitor, token]) => Promise.resolve().then(() => erase({ visitorId: visitor, deletionToken: token })).catch(() => false)))
      .then(results => results.every(result => result === true) ? { deleted: true } : { deleted: false, reason: 'erase-unavailable' });
  }
  return Object.freeze({ track, flush, setConsent, syncConsent, consent: syncConsent,
    snapshot: () => ({ consent: syncConsent(), configured, queued: queue.length, flight: Boolean(flight), failures, retryAt, environment, platform }),
    dispose() { if (disposed) return; disposed = true; revision++; flight?.abort(); flight = null; queue = []; seen.clear(); memoryOnly.clear(); credentials.clear(); },
  });
}

export function createBrowserTelemetry(options = {}) {
  let storage = options.storage;
  if (!storage) { try { storage = globalThis.localStorage; } catch { /* Blocked storage is supported. */ } }
  return createTelemetry({ ...options, storage });
}
