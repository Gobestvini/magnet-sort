import { createV4State, applyV4Magnet, stacksForMove } from './model-v4.js';
import { spawnInterval } from './difficulty.js';
import { DAILY_RULES } from './daily-rules.js';
import { v4Levels } from './levels-v4.js';
import {
  CONTENT_VERSION, CAMPAIGN_PRESET_ID, SHORT_PRESET_ID, CHALLENGE_RULES_HASH
} from './challenge-content-v4.js';

export { CONTENT_VERSION, CAMPAIGN_PRESET_ID, SHORT_PRESET_ID, CHALLENGE_RULES_HASH };
export const MAX_CHALLENGE_LENGTH = 160;
const SCHEMA = 1, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const keys = ['schema','levelNumber','seed','presetId','contentVersion','rulesHash','moves','assisted'];
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const campaignRules = Object.freeze({ createV4State, applyV4Magnet, stacksForMove, spawnInterval });
const uint32 = value => Number.isInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 0xffffffff;
const validVersion = value => typeof value === 'string' && value.length > 0 &&
  encoder.encode(value).length <= 32 && !/[\u0000-\u001f\u007f]/.test(value) && decoder.decode(encoder.encode(value)) === value;

function shape(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) &&
    Number.isInteger(value.schema) && value.schema >= 0 && value.schema <= 255 &&
    Number.isInteger(value.levelNumber) && value.levelNumber >= 1 && value.levelNumber <= 12 &&
    uint32(value.seed) && validVersion(value.presetId) && validVersion(value.contentVersion) &&
    typeof value.rulesHash === 'string' && /^[a-f0-9]{64}$/.test(value.rulesHash) &&
    Number.isInteger(value.moves) && value.moves >= 1 && value.moves <= 65535 &&
    typeof value.assisted === 'boolean';
}
function compatible(value) {
  return value.schema === SCHEMA && value.contentVersion === CONTENT_VERSION &&
    value.rulesHash === CHALLENGE_RULES_HASH && [CAMPAIGN_PRESET_ID, SHORT_PRESET_ID].includes(value.presetId);
}
function requireCompatible(value) {
  if (!shape(value)) throw new TypeError('Invalid challenge descriptor');
  if (!compatible(value)) throw new TypeError('Unsupported challenge content');
}
function encodeBytes(bytes) {
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset], b = bytes[offset + 1] ?? 0, c = bytes[offset + 2] ?? 0;
    result += alphabet[a >>> 2] + alphabet[((a & 3) << 4) | (b >>> 4)];
    if (offset + 1 < bytes.length) result += alphabet[((b & 15) << 2) | (c >>> 6)];
    if (offset + 2 < bytes.length) result += alphabet[c & 63];
  }
  return result;
}
function decodeBytes(raw) {
  if (raw.length % 4 === 1) return null;
  let accumulator = 0, bits = 0;
  const bytes = [];
  for (const character of raw) {
    accumulator = (accumulator << 6) | alphabet.indexOf(character); bits += 6;
    if (bits >= 8) {
      bits -= 8; bytes.push((accumulator >>> bits) & 255);
      accumulator &= (1 << bits) - 1;
    }
  }
  if (accumulator !== 0) return null;
  const result = Uint8Array.from(bytes);
  return encodeBytes(result) === raw ? result : null;
}

