import { createBrowserTelemetry } from '../telemetry/client.js';
import { createMetaProgress } from '../meta/progress.js';
import { createCommerce } from '../commerce/controller.js';
import { createAdProvider, combineProviders } from '../commerce/providers.js';
import { createTelegramStarsProvider } from '../commerce/telegram.js';
import { GROWTH_API, BUILD_TARGET, BUILD_REVISION, TELEMETRY_ALLOWED, ENVIRONMENT, ADS_ENABLED } from './config.js';

// Presentation runId changes on Undo; the logical analytics attempt does not.
const ATTEMPTS_KEY = 'magnet-sort-telemetry-v1:attempts';
export function createGrowthController({ onChange = () => {}, onCommercePause = () => {}, getContext = () => null } = {}) {
  const telemetry = createBrowserTelemetry({
    endpoint: TELEMETRY_ALLOWED ? GROWTH_API + '/analytics/events' : '',
    platform: BUILD_TARGET, build: BUILD_REVISION, environment: ENVIRONMENT,
  });
  const meta = createMetaProgress();
  let commerce = createCommerce(), connected = false, disposed = false, context = null, attemptId = null;
  let message = '', products = [], entitlements = [], storeLoading = false, ready = false, sessionStarted = false;
  let transientAurora = false, ended = false, transitionPending = false, observationSequence = 0;
  const attempts = new Map();
  const notify = () => { if (!disposed) onChange(); };
  function event(name, props = {}, key) { return telemetry.track(name, { ...details(), ...props, observationSequence:++observationSequence }, key); }
  function details() {
    return context ? { mode: context.mode, levelId: context.state.puzzleId, attemptId,
      moves: context.state.movesUsed, cleared: context.state.cleared, goal: context.state.goal,
      assisted: context.attempt?.assisted === true, contentVersion: 'sub-ten-2026-10-20.1', rulesVersion: '4' } : {};
  }
  function boardKey(value = context) {
    return value ? [value.mode, value.state.puzzleId, value.state.seed, value.date ?? ''].join(':') : '';
  }
  function bonusClaim() {
    if(!context)return '';
    return 'victory-stamp:' + meta.snapshot().weekId + ':' + (context.mode === 'daily' ?
      'daily:' + context.date : 'campaign:' + context.state.puzzleId + ':' + context.state.seed);
  }
  function identify(force = false) {
    if (!context || !telemetry.consent() || !TELEMETRY_ALLOWED) { attemptId = null; return; }
    if (!attempts.size) {
      try { const saved = JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) ?? '{}');
        for (const [key, value] of Object.entries(saved)) if (/^[\da-f-]{36}$/i.test(value)) attempts.set(key, value);
      } catch { /* Optional per-tab continuity. */ }
    }
    const key = boardKey();
    if (force || !attempts.has(key)) attempts.set(key, crypto.randomUUID());
    attemptId = attempts.get(key);
    try { sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(Object.fromEntries([...attempts].slice(-10)))); } catch { /* Optional. */ }
  }
  function recordResult(observed = true) {
    if (!context?.state.terminal || context.preview) return;
    const { state, mode, date, attempt } = context;
    if(['campaign','daily'].includes(mode))meta.recordResult({ mode, date, levelId: state.puzzleId, seed: state.seed, outcome: state.terminal,
      cleared: state.cleared, moves: state.movesUsed, assisted: attempt?.assisted === true });
    if (observed) {
      event('ms_attempt_completed', { outcome: state.terminal });
      void telemetry.flush();
    }
  }
  function observeStart({ force = false, resumed = false } = {}) {
    identify(force);
    if (!ready || !telemetry.consent() || context.preview) return;
    event(resumed ? 'ms_attempt_resumed' : 'ms_attempt_started',
      { observedFromStart: !resumed && context.state.turn === 0 }, 'start:' + attemptId);
  }
  return {
    async connect(platform) {
      if (connected || disposed) return; connected = true;
      let provider = platform?.commerceProvider?.();
      if (BUILD_TARGET === 'telegram') {
        const stars = createTelegramStarsProvider({ endpoint: GROWTH_API, bridge: window.Telegram?.WebApp, enabled: Boolean(GROWTH_API) });
        provider = combineProviders(provider, stars);
      }
      commerce.dispose();
      commerce = createCommerce({ provider, getContext, onPause: onCommercePause,
        onEvent(name, properties) {
          const canonical = ({ ms_ad_completed: properties.kind === 'rewarded' ? 'ms_ad_rewarded' : 'ms_ad_completed', ms_ad_failed: 'ms_ad_error',
            ms_purchase_completed: 'ms_purchase_granted', ms_purchase_failed: 'ms_purchase_error' })[name] ?? name;
          event(canonical, { ...properties, reason: properties.outcome });
          void telemetry.flush(); notify();
        } });
      // Permanent rights are restored from the ledger on every Telegram launch.
      // Startup remains playable if identity or the network is unavailable.
      if (commerce.capabilities().purchases) {
        void commerce.verifyEntitlements().then(result => {
          if(!disposed){
            if(result.status==='ok')entitlements=result.entitlements;
            else message='Purchases could not be verified. You can keep playing; use Restore purchases or reopen Telegram when connected.';
            notify();
          }
        });
      }
      notify();
    },
    begin(value, { force = false, resumed = false, reason } = {}) {
      context = value; ended = false; transientAurora = false;
      observeStart({ force, resumed });
      if (reason) event(reason === 'retry' ? 'ms_retry' : 'ms_mode_changed', { reason });
      // Restoring a terminal board is not a new result in the current UTC week.
      // Only an accepted move reaching terminal may award local quest progress.
    },
    ready() {
      ready = true;
      if (telemetry.consent() && !sessionStarted) {
        sessionStarted = true; event('ms_session_started'); event('ms_game_ready');
        observeStart({ resumed: context?.state.turn > 0 });
        void telemetry.flush();
      }
    },
    move(value) {
      context = value;
      if (value.state.turn === 1) event('ms_first_move', {}, 'first:' + attemptId);
      event('ms_move_accepted');
      recordResult(); notify();
    },
    action(name, value) { if (value) context = value; event(name); notify(); },
    snapshot() {
      return { meta: meta.snapshot(), analytics: { ...telemetry.snapshot(), available: TELEMETRY_ALLOWED },
        commerce: { ...commerce.capabilities(), ...commerce.snapshot(), products, entitlements, loading: storeLoading,
          bonusEligible: ['campaign','daily'].includes(context?.mode) && context?.state.terminal === 'won' && meta.canClaimBonusStamp({claimId:bonusClaim()}) },
        message, aurora: entitlements.includes('supporter_aurora') || transientAurora };
    },
    async setConsent(value) {
      if (!TELEMETRY_ALLOWED && value) return;
      const resultPromise = telemetry.setConsent(value);
      if (!value) { attempts.clear(); attemptId = null; sessionStarted = false; try { sessionStorage.removeItem(ATTEMPTS_KEY); } catch { /* Optional. */ } }
      else { identify(); this.ready(); }
      message = value ? 'Anonymous gameplay analytics enabled. You can turn it off and delete your data here.' : 'Analytics off. Deleting previously sent data…';
      notify();
      const result = await resultPromise;
      if (!value) message = result.deleted ? 'Analytics off. Previous usage data deleted.' :
        'Analytics off. Server deletion could not be confirmed; stored usage expires within 35 days.';
      notify();
    },
    claimQuest(id) {
      const result = meta.claimQuest(id);
      if (result.accepted) event('ms_reward_claimed', { questId: id });
      message = result.accepted ? 'Stamp collected!' : 'That reward is not ready or was already collected.'; notify();
    },
    selectEmblem(id) { meta.selectEmblem(id); event('ms_collection_selected', { itemId: id }); notify(); },
    selectFrame(id) { meta.selectFrame(id); event('ms_collection_selected', { itemId: id }); notify(); },
    reloadMeta() { meta.reload(); notify(); },
    async openStore() {
      storeLoading = true; message = ''; notify();
      const available = await commerce.products(), verified = await commerce.verifyEntitlements();
      if (disposed) return;
      products = available; if(verified.status==='ok')entitlements=verified.entitlements; storeLoading = false;
      if (!products.length) message = 'The store is not available here yet. All levels and free rewards remain available.';
      else if(verified.status!=='ok')message='Purchases could not be verified. Reopen Telegram if your session expired, or try again when connected.';
      notify();
    },
    async purchase(id) {
      message = 'Opening secure payment…'; notify();
      const result = await commerce.purchase(id);
      if (disposed) return;
      const verified=await commerce.verifyEntitlements();
      if(verified.status==='ok')entitlements=verified.entitlements;
      message = result.status === 'completed' ? 'Aurora unlocked. Thank you for supporting Magnet Sort!' :
        result.status === 'cancelled' ? 'Purchase cancelled. Nothing was unlocked.' :
        result.status === 'pending' ? 'Payment is pending confirmation. Use Restore purchases shortly.' :
        'Purchase unavailable. Reopen the Mini App to refresh your Telegram session, or try again later.';
      notify();
    },
    async restore() {
      const verified=await commerce.verifyEntitlements();
      if(verified.status==='ok'){
        entitlements=verified.entitlements;
        message = entitlements.length ? 'Purchases restored.' : 'No confirmed purchases found for this Telegram account.';
      }else message='Purchases could not be verified. Your current cosmetics are kept. Reopen Telegram or try again when connected.';
      notify();
    },
    async rewarded() {
      if (!context?.state.terminal || context.state.terminal !== 'won') return;
      const beforeKey = boardKey(), claimId = bonusClaim();
      if(!meta.canClaimBonusStamp({claimId}))return;
      message = 'Opening ad for one bonus stamp…'; notify();
      const result = await commerce.rewarded('victory_stamp');
      if (disposed) return;
      if (result.status === 'completed' && result.completed === true && boardKey() === beforeKey) {
        const grant = meta.grantBonusStamp({ claimId });
        message = grant.accepted ? 'One bonus stamp collected!' : 'This board’s bonus was already collected.';
      } else message = 'Ad not completed. Your progress and rewards are unchanged.';
      notify();
    },
    async transition(next) {
      if(transitionPending||disposed)return;
      transitionPending=true;
      const original=JSON.stringify(getContext());
      // Providers control their own caps; never interrupt the first lesson.
      try {
        if (context?.state.terminal && context.state.levelNumber > 1 && commerce.capabilities().interstitial) {
          await commerce.interstitial('between_boards');
        }
        if (!disposed && JSON.stringify(getContext())===original) next();
      } finally {transitionPending=false;}
    },
    flush() { return telemetry.flush(); },
    end() { if (!ended) { ended = true; event('ms_session_ended'); void telemetry.flush(); } },
    dispose() { disposed = true; telemetry.dispose(); meta.dispose(); commerce.dispose(); },
  };
}
