import test from 'node:test';
import assert from 'node:assert/strict';
import { createFacebookInstantGamesAdapter, parseEntryData } from '../src/platform/facebook.js';
import { createStandalonePlatform } from '../src/platform/standalone.js';
import { loadCampaignLevel } from '../src/game/levels.js';
import { applyAction, createInitialState } from '../src/game/simulator.js';
import { createRunResult } from '../src/game/scoring.js';
import { createChallengePayload, encodeChallengePayload } from '../src/social/challenge.js';

function challengeEntry() {
  const level = loadCampaignLevel('campaign-36');
  let state = createInitialState(level);
  for (const action of level.solution.actions) state = applyAction(state, action).state;
  return encodeChallengePayload(createChallengePayload(level, createRunResult(state, 1000)));
}

function fakeSdk({ apis, entryData = null, startGameAsync = async () => {}, shareAsync = async () => {}, methods = {} } = {}) {
  const calls = [];
  const sdk = {
    async initializeAsync() { calls.push('initializeAsync'); },
    getSupportedAPIs() { calls.push('getSupportedAPIs'); return apis ?? ['startGameAsync']; },
    async startGameAsync() { calls.push('startGameAsync'); return startGameAsync(); },
    getEntryPointData() { calls.push('getEntryPointData'); return entryData; },
    async shareAsync(payload) { calls.push(['shareAsync', payload]); return shareAsync(payload); },
    ...methods,
  };
  return { sdk, calls };
}

test('standalone platform preserves local play and explicitly reports remote features unsupported', async () => {
  const platform = createStandalonePlatform();
  assert.equal((await platform.initialize()).status, 'ok');
  assert.equal((await platform.start()).status, 'ok');
  assert.deepEqual(await platform.getEntry(), { status: 'ok', value: null });
  assert.equal((await platform.shareResult()).status, 'unsupported');
  assert.equal((await platform.getLeaderboard({ boardId: 'daily' })).status, 'unsupported');
  assert.equal((await platform.rewarded({ placementId: 'test' })).status, 'unsupported');
  platform.dispose();
});

test('initialization and start are idempotent, supported APIs are checked, and pause listeners clean up', async () => {
  const { sdk, calls } = fakeSdk({ apis: ['startGameAsync', 'setLoadingProgress', 'onPause'] });
  const progress = [];
  const apiPause = [];
  let sdkPause;
  let removed = false;
  sdk.setLoadingProgress = (value) => progress.push(value);
  sdk.onPause = (listener) => { sdkPause = listener; return () => { removed = true; }; };
  const platform = createFacebookInstantGamesAdapter({ sdk });
  assert.equal((await platform.initialize()).status, 'ok');
  assert.equal((await platform.initialize()).status, 'ok');
  assert.deepEqual(calls.filter(call => call === 'initializeAsync'), ['initializeAsync']);
  assert.equal((await platform.start()).status, 'ok');
  assert.equal((await platform.start()).status, 'ok');
  assert.deepEqual(calls.filter(call => call === 'startGameAsync'), ['startGameAsync']);
  assert.deepEqual(progress, [0, 100]);
  const remove = platform.onPause(value => apiPause.push(value));
  sdkPause({ isPaused: true });
  sdkPause(false);
  assert.deepEqual(apiPause, [true, false]);
  remove();
  sdkPause(true);
  assert.deepEqual(apiPause, [true, false]);
  platform.dispose();
  assert.equal(removed, true);
  assert.equal(platform.snapshot().disposed, true);
});

