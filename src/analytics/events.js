const EVENT_NAMES = new Set([
  'ftue_start', 'ftue_complete', 'level_start', 'level_complete', 'retry',
  'challenge_created', 'challenge_opened', 'challenge_started', 'challenge_completed',
  'share_clicked', 'rewarded_viewed',
]);
const SAFE_FIELDS = new Set([
  'runId', 'flowId', 'puzzleId', 'contentVersion', 'rulesVersion', 'mode', 'assisted',
  'outcome', 'score', 'movesUsed', 'eligibleForChallenge', 'shareMethod', 'provider',
]);

export function createAnalytics({ enabled = true, sink = null, maxEvents = 250, createId = defaultId } = {}) {
  const events = [];
  const emitted = new Set();
  const emittedOrder = [];
  const bufferLimit = Math.max(1, Math.floor(Number.isFinite(maxEvents) ? maxEvents : 250));
  const rewardedPermit = Symbol('verified-rewarded-completion');
  let disposed = false;

  function track(name, payload = {}, options = {}) {
    if (disposed || !EVENT_NAMES.has(name)) return false;
    if (name === 'rewarded_viewed' && options.permit !== rewardedPermit) return false;
    const clean = sanitizePayload(payload);
    const key = options.dedupeKey ?? (clean.runId ? `${name}:${clean.runId}` : null);
    if (key && emitted.has(key)) return false;
    if (key) {
      emitted.add(key);
      emittedOrder.push(key);
      while (emittedOrder.length > bufferLimit * 4) emitted.delete(emittedOrder.shift());
    }
    const event = Object.freeze({ schemaVersion: 1, name, ...clean });
    if (enabled) {
      events.push(event);
      if (events.length > bufferLimit) events.splice(0, events.length - bufferLimit);
    }
    // Production delivery is deliberately fire-and-forget: analytics cannot delay game input.
    if (typeof sink === 'function') {
      try { Promise.resolve(sink(event)).catch(() => {}); } catch { /* Analytics never affects gameplay. */ }
    }
    return true;
  }

  function rewardedViewed(payload, confirmation) {
    if (!confirmation || confirmation.verifiedCompletion !== true
      || typeof confirmation.provider !== 'string' || !confirmation.provider.trim()
      || confirmation.provider === 'standalone-test') return false;
    return track('rewarded_viewed', { ...payload, provider: confirmation.provider }, { permit: rewardedPermit });
  }

  return {
    createId,
    track,
    rewardedViewed,
    snapshot() { return events.map((event) => ({ ...event })); },
    dispose() { disposed = true; events.length = 0; emitted.clear(); emittedOrder.length = 0; },
  };
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SAFE_FIELDS.has(key)) continue;
    if (['runId', 'flowId', 'puzzleId', 'mode', 'outcome', 'shareMethod', 'provider'].includes(key)) {
      if (typeof value === 'string' && value.length > 0 && value.length <= 96) clean[key] = value;
    } else if (['contentVersion', 'rulesVersion', 'score', 'movesUsed'].includes(key)) {
      if (Number.isFinite(value) && value >= 0) clean[key] = value;
    } else if (['assisted', 'eligibleForChallenge'].includes(key) && typeof value === 'boolean') clean[key] = value;
  }
  return clean;
}

function defaultId(prefix = 'run') {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
