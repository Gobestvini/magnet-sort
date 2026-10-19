import { createV4State, applyV4Magnet } from './model-v4.js';
import { v4Levels } from './levels-v4.js';
import { createAttempt, replayAttempt, emptyProgress, withAttempt, createProgressStore, MAX_ATTEMPT_ACTIONS } from './progress-v4.js';
const defaultRules = { createV4State, applyV4Magnet };

// One owner of committed gameplay, independent of DOM/Telegram/presentation.
// Transient attempts suspend the campaign; they never write its durable record.
export function createV4Session({ newSeed, fixedSeed = null, rules = defaultRules, initialLevelIndex = 0, ...storageOptions } = {}) {
  if (typeof newSeed !== 'function') throw new TypeError('A seed source is required');
  if (!Number.isInteger(initialLevelIndex) || !v4Levels[initialLevelIndex] || (rules !== defaultRules && fixedSeed === null))
    throw new TypeError('Experimental rules require a transient seed');
  const store = fixedSeed === null ? createProgressStore(storageOptions) : null;
  let progress = store?.loaded.progress;
  if (!progress) progress = emptyProgress(createAttempt(v4Levels[initialLevelIndex].id, fixedSeed ?? newSeed()));
  let campaign = { attempt: progress.activeAttempt,
    state: store?.loaded.state ?? rules.createV4State(v4Levels[initialLevelIndex], progress.activeAttempt.seed) };
  let transient = fixedSeed === null ? null : { ...campaign };
  let disposed = false;
  const current = () => transient ?? campaign;
  function persist() {
    if (transient || disposed || !store) return;
    progress = withAttempt(progress, campaign.attempt, campaign.state);
    if (campaign.attempt.actions.length > MAX_ATTEMPT_ACTIONS) store.suspend('action-limit');
    else store.save(progress);
  }
  // Entry policy runs once. Completing a turn itself never skips its result.
  if (!transient && campaign.state.terminal === 'won') {
    const index = v4Levels.findIndex(level => level.id === campaign.attempt.levelId);
    progress = withAttempt(progress, campaign.attempt, campaign.state);
    if (index < v4Levels.length - 1) {
      const attempt = createAttempt(v4Levels[index + 1].id, newSeed());
      campaign = { attempt, state: rules.createV4State(v4Levels[index + 1], attempt.seed) };
    }
  }
  persist();
  return {
    get state() { return current().state; },
    get attempt() { return structuredClone(current().attempt); },
    get progress() { return structuredClone(progress); },
    status() { return transient || !store ? { saved: false, reason: 'transient' } : store.status(); },
    checkConflict() { if (!transient && store) store.checkConflict(); },
    submit(action) {
      const active = current();
      if (disposed) return { accepted: false, reason: 'disposed', state: active.state, events: [] };
      const result = rules.applyV4Magnet(active.state, action);
      if (result.accepted) {
        active.state = result.state;
        active.attempt = { ...active.attempt, actions: [...active.attempt.actions,
          { type: 'placeMagnet', color: action.color, cell: { col: action.cell.col, row: action.cell.row } }] };
        persist(); // Synchronous and before the runtime begins presentation.
      }
      return result;
    },
    start(index, seed = fixedSeed ?? newSeed()) {
      if (disposed || !Number.isInteger(index) || !v4Levels[index]) throw new TypeError('Invalid level');
      const attempt = createAttempt(v4Levels[index].id, seed);
      const next = { attempt, state: rules.createV4State(v4Levels[index], seed) };
      if (transient) transient = next; else campaign = next;
      persist(); return next.state;
    },
    replaceAttempt(attempt, { transient: temporary = false } = {}) {
      if (disposed) throw Error('Session disposed');
      const replay = replayAttempt(attempt, rules);
      if (temporary) transient = replay;
      else if (transient) transient = replay;
      else { campaign = replay; persist(); }
      return replay.state;
    },
    leaveTransient() { transient = null; return campaign.state; },
    recoverSave() { return !transient && store.recover(progress); },
    dispose() { disposed = true; }
  };
}