test('entry data is bounded and only accepts a validated challenge or matching UTC daily board', async () => {
  const encoded = challengeEntry();
  const parsed = parseEntryData({ magnetSort: { schemaVersion: 1, kind: 'challenge', payload: encoded } });
  assert.equal(parsed.status, 'ok');
  assert.equal(parsed.value.data.puzzleId, 'campaign-36');
  assert.equal(parseEntryData('x'.repeat(5000)).reason, 'entry-too-large');
  assert.equal(parseEntryData({ magnetSort: { schemaVersion: 1, kind: 'challenge', payload: 'bad' } }).status, 'unavailable');
  assert.equal(parseEntryData({ magnetSort: { schemaVersion: 1, kind: 'daily', dailyId: '2026-10-07', puzzleId: 'campaign-01' } }).reason, 'daily-puzzle-mismatch');
  const daily = await createFacebookInstantGamesAdapter({ sdk: fakeSdk({ apis: ['startGameAsync', 'getEntryPointData'], entryData: { magnetSort: { schemaVersion: 1, kind: 'daily', dailyId: '2026-10-07', puzzleId: 'campaign-15' } } }).sdk });
  await daily.initialize();
  await daily.start();
  assert.deepEqual(await daily.getEntry(), { status: 'ok', value: { kind: 'daily', data: { dailyId: '2026-10-07', puzzleId: 'campaign-15' } } });
});

test('challenge share passes a bounded entry payload, never a URL, and unsupported APIs fall back explicitly', async () => {
  let shared;
  const { sdk } = fakeSdk({
    apis: ['startGameAsync', 'shareAsync'],
    shareAsync(payload) { shared = payload; return { accepted: true }; },
  });
  const platform = createFacebookInstantGamesAdapter({ sdk });
  await platform.initialize();
  await platform.start();
  const result = await platform.shareResult({ text: 'Попробуй побить результат', encodedChallenge: challengeEntry() });
  assert.equal(result.status, 'ok');
  assert.equal(shared.intent, 'CHALLENGE');
  assert.equal(shared.data.magnetSort.kind, 'challenge');
  assert.equal(Object.keys(shared.data).some(key => /url/i.test(key)), false);
  assert.equal((await platform.getLeaderboard({ boardId: 'daily' })).status, 'unsupported');
});

test('leaderboard rows are sanitized and remain marked unverified', async () => {
  const board = { async getEntriesAsync(limit) {
    assert.equal(limit, 3);
    return [{ getScore: () => 800, getRank: () => 2, getPlayer: () => ({ getID: () => 'friend-id', getName: () => 'Friend' }) }];
  } };
  const sdk = fakeSdk({ apis: ['startGameAsync', 'getLeaderboardAsync'] }).sdk;
  sdk.getLeaderboardAsync = async () => board;
  sdk.player = { getID: () => 'self-id' };
  const platform = createFacebookInstantGamesAdapter({ sdk });
  await platform.initialize();
  await platform.start();
  assert.deepEqual(await platform.getLeaderboard({ boardId: 'daily', context: 'friends', limit: 3 }), {
    status: 'ok', value: [{ score: 800, rank: 2, playerLabel: 'Friend', currentPlayer: false, verified: false }],
  });
});

test('ad adapter never infers rewarded completion from an unconfirmed show resolution', async () => {
  const ad = { async loadAsync() {}, async showAsync() { return undefined; } };
  const sdk = fakeSdk({ apis: ['startGameAsync', 'getRewardedVideoAsync'] }).sdk;
  sdk.getRewardedVideoAsync = async () => ad;
  const platform = createFacebookInstantGamesAdapter({ sdk });
  await platform.initialize();
  await platform.start();
  assert.deepEqual(await platform.rewarded({ placementId: 'reward-test' }), {
    status: 'ok', value: { completed: false, provider: 'facebook-instant-games' },
  });
  assert.equal((await platform.rewarded({})).reason, 'placement-unconfigured');
});

test('rejected and timed-out SDK calls return without rejecting gameplay callers', async () => {
  const failed = fakeSdk({ apis: ['startGameAsync'], startGameAsync: async () => { throw Object.assign(new Error('network'), { code: 'NETWORK_FAILURE' }); } });
  const failedAdapter = createFacebookInstantGamesAdapter({ sdk: failed.sdk, timeoutMs: 10 });
  await failedAdapter.initialize();
  assert.equal((await failedAdapter.start()).reason, 'NETWORK_FAILURE');
  const hung = fakeSdk({ apis: ['startGameAsync'], startGameAsync: () => new Promise(() => {}) });
  const hungAdapter = createFacebookInstantGamesAdapter({ sdk: hung.sdk, timeoutMs: 5 });
  await hungAdapter.initialize();
  assert.equal((await hungAdapter.start()).reason, 'timeout');
});
