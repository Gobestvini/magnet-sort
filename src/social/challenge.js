import { campaignLevelIds, ftueLevelIds, loadCampaignLevel, loadFtueLevel, loadPrototypeLevel, prototypeLevelIds } from '../game/levels.js';

export const CHALLENGE_SCHEMA_VERSION = 1;
export const CHALLENGE_ASSISTED_POLICY = 'unassisted-only';
export const MAX_CHALLENGE_PAYLOAD_LENGTH = 4096;
const SHAREABLE_IDS = new Set([...campaignLevelIds(), ...ftueLevelIds(), ...prototypeLevelIds()]);
const COLOR_HEX = { red: '#ef6b62', blue: '#5388d8', yellow: '#f2c64e', green: '#54b995' };

export function isShareablePuzzle(puzzleId) { return SHAREABLE_IDS.has(puzzleId); }

export function createChallengePayload(level, result) {
  if (!level || !SHAREABLE_IDS.has(level.puzzleId)) throw new TypeError('Challenge puzzleId is not shareable');
  const verifiedLevel = loadShareableLevel(level.puzzleId);
  if (verifiedLevel.seed !== level.seed || verifiedLevel.contentVersion !== level.contentVersion
    || verifiedLevel.rulesVersion !== level.rulesVersion) throw new TypeError('Challenge level version does not match frozen content');
  const challengerResult = sanitizeResult(result);
  if (challengerResult.puzzleId !== verifiedLevel.puzzleId || challengerResult.seed !== verifiedLevel.seed
    || challengerResult.contentVersion !== verifiedLevel.contentVersion || challengerResult.rulesVersion !== verifiedLevel.rulesVersion
    || challengerResult.mode !== verifiedLevel.mode) throw new TypeError('Challenge result does not match frozen puzzle');
  return {
    schemaVersion: CHALLENGE_SCHEMA_VERSION,
    puzzleId: verifiedLevel.puzzleId,
    seed: verifiedLevel.seed,
    contentVersion: verifiedLevel.contentVersion,
    rulesVersion: verifiedLevel.rulesVersion,
    challengerResult,
    assistedPolicy: CHALLENGE_ASSISTED_POLICY,
    verification: 'client-unverified',
  };
}

export function encodeChallengePayload(payload) {
  const safe = validatePayload(payload);
  const bytes = new TextEncoder().encode(JSON.stringify(safe));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  const base64 = typeof globalThis.btoa === 'function'
    ? globalThis.btoa(binary)
    : Buffer.from(bytes).toString('base64');
  const encoded = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (encoded.length > MAX_CHALLENGE_PAYLOAD_LENGTH) throw new TypeError('Challenge payload is too long');
  return encoded;
}

export function decodeChallengePayload(encoded) {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > MAX_CHALLENGE_PAYLOAD_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(encoded)) return { ok: false, reason: 'malformed-payload' };
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4);
    const binary = typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return { ok: true, challenge: validatePayload(payload) };
  } catch (error) {
    const reason = error instanceof TypeError && error.message.includes('unsupported') ? 'unsupported-version'
      : error instanceof TypeError && error.message.includes('unknown puzzle') ? 'unknown-puzzle'
        : 'malformed-payload';
    return { ok: false, reason };
  }
}

export function parseChallengeUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) return { ok: false, reason: 'malformed-url' };
  let url;
  try { url = new URL(value, globalThis.location?.href ?? 'https://magnet-sort.invalid/'); }
  catch { return { ok: false, reason: 'malformed-url' }; }
  const values = url.searchParams.getAll('challenge');
  if (values.length !== 1) return { ok: false, reason: values.length ? 'malformed-url' : 'missing-payload' };
  return decodeChallengePayload(values[0]);
}

export function createChallengeUrl(level, result, baseUrl = globalThis.location?.href) {
  const payload = createChallengePayload(level, result);
  if (typeof baseUrl !== 'string') throw new TypeError('Challenge base URL is required');
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Challenge URL must use HTTP or HTTPS');
  url.search = '';
  url.hash = '';
  url.searchParams.set('challenge', encodeChallengePayload(payload));
  return url.href;
}

