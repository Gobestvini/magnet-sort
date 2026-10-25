import { createPublicKey, verify } from 'node:crypto';
import { BOT_ID, TELEGRAM_KEY, LIMITS, ApiError, object } from './config.mjs';
import { strictJson } from './json.mjs';

const productionKey = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(TELEGRAM_KEY, 'hex')]), format: 'der', type: 'spki' });
const unauthorized = () => new ApiError(401, 'AUTH_INVALID');
function decode(value) {
  try { return decodeURIComponent(value.replace(/\+/g, ' ')); } catch { throw unauthorized(); }
}
export function parseInitData(raw) {
  if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw) > LIMITS.initData) throw unauthorized();
  const fields = new Map();
  for (const pair of raw.split('&')) {
    const split = pair.indexOf('='); if (split < 1) throw unauthorized();
    const key = decode(pair.slice(0, split)), value = decode(pair.slice(split + 1));
    if (!/^[a-zA-Z0-9_]+$/.test(key) || fields.has(key) || !key.isWellFormed() || !value.isWellFormed()) throw unauthorized();
    fields.set(key, value);
  }
  return fields;
}
// Test-only key/clock injection is an in-process factory argument; main never
// reads a key override from the environment or from a request.
export function authenticate(raw, { now = Date.now(), publicKey = productionKey, botId = BOT_ID } = {}) {
  const fields = parseInitData(raw), encoded = fields.get('signature');
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]{86}(?:==)?$/.test(encoded)) throw unauthorized();
  const signature = Buffer.from(encoded, 'base64url');
  if (signature.length !== 64 || signature.toString('base64url') !== encoded.replace(/==$/, '')) throw unauthorized();
  const check = [...fields].filter(([key]) => key !== 'hash' && key !== 'signature').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, val]) => `${key}=${val}`).join('\n');
  if (!verify(null, Buffer.from(`${botId}:WebAppData\n${check}`), publicKey, signature)) throw unauthorized();
  const rawDate = fields.get('auth_date'); if (!/^\d{1,12}$/.test(rawDate ?? '')) throw unauthorized();
  const date = Number(rawDate);
  if (!Number.isSafeInteger(date) || date > now / 1000 + LIMITS.authFutureSeconds || now / 1000 - date > LIMITS.authAgeSeconds) throw new ApiError(401, 'AUTH_EXPIRED');
  let user; try { user = strictJson(fields.get('user')); } catch { throw unauthorized(); }
  if (!object(user) || !Number.isSafeInteger(user.id) || user.id <= 0) throw unauthorized();
  const displayName = typeof user.first_name === 'string' ? [...user.first_name.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')].slice(0, 64).join('').trim() : '';
  return { telegramId: String(user.id), displayName: displayName || 'Player' };
}
