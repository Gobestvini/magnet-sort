import { applyAction, createInitialState } from './simulator.js';
import { ftueLevelIds, loadFtueLevel, loadPrototypeLevel, prototypeLevelIds, validateLevelDefinition } from './levels.js';
import { cloneState } from './state.js';
import { createRunResult } from './scoring.js';

const DEFAULT_RESOLVE_SECONDS = 0.22;

function phaseForState(state) {
  if (state.terminal?.outcome === 'win') return 'won';
  if (state.terminal?.outcome === 'loss') return 'lost';
  return 'playing';
}

export function createSession({ initialPuzzleId, skipTutorial = false, resolveSeconds = DEFAULT_RESOLVE_SECONDS } = {}) {
  const puzzleIds = prototypeLevelIds();
  const lessonIds = ftueLevelIds();
  let route = skipTutorial || initialPuzzleId ? 'prototype' : 'ftue';
  let puzzleIndex = Math.max(0, puzzleIds.indexOf(initialPuzzleId ?? puzzleIds[0]));
  let lessonIndex = 0;
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

  function installLevel(nextLevel) {
    try {
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
    return route === 'ftue'
      ? installLevel(loadFtueLevel(lessonIds[lessonIndex]))
      : installLevel(loadPrototypeLevel(puzzleIds[puzzleIndex]));
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
    finishResolution() {
      if (phase !== 'resolving') return false;
      settleResolution();
      return true;
    },
    reset() {
      if (!level) return loadCurrent();
      return installLevel(level);
    },
    retry() { return this.reset(); },
    nextPuzzle() {
      if (route === 'ftue') {
        if (phase !== 'won') return false;
        if (lessonIndex < lessonIds.length - 1) lessonIndex += 1;
        else { route = 'prototype'; puzzleIndex = 0; }
      } else {
        if (!['won', 'lost'].includes(phase)) return false;
        puzzleIndex = (puzzleIndex + 1) % puzzleIds.length;
      }
      return loadCurrent();
    },
    skipTutorial() {
      if (route !== 'ftue' || phase !== 'playing') return false;
      route = 'prototype';
      tutorialSkipped = true;
      puzzleIndex = 0;
      return loadCurrent();
    },
    loadTestLevel(testLevel) {
      route = 'prototype';
      tutorialSkipped = true;
      return installLevel(testLevel);
    },
    snapshot() {
      return {
        phase,
        error,
        puzzleId: level?.puzzleId ?? puzzleIds[puzzleIndex],
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