export async function shareChallenge({ url, cardSvg }, environment = {}) {
  const navigatorObject = environment.navigator ?? globalThis.navigator;
  const clipboard = environment.clipboard ?? navigatorObject?.clipboard;
  const FileClass = environment.File ?? globalThis.File;
  if (typeof navigatorObject?.share === 'function') {
    const data = { title: 'Magnet Sort — вызов', text: 'Сможешь побить мой результат?', url };
    try {
      if (cardSvg && typeof FileClass === 'function' && typeof navigatorObject.canShare === 'function') {
        const file = new FileClass([cardSvg], 'magnet-sort-challenge.svg', { type: 'image/svg+xml' });
        if (navigatorObject.canShare({ files: [file] })) data.files = [file];
      }
      await navigatorObject.share(data);
      return { status: 'shared' };
    } catch (error) {
      if (error?.name === 'AbortError') return { status: 'cancelled' };
    }
  }
  if (typeof clipboard?.writeText !== 'function') return { status: 'failed', reason: 'clipboard-unavailable' };
  try {
    await clipboard.writeText(url);
    return { status: 'copied' };
  } catch {
    return { status: 'failed', reason: 'clipboard-denied' };
  }
}

export function createChallengeCardSvg(level, result) {
  const verified = loadShareableLevel(level.puzzleId);
  const safeResult = sanitizeResult(result);
  if (safeResult.puzzleId !== verified.puzzleId || safeResult.contentVersion !== verified.contentVersion
    || safeResult.rulesVersion !== verified.rulesVersion) throw new TypeError('Challenge card result does not match puzzle');
  const cells = [];
  const tokenAt = new Map(verified.tokens.map((token) => [`${token.cell.col}:${token.cell.row}`, token]));
  const blocked = new Set(verified.blockedCells.map((cell) => `${cell.col}:${cell.row}`));
  const crates = new Set(verified.crates.map((cell) => `${cell.col}:${cell.row}`));
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const x = 58 + col * 47 + (row % 2) * 23.5;
    const y = 132 + row * 41;
    const points = hexPoints(x, y, 21);
    const id = `${col}:${row}`;
    const token = tokenAt.get(id);
    const face = blocked.has(id) ? '#b8b1a8' : crates.has(id) ? '#b77a43' : token ? (COLOR_HEX[token.color] ?? '#888888') : '#fffaf2';
    cells.push(`<polygon points="${points}" fill="#8b715d" opacity=".2" transform="translate(0 4)"/><polygon points="${points}" fill="${face}" stroke="#e5d9ca" stroke-width="2"/>`);
    if (blocked.has(id)) cells.push(`<path d="M${x-7} ${y-7}l14 14m0-14L${x-7} ${y+7}" stroke="#716b65" stroke-width="3" stroke-linecap="round"/>`);
    else if (crates.has(id)) cells.push(`<path d="M${x-11} ${y-9}h22v18h-22zm0 9h22m-11-9v18" fill="none" stroke="#704522" stroke-width="2.5"/>`);
    else if (token) cells.push(`<circle cx="${x}" cy="${y-3}" r="11" fill="#ffffff" opacity=".84"/><text x="${x}" y="${y+2}" text-anchor="middle" font-size="12" font-weight="800" fill="#34313a">${token.mass}</text>`);
  }
  const outcome = safeResult.outcome === 'win' ? 'ЦЕЛЬ ДОСТИГНУТА' : 'ПОПРОБУЙ ПОБИТЬ';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" rx="42" fill="#f8f1e7"/><rect x="24" y="24" width="1152" height="582" rx="34" fill="#fffdf9" stroke="#eadfce" stroke-width="3"/><text x="68" y="82" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="#34313a">MAGNET SORT</text><text x="610" y="174" font-family="system-ui,sans-serif" font-size="27" font-weight="800" fill="#887454">${outcome}</text><text x="610" y="272" font-family="system-ui,sans-serif" font-size="82" font-weight="850" fill="#34313a">${safeResult.score.toLocaleString('en-US')}</text><text x="614" y="316" font-family="system-ui,sans-serif" font-size="23" fill="#77747b">ОЧКОВ</text><text x="610" y="390" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#514d55">Ходы: ${safeResult.movesUsed} · Очистка: ${safeResult.clearPercent}%</text><rect x="610" y="448" width="430" height="76" rx="22" fill="#ffcf8c"/><text x="825" y="496" text-anchor="middle" font-family="system-ui,sans-serif" font-size="25" font-weight="800" fill="#34313a">Открой вызов и сыграй!</text><g>${cells.join('')}</g></svg>`;
}

