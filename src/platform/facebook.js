import { decodeChallengePayload } from '../social/challenge.js';
import { getDailyPuzzle } from '../social/daily.js';

const MAX_ENTRY_BYTES = 4_096;
const OK = (value) => ({ status: 'ok', value });
const unavailable = (reason) => ({ status: 'unavailable', reason });
const unsupported = (reason) => ({ status: 'unsupported', reason });

export function createFacebookInstantGamesAdapter({ sdk = globalThis.FBInstant, timeoutMs = 8_000 } = {}) {
  let disposed = false;
  let initialized = false;
  let started = false;
  let initializePromise = null;
  let startPromise = null;
  let supportedAPIs = new Set();
  let pauseListeners = new Set();
  let removeSdkPauseListener = null;

  const available = () => !disposed && sdk && typeof sdk === 'object';

  function supports(name, method = name) {
    return available() && supportedAPIs.has(name) && typeof sdk[method] === 'function';
  }

  async function call(name, method = name, ...args) {
    if (!available()) return unsupported('sdk-unavailable');
    if (!supports(name, method)) return unsupported(`api-unavailable:${name}`);
    try { return OK(await withTimeout(Promise.resolve(sdk[method](...args)), timeoutMs)); }
    catch (error) { return unavailable(error?.message === 'platform-timeout' ? 'timeout' : safeReason(error)); }
  }

  async function initialize() {
    if (disposed) return unavailable('disposed');
    if (initialized) return OK({ sdkVersion: sdkVersion(sdk) });
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      if (!available() || typeof sdk.initializeAsync !== 'function') return unsupported('initialize-unavailable');
      try {
        await withTimeout(Promise.resolve(sdk.initializeAsync()), timeoutMs);
        if (disposed) return unavailable('disposed');
        if (typeof sdk.getSupportedAPIs !== 'function') return unavailable('supported-apis-unavailable');
        const apis = await withTimeout(Promise.resolve(sdk.getSupportedAPIs()), timeoutMs);
        if (!Array.isArray(apis) || apis.some((api) => typeof api !== 'string')) return unavailable('invalid-supported-apis');
        supportedAPIs = new Set(apis);
        initialized = true;
        reportLoadingProgress(0);
        installPauseListener();
        return OK({ sdkVersion: sdkVersion(sdk) });
      } catch (error) {
        return unavailable(error?.message === 'platform-timeout' ? 'timeout' : safeReason(error));
      } finally { initializePromise = null; }
    })();
    return initializePromise;
  }

  function installPauseListener() {
    if (removeSdkPauseListener || !supports('onPause')) return;
    try {
      const unsubscribe = sdk.onPause((value) => {
        if (disposed) return;
        const paused = typeof value === 'boolean' ? value : Boolean(value?.isPaused ?? value?.paused);
        for (const listener of [...pauseListeners]) listener(paused);
      });
      removeSdkPauseListener = typeof unsubscribe === 'function' ? unsubscribe : () => {};
    } catch { removeSdkPauseListener = () => {}; }
  }

  async function start() {
    if (disposed) return unavailable('disposed');
    if (started) return OK(undefined);
    if (startPromise) return startPromise;
    startPromise = (async () => {
      if (!initialized) return unavailable('not-initialized');
      reportLoadingProgress(100);
      const result = await call('startGameAsync');
      if (result.status === 'ok') started = true;
      return result;
    })();
    try { return await startPromise; } finally { startPromise = null; }
  }

  function reportLoadingProgress(percent) {
    if (supports('setLoadingProgress') && Number.isFinite(percent)) {
      try { sdk.setLoadingProgress(Math.max(0, Math.min(100, Math.round(percent)))); } catch { /* Progress reporting is optional. */ }
    }
  }

  async function getEntry() {
    if (!started) return unavailable('not-started');
    const result = await call('getEntryPointData');
    if (result.status !== 'ok' || result.value == null) return result.status === 'ok' ? OK(null) : result;
    return parseEntryData(result.value);
  }

  async function shareResult({ text, encodedChallenge, image } = {}) {
    if (!started) return unavailable('not-started');
    if (typeof text !== 'string' || text.length > 280 || typeof encodedChallenge !== 'string'
      || encodedChallenge.length > MAX_ENTRY_BYTES || !decodeChallengePayload(encodedChallenge).ok) return unavailable('invalid-share-payload');
    const data = { magnetSort: { schemaVersion: 1, kind: 'challenge', payload: encodedChallenge } };
    return call('shareAsync', 'shareAsync', {
      intent: 'CHALLENGE', text,
      ...(typeof image === 'string' && image.length <= 256_000 ? { image } : {}),
      data,
    });
  }

  async function getLeaderboard({ boardId, context = 'global', limit = 10 } = {}) {
    if (!started) return unavailable('not-started');
    if (typeof boardId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(boardId)
      || !['global', 'friends'].includes(context)) return unavailable('invalid-leaderboard-config');
    const leaderboardResult = await call('getLeaderboardAsync', 'getLeaderboardAsync', boardId);
    if (leaderboardResult.status !== 'ok') return leaderboardResult;
    const leaderboard = leaderboardResult.value;
    if (!leaderboard || typeof leaderboard.getEntriesAsync !== 'function') return unsupported('leaderboard-entries-unavailable');
    try {
      const entries = await withTimeout(Promise.resolve(leaderboard.getEntriesAsync(clamp(limit, 1, 25), 0)), timeoutMs);
      if (!Array.isArray(entries)) return unavailable('invalid-leaderboard-response');
      return OK(entries.map((entry) => {
        const score = readNumber(entry, 'getScore', 'score');
        const rank = readNumber(entry, 'getRank', 'rank');
        const player = readValue(entry, 'getPlayer', 'player');
        const playerId = readValue(player, 'getID', 'id');
        const currentId = readValue(sdk.player, 'getID', 'id');
        const displayName = readValue(player, 'getName', 'name');
        return {
          score: Number.isFinite(score) && score >= 0 ? score : 0,
          ...(Number.isInteger(rank) && rank > 0 ? { rank } : {}),
          ...(typeof displayName === 'string' && displayName.length <= 64 ? { playerLabel: displayName } : {}),
          currentPlayer: typeof currentId === 'string' && currentId === playerId,
          verified: false,
        };
      }));
    } catch (error) { return unavailable(error?.message === 'platform-timeout' ? 'timeout' : safeReason(error)); }
  }

  async function rewarded({ placementId } = {}) {
    if (!started) return unavailable('not-started');
    if (typeof placementId !== 'string' || placementId.length > 128 || !placementId.trim()) return unavailable('placement-unconfigured');
    const ad = await call('getRewardedVideoAsync', 'getRewardedVideoAsync', placementId);
    if (ad.status !== 'ok') return ad;
    if (typeof ad.value?.loadAsync !== 'function' || typeof ad.value?.showAsync !== 'function') return unsupported('rewarded-video-unavailable');
    try {
      await withTimeout(Promise.resolve(ad.value.loadAsync()), timeoutMs);
      const result = await withTimeout(Promise.resolve(ad.value.showAsync()), timeoutMs);
      const completed = result?.completed === true || result?.isCompleted === true;
      return OK({ completed, provider: 'facebook-instant-games' });
    } catch (error) { return unavailable(error?.message === 'platform-timeout' ? 'timeout' : safeReason(error)); }
  }

  async function interstitial({ placementId } = {}) {
    if (!started) return unavailable('not-started');
    if (typeof placementId !== 'string' || placementId.length > 128 || !placementId.trim()) return unavailable('placement-unconfigured');
    const ad = await call('getInterstitialAdAsync', 'getInterstitialAdAsync', placementId);
    if (ad.status !== 'ok') return ad;
    if (typeof ad.value?.loadAsync !== 'function' || typeof ad.value?.showAsync !== 'function') return unsupported('interstitial-unavailable');
    try {
      await withTimeout(Promise.resolve(ad.value.loadAsync()), timeoutMs);
      await withTimeout(Promise.resolve(ad.value.showAsync()), timeoutMs);
      return OK(undefined);
    } catch (error) { return unavailable(error?.message === 'platform-timeout' ? 'timeout' : safeReason(error)); }
  }

  return {
    initialize,
    start,
    getEntry,
    shareResult,
    getLeaderboard,
    rewarded,
    interstitial,
    onPause(listener) {
      if (typeof listener !== 'function' || disposed) return () => {};
      pauseListeners.add(listener);
      return () => pauseListeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { removeSdkPauseListener?.(); } catch { /* Host callback cleanup is best-effort. */ }
      removeSdkPauseListener = null;
      pauseListeners.clear();
      supportedAPIs.clear();
      initialized = false;
      started = false;
    },
    snapshot() { return { kind: 'facebook-instant-games', initialized, started, supportedAPIs: [...supportedAPIs].sort(), disposed }; },
  };
}

