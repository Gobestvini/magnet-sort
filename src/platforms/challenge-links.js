// Platform links carry only an opaque, bounded descriptor. Game compatibility
// belongs to the shared challenge parser, never to an SDK or account payload.
export const CHALLENGE_PAYLOAD_CAP = 160;
export const CHALLENGE_WEB_BASE = 'https://gobestvini.github.io/magnet-sort/';
export const CHALLENGE_BOT_BASE = 'https://t.me/MagnetSortPuzzleBot';
const emptyLaunch = () => ({ payload: null, error: null });

export function assertChallengePayload(payload) {
  if (typeof payload !== 'string' || !payload.length || payload.length > CHALLENGE_PAYLOAD_CAP || !/^[A-Za-z0-9_-]+$/.test(payload))
    throw new TypeError('Invalid challenge payload');
  return payload;
}
function readParam(search, key, emptyIsAbsent = false) {
  if (search === undefined || search === null || search === '') return emptyLaunch();
  if (typeof search !== 'string' || search.length > 65536) return { payload: null, error: 'invalid' };
  const values = new URLSearchParams(search).getAll(key);
  if (values.length > 1) return { payload: null, error: 'duplicate' };
  if (!values.length || (emptyIsAbsent && values[0] === '')) return emptyLaunch();
  try { return { payload: assertChallengePayload(values[0]), error: null }; }
  catch { return { payload: null, error: 'invalid' }; }
}
export function readWebChallenge(search) { return readParam(search, 'challenge'); }
export function readTelegramChallenge(initData, search) {
  const bridgeFields = readParam(initData, 'start_param', true);
  const query = readParam(search, 'tgWebAppStartParam', true);
  if (bridgeFields.error) return bridgeFields;
  if (query.error) return query;
  if (bridgeFields.payload && query.payload && bridgeFields.payload !== query.payload)
    return { payload: null, error: 'conflict' };
  return { payload: bridgeFields.payload ?? query.payload, error: null };
}
export function webChallengeLink(payload, href = CHALLENGE_WEB_BASE) {
  assertChallengePayload(payload);
  let base;
  try {
    base = new URL('./', href);
    if (!['https:', 'http:'].includes(base.protocol)) throw new TypeError('Invalid web base');
  } catch { base = new URL(CHALLENGE_WEB_BASE); }
  base.search = ''; base.hash = '';
  base.searchParams.set('challenge', payload);
  return base.href;
}
export function telegramChallengeLink(payload) {
  const url = new URL(CHALLENGE_BOT_BASE);
  url.searchParams.set('startapp', assertChallengePayload(payload));
  return url.href;
}
export function telegramChooserLink(receiverUrl) {
  const url = new URL('https://t.me/share/url');
  url.searchParams.set('url', receiverUrl);
  url.searchParams.set('text', 'Try the same Magnet Sort board. Shared score, unverified.');
  return url.href;
}