export function challengeCardDataUrl(svg) {
  if (typeof svg !== 'string' || !svg.startsWith('<svg')) throw new TypeError('Expected generated challenge SVG');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Malformed challenge payload');
  if (payload.schemaVersion !== CHALLENGE_SCHEMA_VERSION) throw new TypeError('unsupported challenge version');
  if (typeof payload.puzzleId !== 'string' || !SHAREABLE_IDS.has(payload.puzzleId)) throw new TypeError('unknown puzzle id');
  const level = loadShareableLevel(payload.puzzleId);
  if (payload.seed !== level.seed || payload.contentVersion !== level.contentVersion || payload.rulesVersion !== level.rulesVersion) {
    throw new TypeError('Challenge frozen puzzle version mismatch');
  }
  if (payload.assistedPolicy !== CHALLENGE_ASSISTED_POLICY || payload.verification !== 'client-unverified') {
    throw new TypeError('Malformed challenge policy');
  }
  const challengerResult = sanitizeResult(payload.challengerResult);
  if (challengerResult.puzzleId !== level.puzzleId || challengerResult.seed !== level.seed
    || challengerResult.contentVersion !== level.contentVersion || challengerResult.rulesVersion !== level.rulesVersion
    || challengerResult.mode !== level.mode) throw new TypeError('Challenge result does not match frozen puzzle');
  return {
    schemaVersion: CHALLENGE_SCHEMA_VERSION,
    puzzleId: level.puzzleId,
    seed: level.seed,
    contentVersion: level.contentVersion,
    rulesVersion: level.rulesVersion,
    challengerResult,
    assistedPolicy: CHALLENGE_ASSISTED_POLICY,
    verification: 'client-unverified',
  };
}

function sanitizeResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new TypeError('Malformed challenger result');
  const integerFields = ['schemaVersion', 'rulesVersion', 'contentVersion', 'movesUsed', 'clearPercent', 'clearedMass', 'activeTimeMs', 'eligibilityVersion'];
  for (const field of integerFields) if (!Number.isInteger(result[field]) || result[field] < 0) throw new TypeError(`Malformed challenger result ${field}`);
  if (result.clearPercent > 100 || !Number.isFinite(result.score) || result.score < 0
    || typeof result.puzzleId !== 'string' || typeof result.seed !== 'string'
    || typeof result.mode !== 'string' || !['win', 'loss'].includes(result.outcome)
    || typeof result.reason !== 'string' || typeof result.eligibleForChallenge !== 'boolean') throw new TypeError('Malformed challenger result');
  const assistedFlags = result.assistedFlags;
  if (!assistedFlags || typeof assistedFlags !== 'object' || Array.isArray(assistedFlags)
    || Object.keys(assistedFlags).length > 16
    || Object.entries(assistedFlags).some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(key) || typeof value !== 'boolean')) {
    throw new TypeError('Malformed assisted flags');
  }
  return Object.fromEntries([
    'schemaVersion', 'rulesVersion', 'puzzleId', 'contentVersion', 'seed', 'mode', 'outcome', 'reason', 'score',
    'movesUsed', 'clearPercent', 'clearedMass', 'activeTimeMs', 'assistedFlags', 'eligibilityVersion', 'eligibleForChallenge',
  ].map((key) => [key, key === 'assistedFlags' ? { ...assistedFlags } : result[key]]));
}

function loadShareableLevel(puzzleId) {
  if (!SHAREABLE_IDS.has(puzzleId)) throw new TypeError('unknown puzzle id');
  if (campaignLevelIds().includes(puzzleId)) return loadCampaignLevel(puzzleId);
  if (ftueLevelIds().includes(puzzleId)) return loadFtueLevel(puzzleId);
  return loadPrototypeLevel(puzzleId);
}

function hexPoints(x, y, radius) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 3 * index - Math.PI / 6;
    return `${(x + Math.cos(angle) * radius).toFixed(2)},${(y + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(' ');
}