export function parseEntryData(value) {
  let data = value;
  try {
    if (typeof value === 'string') {
      if (new TextEncoder().encode(value).length > MAX_ENTRY_BYTES) return unavailable('entry-too-large');
      data = JSON.parse(value);
    } else if (!value || typeof value !== 'object' || Array.isArray(value)
      || new TextEncoder().encode(JSON.stringify(value)).length > MAX_ENTRY_BYTES) return unavailable('invalid-entry');
  } catch { return unavailable('invalid-entry'); }
  const payload = data?.magnetSort;
  if (!payload || payload.schemaVersion !== 1) return OK(null);
  if (payload.kind === 'challenge' && typeof payload.payload === 'string') {
    const challenge = decodeChallengePayload(payload.payload);
    return challenge.ok ? OK({ kind: 'challenge', data: challenge.challenge }) : unavailable('invalid-challenge-entry');
  }
  if (payload.kind === 'daily' && typeof payload.dailyId === 'string' && typeof payload.puzzleId === 'string') {
    const instant = new Date(`${payload.dailyId}T12:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.dailyId) || !Number.isFinite(instant.getTime())
      || instant.toISOString().slice(0, 10) !== payload.dailyId) return unavailable('invalid-daily-date');
    try {
      const expected = getDailyPuzzle(instant);
      if (expected.puzzleId !== payload.puzzleId) return unavailable('daily-puzzle-mismatch');
      return OK({ kind: 'daily', data: { dailyId: payload.dailyId, puzzleId: payload.puzzleId } });
    } catch { return unavailable('invalid-daily-entry'); }
  }
  return OK(null);
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('platform-timeout')), Math.max(1, timeoutMs)); }),
  ]).finally(() => clearTimeout(timer));
}

function readValue(object, method, field) {
  try {
    if (typeof object?.[method] === 'function') return object[method]();
    return object?.[field];
  } catch { return undefined; }
}

function readNumber(object, method, field) {
  const value = readValue(object, method, field);
  return Number.isFinite(value) ? value : undefined;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : min))); }

function safeReason(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]{1,48}$/.test(error.code) ? error.code
    : error?.name === 'AbortError' ? 'cancelled' : 'platform-error';
}

function sdkVersion(sdk) {
  try { return typeof sdk.getSDKVersion === 'function' ? sdk.getSDKVersion() : null; }
  catch { return null; }
}
