import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdsController, DEFAULT_AD_POLICY } from '../src/platform/ads.js';

function setup(options = {}) {
  let runId = 'run-1';
  let paused = false;
  const calls = [];
  let grants = 0;
  const platform = {
    async rewarded(input) { calls.push(['rewarded', input]); return { status: 'ok', value: { completed: true, provider: 'facebook-instant-games' } }; },
    async interstitial(input) { calls.push(['interstitial', input]); return { status: 'ok' }; },
  };
  const analytics = { rewardedViewed(context, confirmation) { calls.push(['analytics', context, confirmation]); return true; } };
  const controller = createAdsController({
    platform,
    rewardedPlacementId: 'reward-placement',
    interstitialPlacementId: 'interstitial-placement',
    getRunId: () => runId,
    grantExtraMove: () => { grants += 1; return { granted: true }; },
    setPaused: (value) => { paused = value; calls.push(['pause', value]); },
    isPaused: () => paused,
    analytics,
    ...options,
  });
  return { controller, calls, get grants() { return grants; }, get paused() { return paused; }, setRunId(value) { runId = value; }, platform };
}

test('rewarded grant requires an explicit completion and is bound to its original run', async () => {
  const ctx = setup();
  const result = await ctx.controller.requestExtraMove({ runId: 'run-1', puzzleId: 'campaign-06' });
  assert.deepEqual(result, { status: 'ok', value: { completed: true, granted: true } });
  assert.equal(ctx.grants, 1);
  assert.equal(ctx.paused, false);
  assert.deepEqual(ctx.calls.find(([kind]) => kind === 'analytics')[2], { verifiedCompletion: true, provider: 'facebook-instant-games' });
  assert.deepEqual(ctx.calls.filter(([kind]) => kind === 'pause').map(([, value]) => value), [true, false]);

  const stale = setup();
  stale.platform.rewarded = async () => {
    stale.setRunId('run-2');
    return { status: 'ok', value: { completed: true, provider: 'facebook-instant-games' } };
  };
  assert.equal((await stale.controller.requestExtraMove()).reason, 'stale-run');
  assert.equal(stale.grants, 0);
});

test('cancel, missing placement and duplicate in-flight request never grant a bonus', async () => {
  const missing = setup({ rewardedPlacementId: '' });
  assert.equal((await missing.controller.requestExtraMove()).reason, 'placement-unconfigured');
  assert.equal(missing.paused, false);

  const cancelled = setup();
  cancelled.platform.rewarded = async () => ({ status: 'ok', value: { completed: false, provider: 'facebook-instant-games' } });
  assert.deepEqual(await cancelled.controller.requestExtraMove(), { status: 'ok', value: { completed: false, granted: false } });
  assert.equal(cancelled.grants, 0);

  for (const [name, error] of [
    ['cancelled', Object.assign(new Error('cancelled'), { name: 'AbortError' })],
    ['no-fill', Object.assign(new Error('no fill'), { code: 'AD_NO_FILL' })],
  ]) {
    const unavailable = setup();
    unavailable.platform.rewarded = async () => { throw error; };
    assert.equal((await unavailable.controller.requestExtraMove()).reason, name === 'cancelled' ? 'cancelled' : 'AD_NO_FILL');
    assert.equal(unavailable.grants, 0);
    assert.equal(unavailable.paused, false);
  }

  const concurrent = setup();
  let finish;
  concurrent.platform.rewarded = () => new Promise((resolve) => { finish = resolve; });
  const first = concurrent.controller.requestExtraMove();
  assert.equal((await concurrent.controller.requestExtraMove()).reason, 'ad-already-open');
  finish({ status: 'ok', value: { completed: true, provider: 'facebook-instant-games' } });
  assert.equal((await first).value.granted, true);
  assert.equal(concurrent.grants, 1);
});

test('interstitial is disabled by default and policy gates terminal, FTUE, retries and frequency', async () => {
  const disabled = setup();
  assert.equal((await disabled.controller.showInterstitial({ runId: 'r', outcome: 'win' })).reason, 'interstitial-disabled');
  assert.deepEqual(DEFAULT_AD_POLICY, { interstitialEnabled: false, interstitialCooldownMs: 120_000, interstitialMaxPerSession: 1, excludeFtue: true });

  let now = 10_000;
  const enabled = setup({ policy: { ...DEFAULT_AD_POLICY, interstitialEnabled: true }, now: () => now });
  assert.equal((await enabled.controller.showInterstitial({ runId: 'ftue-run', outcome: 'win', tutorial: true })).reason, 'ftue-excluded');
  assert.equal((await enabled.controller.showInterstitial({ runId: 'playing', outcome: 'playing' })).reason, 'not-terminal-result');
  assert.equal((await enabled.controller.showInterstitial({ runId: 'first', outcome: 'loss' })).status, 'ok');
  assert.equal((await enabled.controller.showInterstitial({ runId: 'first', outcome: 'loss' })).reason, 'frequency-cap');
  assert.equal((await enabled.controller.showInterstitial({ runId: 'second', outcome: 'win' })).reason, 'frequency-cap');
  assert.equal(enabled.calls.filter(([kind]) => kind === 'interstitial').length, 1);
  now += 200_000;
  assert.equal((await enabled.controller.showInterstitial({ runId: 'third', outcome: 'win' })).reason, 'frequency-cap');
});