// Fixed binary header, two UTF-8 byte-length-prefixed version IDs, full hash.
// Compatibility fields are present in full; this is not a signature or score proof.
function pack(value) {
  const content = encoder.encode(value.contentVersion), preset = encoder.encode(value.presetId);
  const bytes = new Uint8Array(43 + content.length + preset.length), view = new DataView(bytes.buffer);
  bytes[0] = value.schema; bytes[1] = value.levelNumber; bytes[2] = Number(value.assisted);
  view.setUint32(3, value.seed, false); view.setUint16(7, value.moves, false);
  let offset = 9;
  bytes[offset++] = content.length; bytes.set(content, offset); offset += content.length;
  bytes[offset++] = preset.length; bytes.set(preset, offset); offset += preset.length;
  for (let index = 0; index < 32; index++) bytes[offset + index] = parseInt(value.rulesHash.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}
export function encodeChallenge(descriptor) {
  requireCompatible(descriptor);
  const payload = encodeBytes(pack(descriptor));
  if (payload.length > MAX_CHALLENGE_LENGTH) throw new TypeError('Challenge payload is too long');
  return payload;
}
export function parseChallenge(raw) {
  const invalid = { ok: false, error: 'invalid' };
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > MAX_CHALLENGE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(raw)) return invalid;
  try {
    const bytes = decodeBytes(raw);
    if (!bytes || bytes.length < 45) return invalid;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[2] > 1) return invalid;
    let offset = 9;
    const readVersion = () => {
      const length = bytes[offset++];
      if (!length || length > 32 || offset + length > bytes.length) throw new TypeError('Invalid version field');
      const value = decoder.decode(bytes.subarray(offset, offset + length)); offset += length; return value;
    };
    const contentVersion = readVersion(), presetId = readVersion();
    if (offset + 32 !== bytes.length) return invalid;
    const rulesHash = Array.from(bytes.subarray(offset), byte => byte.toString(16).padStart(2, '0')).join('');
    const descriptor = { schema: bytes[0], levelNumber: bytes[1], seed: view.getUint32(3, false),
      presetId, contentVersion, rulesHash, moves: view.getUint16(7, false), assisted: bytes[2] === 1 };
    if (!shape(descriptor) || encodeBytes(pack(descriptor)) !== raw) return invalid;
    if (!compatible(descriptor)) return { ok: false, error: 'unsupported' };
    return { ok: true, descriptor };
  } catch { return invalid; }
}
export function rulesForChallenge(descriptor) {
  requireCompatible(descriptor);
  return descriptor.presetId === SHORT_PRESET_ID ? DAILY_RULES : campaignRules;
}
function goalFor(presetId, number) { return presetId === SHORT_PRESET_ID ? 30 + 10 * number : 50 * number; }
export function challengeForState(state, attempt, presetId = CAMPAIGN_PRESET_ID) {
  if (state?.terminal !== 'won') return null;
  const level = v4Levels.find(level => level.number === state.levelNumber);
  if (!level || state.puzzleId !== level.id || attempt?.levelId !== level.id || attempt.seed !== state.seed ||
      state.goal !== goalFor(presetId, level.number)) return null;
  const descriptor = { schema: SCHEMA, levelNumber: level.number, seed: state.seed, presetId,
    contentVersion: CONTENT_VERSION, rulesHash: CHALLENGE_RULES_HASH,
    moves: state.movesUsed, assisted: attempt.assisted };
  requireCompatible(descriptor);
  return descriptor;
}
export function compareChallengeResult(descriptor, state, attempt) {
  const result = { comparable: false, outcome: null, claimedMoves: shape(descriptor) ? descriptor.moves : null,
    moves: Number.isInteger(state?.movesUsed) ? state.movesUsed : null, verified: false };
  if (!shape(descriptor) || !compatible(descriptor) || state?.terminal !== 'won' ||
      state.levelNumber !== descriptor.levelNumber || state.seed !== descriptor.seed || attempt?.seed !== descriptor.seed ||
      state.puzzleId !== v4Levels[descriptor.levelNumber - 1].id || attempt.levelId !== state.puzzleId ||
      state.goal !== goalFor(descriptor.presetId, descriptor.levelNumber) || attempt.assisted !== descriptor.assisted ||
      !Number.isInteger(state.movesUsed) || state.movesUsed < 1 || state.movesUsed > 65535) return result;
  return { ...result, comparable: true,
    outcome: state.movesUsed < descriptor.moves ? 'better' : state.movesUsed === descriptor.moves ? 'equal' : 'worse' };
}
