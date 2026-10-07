export const DEFAULT_AD_POLICY = Object.freeze({
  interstitialEnabled: false,
  interstitialCooldownMs: 120_000,
  interstitialMaxPerSession: 1,
  excludeFtue: true,
});

export function createAdsController({
  platform,
  rewardedPlacementId = '',
  interstitialPlacementId = '',
  policy = DEFAULT_AD_POLICY,
  getRunId = () => null,
  grantExtraMove = () => ({ granted: false, reason: 'grant-unavailable' }),
  setPaused = () => {},
  isPaused = () => false,
  analytics = null,
  now = () => Date.now(),
} = {}) {
  let disposed = false;
  let rewardedBusy = false;
  const interstitialRuns = new Set();
  let lastInterstitialAt = -Infinity;

  async function requestExtraMove(context = {}) {
    if (disposed) return unavailable('disposed');
    if (rewardedBusy) return unavailable('ad-already-open');
    if (!rewardedPlacementId) return unavailable('placement-unconfigured');
    if (typeof platform?.rewarded !== 'function') return unavailable('platform-unavailable');
    const runId = getRunId();
    if (!runId) return unavailable('run-unavailable');
    rewardedBusy = true;
    const wasPaused = isPaused();
    setPaused(true);
    try {
      const result = await platform.rewarded({ placementId: rewardedPlacementId });
      if (disposed) return unavailable('disposed');
      if (result?.status !== 'ok') return result ?? unavailable('invalid-ad-result');
      if (result.value?.completed !== true) return { status: 'ok', value: { completed: false, granted: false } };
      if (getRunId() !== runId) return unavailable('stale-run');
      const grant = grantExtraMove({ granted: true, provider: result.value.provider ?? 'facebook-instant-games' });
      if (!grant?.granted) return unavailable(grant?.reason ?? 'grant-denied');
      analytics?.rewardedViewed?.(context, { verifiedCompletion: true, provider: result.value.provider ?? 'facebook-instant-games' });
      return { status: 'ok', value: { completed: true, granted: true } };
    } catch (error) {
      return unavailable(error?.name === 'AbortError' ? 'cancelled'
        : typeof error?.code === 'string' && /^[A-Z0-9_]{1,48}$/.test(error.code) ? error.code
          : 'ad-failed');
    } finally {
      rewardedBusy = false;
      if (!disposed && !wasPaused) setPaused(false);
    }
  }

  async function showInterstitial({ runId, outcome, tutorial = false } = {}) {
    if (disposed || !policy.interstitialEnabled) return unavailable('interstitial-disabled');
    if (policy.excludeFtue && tutorial) return unavailable('ftue-excluded');
    if (!runId || !['win', 'loss'].includes(outcome)) return unavailable('not-terminal-result');
    if (!interstitialPlacementId) return unavailable('placement-unconfigured');
    if (interstitialRuns.has(runId) || interstitialRuns.size >= policy.interstitialMaxPerSession) return unavailable('frequency-cap');
    if (now() - lastInterstitialAt < policy.interstitialCooldownMs) return unavailable('cooldown');
    if (typeof platform?.interstitial !== 'function') return unavailable('platform-unavailable');
    interstitialRuns.add(runId);
    lastInterstitialAt = now();
    const wasPaused = isPaused();
    setPaused(true);
    try { return await platform.interstitial({ placementId: interstitialPlacementId }); }
    catch { return unavailable('ad-failed'); }
    finally { if (!disposed && !wasPaused) setPaused(false); }
  }

  return {
    requestExtraMove,
    showInterstitial,
    snapshot() { return { disposed, rewardedBusy, interstitialRuns: interstitialRuns.size, policy: { ...policy } }; },
    dispose() { disposed = true; },
  };
}

function unavailable(reason) { return { status: 'unavailable', reason }; }
