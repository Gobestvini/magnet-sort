const ASSISTED_KEYS = ['hint', 'undo', 'extraMove'];

export function createRunResult(state, activeTimeMs, assistedFlags = {}) {
  if (!state?.terminal || !['win', 'loss'].includes(state.terminal.outcome)) {
    throw new TypeError('RunResult requires a terminal GameState');
  }
  const flags = Object.fromEntries(ASSISTED_KEYS.map((key) => [key, assistedFlags[key] === true]));
  for (const [key, value] of Object.entries(assistedFlags)) {
    if (!ASSISTED_KEYS.includes(key)) flags[key] = value === true;
  }
  const clearedMass = state.clearedMass;
  const initialMass = state.initialMass;
  const clearPercent = initialMass > 0 ? Math.floor(100 * clearedMass / initialMass) : 0;
  return {
    schemaVersion: 1,
    rulesVersion: state.rulesVersion,
    puzzleId: state.puzzleId,
    contentVersion: state.contentVersion,
    seed: state.seed,
    mode: state.mode,
    outcome: state.terminal.outcome,
    reason: state.terminal.reason,
    score: 100 * clearedMass + 10 * state.mergedUnits + 50 * Math.max(0, state.chainLinks - 1),
    movesUsed: state.turn,
    clearPercent,
    clearedMass,
    activeTimeMs: Number.isFinite(activeTimeMs) ? Math.max(0, Math.round(activeTimeMs)) : 0,
    assistedFlags: flags,
    eligibilityVersion: 1,
    eligibleForChallenge: !Object.values(flags).some(Boolean),
  };
}

// Positive means left is the better compatible run; zero is a tie; null means incomparable.
export function compareRunResults(left, right) {
  if (!left || !right || left.puzzleId !== right.puzzleId || left.contentVersion !== right.contentVersion
    || left.rulesVersion !== right.rulesVersion || left.mode !== right.mode) return null;
  const outcomeRank = { win: 1, loss: 0 };
  if (outcomeRank[left.outcome] !== outcomeRank[right.outcome]) return outcomeRank[left.outcome] > outcomeRank[right.outcome] ? 1 : -1;
  if (left.score !== right.score) return left.score > right.score ? 1 : -1;
  if (left.movesUsed !== right.movesUsed) return left.movesUsed < right.movesUsed ? 1 : -1;
  if (left.activeTimeMs !== right.activeTimeMs) return left.activeTimeMs < right.activeTimeMs ? 1 : -1;
  return 0;
}
