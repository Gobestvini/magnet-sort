export const TELEMETRY_SCHEMA_VERSION = 1;
export const TELEMETRY_MAX_BATCH = 20;
export const TELEMETRY_MAX_AGE_MS = 86_400_000;
export const TELEMETRY_EVENTS = Object.freeze([
  'ms_game_ready', 'ms_session_started', 'ms_attempt_started', 'ms_attempt_resumed',
  'ms_first_move', 'ms_move_accepted', 'ms_attempt_completed', 'ms_retry',
  'ms_hint_used', 'ms_undo_used', 'ms_mode_changed', 'ms_session_ended',
  'ms_quest_completed', 'ms_reward_claimed', 'ms_collection_unlocked', 'ms_collection_selected',
  'ms_ad_offered', 'ms_ad_started', 'ms_ad_rewarded', 'ms_ad_completed', 'ms_ad_error',
  'ms_purchase_started', 'ms_purchase_paid', 'ms_purchase_granted', 'ms_purchase_refunded', 'ms_purchase_error',
]);
const events = new Set(TELEMETRY_EVENTS);
const strings = new Set(['attemptId', 'levelId', 'contentVersion', 'rulesVersion',
  'reason', 'provider', 'placement', 'productId', 'questId', 'collectionId', 'itemId']);
const integers = new Set(['moves', 'cleared', 'goal', 'durationMs', 'count', 'observationSequence']);
const booleans = new Set(['assisted', 'observedFromStart']);
const enums = { mode: ['campaign', 'daily', 'challenge'], outcome: ['won', 'lost', 'abandoned'] };
const baseFields = new Set(['platform', 'build', 'environment']);
const allowed = new Set([...strings, ...integers, ...booleans, ...Object.keys(enums), ...baseFields]);
export const isTelemetryId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isDeletionToken = value => typeof value === 'string' && /^[0-9a-f-]{72}$/i.test(value);
export const isTelemetryName = value => events.has(value);
export const isTelemetryLabel = value => typeof value === 'string' && /^[a-z0-9_.:-]{1,96}$/i.test(value);

// Only named game facts enter the payload. URLs, arbitrary errors, profile data,
// payment amounts and Telegram launch data have no permitted field.
export function sanitizeTelemetryProperties(input = {}) {
  const output = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
  for (const [key, value] of Object.entries(input)) {
    if (strings.has(key) && isTelemetryLabel(value)) output[key] = value;
    else if (integers.has(key) && Number.isSafeInteger(value) && value >= 0 && value <= 86_400_000) output[key] = value;
    else if (booleans.has(key) && typeof value === 'boolean') output[key] = value;
    else if (Object.hasOwn(enums, key) && enums[key].includes(value)) output[key] = value;
  }
  return output;
}

export function validateTelemetryEvent(event, now = Date.now()) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      Object.keys(event).some(key => !['id', 'name', 'timestamp', 'visitorId', 'sessionId', 'properties'].includes(key)) ||
      !isTelemetryId(event.id) || !isTelemetryId(event.visitorId) || !isTelemetryId(event.sessionId) || !isTelemetryName(event.name)) return false;
  if (typeof event.timestamp !== 'string') return false;
  const timestamp = Date.parse(event.timestamp);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== event.timestamp ||
      timestamp < now - TELEMETRY_MAX_AGE_MS || timestamp > now + 300_000) return false;
  const properties = event.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties) || Object.keys(properties).length > 25 ||
      Object.keys(properties).some(key => !allowed.has(key)) ||
      !isTelemetryLabel(properties.platform) || !isTelemetryLabel(properties.build) ||
      !['production', 'qa'].includes(properties.environment)) return false;
  const clean = sanitizeTelemetryProperties(properties);
  return Object.keys(properties).every(key => baseFields.has(key) || Object.hasOwn(clean, key));
}
