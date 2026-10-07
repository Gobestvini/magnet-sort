import { applyAction, createInitialState } from './simulator.js';
import { campaignLevelIds, ftueLevelIds, loadCampaignLevel, loadFtueLevel, loadPrototypeLevel, prototypeLevelIds, validateLevelDefinition } from './levels.js';
import { cloneState } from './state.js';
import { createRunResult } from './scoring.js';
import { BOOSTER_LIMITS, addOneMove, canAddExtraMove, createHintResolver } from './boosters.js';

const DEFAULT_RESOLVE_SECONDS = 0.22;

function phaseForState(state) {
  if (state.terminal?.outcome === 'win') return 'won';
  if (state.terminal?.outcome === 'loss') return 'lost';
  return 'playing';
}

export function createSession({ initialPuzzleId, campaignPuzzleId, challengePuzzleId, dailyPuzzleId, dailyId, ftuePuzzleId, skipTutorial = false, resolveSeconds = DEFAULT_RESOLVE_SECONDS, grantReward = () => ({ granted: false, reason: 'placement-unconfigured' }) } = {}) {
  const puzzleIds = prototypeLevelIds();
  const campaignIds = campaignLevelIds();
  const lessonIds = ftueLevelIds();
  let route = challengePuzzleId ? 'challenge' : dailyPuzzleId ? 'daily' : campaignPuzzleId ? 'campaign' : skipTutorial || initialPuzzleId ? 'prototype' : 'ftue';
  let sharedPuzzleId = challengePuzzleId;
  let activeDailyId = dailyId ?? null;
  let sharedDailyPuzzleId = dailyPuzzleId ?? null;
  let puzzleIndex = Math.max(0, puzzleIds.indexOf(initialPuzzleId ?? puzzleIds[0]));
  let campaignIndex = Math.max(0, campaignIds.indexOf(campaignPuzzleId ?? campaignIds[0]));
  let lessonIndex = Math.max(0, lessonIds.indexOf(ftuePuzzleId ?? lessonIds[0]));
  let tutorialSkipped = Boolean(skipTutorial || initialPuzzleId);
  let tutorialCompleted = false;
  let level = null;
  let state = null;
  let phase = 'loading';
  let error = null;
  let lastEvents = [];
  let resolveRemaining = 0;
  let activeTimeSeconds = 0;
  let assistedFlags = {};
  let runResult = null;
  let tutorialHintElapsed = 0;
  let tutorialHintDismissed = false;
  let undoSnapshot = null;
  let undoUsed = false;
  let hintUsed = false;
  let hintAction = null;
  let extraMoveUsed = false;
  let rewardProvider = 'standalone-test';
  const hintResolver = createHintResolver();

  function installLevel(nextLevel) {
    try {
      hintResolver.cancel();
      level = validateLevelDefinition(nextLevel);
      state = createInitialState(level);
      phase = phaseForState(state);
      error = null;
      lastEvents = [];
      resolveRemaining = 0;
      activeTimeSeconds = 0;
      assistedFlags = {};
      runResult = null;
      tutorialHintElapsed = 0;
      tutorialHintDismissed = false;
      undoSnapshot = null;
      undoUsed = false;
      hintUsed = false;
      hintAction = null;
      extraMoveUsed = false;
      rewardProvider = 'standalone-test';
      return true;
    } catch (caught) {
      level = null;
      state = null;
      phase = 'error';
      error = caught instanceof Error ? caught.message : String(caught);
      lastEvents = [];
      resolveRemaining = 0;
      return false;
    }
  }

  function loadCurrent() {
    if (route === 'ftue') return installLevel(loadFtueLevel(lessonIds[lessonIndex]));
    if (route === 'campaign') return installLevel(loadCampaignLevel(campaignIds[campaignIndex]));
    if (route === 'daily') return installLevel(loadCampaignLevel(sharedDailyPuzzleId));
    if (route === 'challenge') return installLevel(loadSharedPuzzle(sharedPuzzleId));
    return installLevel(loadPrototypeLevel(puzzleIds[puzzleIndex]));
  }

  function settleResolution() {
    resolveRemaining = 0;
    phase = phaseForState(state);
    if (phase === 'won' || phase === 'lost') {
      runResult ??= createRunResult(state, activeTimeSeconds * 1000, assistedFlags);
      if (phase === 'won' && route === 'ftue' && lessonIndex === lessonIds.length - 1) tutorialCompleted = true;
    }
  }

  loadCurrent();

  return {
    getLevel() { return level; },
    getState() { return state; },
    dispatch(action) {
      if (phase !== 'playing') return { accepted: false, reason: `session-${phase}`, state };
      const result = applyAction(state, action);
      if (!result.accepted) return result;
      undoSnapshot = cloneState(state);
      hintAction = null;
      tutorialHintDismissed = true;
      state = result.state;
      lastEvents = result.events.map((event) => structuredClone(event));
      resolveRemaining = Math.max(0, Number.isFinite(resolveSeconds) ? resolveSeconds : DEFAULT_RESOLVE_SECONDS);
      phase = 'resolving';
      if (resolveRemaining === 0) settleResolution();
      return result;
    },
    update(dt) {
      if (phase !== 'resolving' || !Number.isFinite(dt) || dt <= 0) return false;
      activeTimeSeconds += dt;
      resolveRemaining = Math.max(0, resolveRemaining - dt);
      if (resolveRemaining === 0) settleResolution();
      return true;
    },
    advanceActiveTime(dt) {
      if (!['playing', 'resolving'].includes(phase) || !Number.isFinite(dt) || dt <= 0) return false;
      activeTimeSeconds += dt;
      if (route === 'ftue' && lessonIndex === 0 && !tutorialHintDismissed) {
        tutorialHintElapsed = Math.min(3, tutorialHintElapsed + dt);
      }
      return true;
    },
    markAssisted(flag) {
      if (!['playing', 'resolving'].includes(phase) || typeof flag !== 'string' || !flag.trim()) return false;
      assistedFlags[flag] = true;
      return true;
    },
    undo() {
      if (!undoSnapshot || undoUsed || !['playing', 'lost'].includes(phase)) {
        return { accepted: false, reason: 'undo-unavailable' };
      }
      state = cloneState(undoSnapshot);
      undoSnapshot = null;
      undoUsed = true;
      hintAction = null;
      assistedFlags.undo = true;
      lastEvents = [];
      resolveRemaining = 0;
      runResult = null;
      phase = phaseForState(state);
      return { accepted: true, state: cloneState(state) };
    },
    requestHint() {
      if (phase !== 'playing') return { available: false, reason: 'session-not-playing' };
      if (hintUsed) return { available: false, reason: 'hint-already-used' };
      const hint = hintResolver.request(level, state);
      if (!hint.available) return hint;
      hintUsed = true;
      hintAction = structuredClone(hint.action);
      assistedFlags.hint = true;
      return { ...hint, action: structuredClone(hintAction) };
    },
    applyHint() {
      if (!hintAction || phase !== 'playing') return { accepted: false, reason: 'no-active-hint', state };
      return this.dispatch(structuredClone(hintAction));
    },
    requestExtraMove() {
      if (extraMoveUsed) return { granted: false, reason: 'extra-move-already-used' };
      if (!canAddExtraMove(state, phase)) return { granted: false, reason: 'extra-move-unavailable' };
      let grant;
      try { grant = grantReward('extraMove'); }
      catch { return { granted: false, reason: 'grant-failed' }; }
      return this.confirmExtraMove(grant);
    },
    confirmExtraMove(grant) {
      if (extraMoveUsed) return { granted: false, reason: 'extra-move-already-used' };
      if (!canAddExtraMove(state, phase)) return { granted: false, reason: 'extra-move-unavailable' };
      if (!grant || grant.granted !== true) return { granted: false, reason: grant?.reason ?? 'grant-denied' };
      const next = addOneMove(state);
      if (!next) return { granted: false, reason: 'extra-move-unavailable' };
      state = next;
      extraMoveUsed = true;
      rewardProvider = typeof grant.provider === 'string' ? grant.provider : 'unknown-provider';
      assistedFlags.extraMove = true;
      hintAction = null;
      lastEvents = [];
      runResult = null;
      phase = 'playing';
      return { granted: true, provider: rewardProvider, state: cloneState(state) };
    },
    finishResolution() {
      if (phase !== 'resolving') return false;
      settleResolution();
      return true;
    },
    reset() {
      hintResolver.cancel();
      if (!level) return loadCurrent();
      return installLevel(level);
    },
    retry() { return this.reset(); },
    dispose() { hintResolver.dispose(); hintAction = null; undoSnapshot = null; },
    nextPuzzle() {
      if (route === 'ftue') {
        if (phase !== 'won') return false;
        if (lessonIndex < lessonIds.length - 1) lessonIndex += 1;
        else { route = 'campaign'; campaignIndex = Math.min(5, campaignIds.length - 1); }
      } else if (route === 'campaign') {
        if (phase !== 'won' || campaignIndex >= campaignIds.length - 1) return false;
        campaignIndex += 1;
      } else if (route === 'challenge' || route === 'daily') {
        return false;
      } else {
        if (!['won', 'lost'].includes(phase)) return false;
        puzzleIndex = (puzzleIndex + 1) % puzzleIds.length;
      }
      return loadCurrent();
    },
    skipTutorial() {
      if (route !== 'ftue' || phase !== 'playing') return false;
      route = 'campaign';
      tutorialSkipped = true;
      campaignIndex = Math.min(5, campaignIds.length - 1);
      return loadCurrent();
    },
    startFromProgress({ campaignPuzzleId: nextCampaignId, ftuePuzzleId: nextFtueId } = {}) {
      if (nextCampaignId && campaignIds.includes(nextCampaignId)) {
        route = 'campaign';
        campaignIndex = campaignIds.indexOf(nextCampaignId);
        tutorialSkipped = false;
      } else {
        route = 'ftue';
        lessonIndex = Math.max(0, lessonIds.indexOf(nextFtueId ?? lessonIds[0]));
        tutorialSkipped = false;
      }
      return loadCurrent();
    },
    startChallenge(puzzleId) {
      sharedPuzzleId = puzzleId;
      route = 'challenge';
      tutorialSkipped = true;
      return loadCurrent();
    },
    startDaily(nextDailyId, puzzleId) {
      if (typeof nextDailyId !== 'string' || typeof puzzleId !== 'string' || !campaignIds.includes(puzzleId)) return false;
      activeDailyId = nextDailyId;
      sharedDailyPuzzleId = puzzleId;
      route = 'daily';
      tutorialSkipped = true;
      return loadCurrent();
    },
    loadTestLevel(testLevel) {
      hintResolver.cancel();
      route = 'prototype';
      tutorialSkipped = true;
      return installLevel(testLevel);
    },
    snapshot() {
      return {
        phase,
        error,
        puzzleId: level?.puzzleId ?? puzzleIds[puzzleIndex],
        campaignNumber: level?.campaignNumber ?? null,
        challenge: route === 'challenge',
        daily: route === 'daily',
        dailyId: route === 'daily' ? activeDailyId : null,
        goal: level ? { ...level.goal } : null,
        colors: level ? [...level.colors] : [],
        state: state ? cloneState(state) : null,
        movesUsed: state?.turn ?? 0,
        remainingMoves: state?.remainingMoves ?? null,
        availableColors: state ? [...state.selectedMagnetOptions] : [],
        events: lastEvents.map((event) => structuredClone(event)),
        resolveRemaining,
        activeTimeMs: Math.max(0, Math.round(activeTimeSeconds * 1000)),
        assistedFlags: { ...assistedFlags },
        hintAction: hintAction ? structuredClone(hintAction) : null,
        boosters: {
          limits: { ...BOOSTER_LIMITS },
          undoAvailable: Boolean(undoSnapshot) && !undoUsed && ['playing', 'lost'].includes(phase),
          hintAvailable: !hintUsed && phase === 'playing',
          extraMoveAvailable: !extraMoveUsed && canAddExtraMove(state, phase),
          rewardProvider,
        },
        result: runResult ? structuredClone(runResult) : null,
        tutorial: {
          active: route === 'ftue',
          completed: tutorialCompleted,
          skipped: tutorialSkipped,
          lessonIndex: route === 'ftue' ? lessonIndex + 1 : null,
          lessonCount: lessonIds.length,
          title: route === 'ftue' && level ? level.tutorial?.title ?? `Урок ${lessonIndex + 1}` : null,
          instruction: route === 'ftue' ? level?.tutorial?.instruction ?? '' : null,
          focus: route === 'ftue' && level?.tutorial?.focus ? structuredClone(level.tutorial.focus) : null,
          hint: route === 'ftue' && lessonIndex === 0 && !tutorialHintDismissed && tutorialHintElapsed < 3 && level?.tutorial?.focus
            ? { active: true, elapsed: tutorialHintElapsed, progress: tutorialHintElapsed / 3, ...structuredClone(level.tutorial.focus) }
            : null,
          nextLabel: route === 'ftue' ? (lessonIndex === lessonIds.length - 1 ? 'Начать игру' : 'Следующий урок') : 'Следующий уровень',
        },
      };
    },
  };
}

function loadSharedPuzzle(puzzleId) {
  if (campaignLevelIds().includes(puzzleId)) return loadCampaignLevel(puzzleId);
  if (ftueLevelIds().includes(puzzleId)) return loadFtueLevel(puzzleId);
  return loadPrototypeLevel(puzzleId);
}
