import { compareRunResults } from './scoring.js';

export const PROGRESS_SCHEMA_VERSION = 3;
export const PROGRESS_STORAGE_KEY = 'magnet-sort.progress';
const MAX_CAMPAIGN_LEVEL = 50;

export function createDefaultProgress() {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    unlockedCampaignLevel: 1,
    completedPuzzles: [],
    bestResults: {},
    dailyResults: {},
    ftue: { seen: false, completed: false, skipped: false, unlockedLesson: 1 },
    settings: { reducedMotion: false, soundEnabled: true, hapticsEnabled: true },
  };
}

export function normalizeProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (![1, 2, PROGRESS_SCHEMA_VERSION].includes(value.schemaVersion)) return null;
  if (!Number.isInteger(value.unlockedCampaignLevel) || value.unlockedCampaignLevel < 1
    || value.unlockedCampaignLevel > MAX_CAMPAIGN_LEVEL) return null;
  if (!Array.isArray(value.completedPuzzles) || value.completedPuzzles.some((id) => typeof id !== 'string' || !id.trim())) return null;
  if (new Set(value.completedPuzzles).size !== value.completedPuzzles.length) return null;
  if (!value.bestResults || typeof value.bestResults !== 'object' || Array.isArray(value.bestResults)) return null;
  for (const [puzzleId, result] of Object.entries(value.bestResults)) {
    if (!isRunResult(result) || result.puzzleId !== puzzleId) return null;
  }
  const dailyResults = value.schemaVersion === 1 ? {} : value.dailyResults;
  if (!dailyResults || typeof dailyResults !== 'object' || Array.isArray(dailyResults)) return null;
  for (const [dailyId, entry] of Object.entries(dailyResults)) {
    if (!isDailyId(dailyId) || !entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.assisted !== 'boolean' || !isRunResult(entry.result)) return null;
  }
  if (!value.ftue || typeof value.ftue.seen !== 'boolean' || typeof value.ftue.completed !== 'boolean'
    || typeof value.ftue.skipped !== 'boolean' || !Number.isInteger(value.ftue.unlockedLesson)
    || value.ftue.unlockedLesson < 1 || value.ftue.unlockedLesson > 5) return null;
  if (!value.settings || typeof value.settings.reducedMotion !== 'boolean') return null;
  if (value.schemaVersion === PROGRESS_SCHEMA_VERSION
    && (typeof value.settings.soundEnabled !== 'boolean' || typeof value.settings.hapticsEnabled !== 'boolean')) return null;
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    unlockedCampaignLevel: value.unlockedCampaignLevel,
    completedPuzzles: [...new Set(value.completedPuzzles)].sort(compareIds),
    bestResults: structuredClone(value.bestResults),
    dailyResults: structuredClone(dailyResults),
    ftue: { seen: value.ftue.seen, completed: value.ftue.completed, skipped: value.ftue.skipped, unlockedLesson: value.ftue.unlockedLesson },
    settings: {
      reducedMotion: value.settings.reducedMotion,
      soundEnabled: value.schemaVersion === PROGRESS_SCHEMA_VERSION ? value.settings.soundEnabled : true,
      hapticsEnabled: value.schemaVersion === PROGRESS_SCHEMA_VERSION ? value.settings.hapticsEnabled : true,
    },
  };
}

export function loadProgress(storage) {
  const target = resolveStorage(storage);
  if (!target) return { progress: createDefaultProgress(), source: 'memory', reason: 'storage-unavailable' };
  try {
    const raw = target.getItem(PROGRESS_STORAGE_KEY);
    if (raw === null) return { progress: createDefaultProgress(), source: 'storage', reason: null };
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return { progress: createDefaultProgress(), source: 'memory', reason: 'corrupt-json' }; }
    const progress = normalizeProgress(parsed);
    return progress
      ? { progress, source: 'storage', reason: null }
      : { progress: createDefaultProgress(), source: 'memory', reason: parsed?.schemaVersion !== PROGRESS_SCHEMA_VERSION ? 'unsupported-version' : 'invalid-data' };
  } catch {
    return { progress: createDefaultProgress(), source: 'memory', reason: 'storage-unavailable' };
  }
}

export function saveProgress(progress, storage) {
  const normalized = normalizeProgress(progress);
  if (!normalized) return { saved: false, progress: createDefaultProgress(), reason: 'invalid-data' };
  const target = resolveStorage(storage);
  if (!target) return { saved: false, progress: normalized, reason: 'storage-unavailable' };
  try {
    target.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
    return { saved: true, progress: normalized, reason: null };
  } catch {
    return { saved: false, progress: normalized, reason: 'storage-write-failed' };
  }
}

export function recordRunResult(progress, result, { campaignNumber, ftueSeen, ftueLesson, ftueCompleted, ftueSkipped } = {}) {
  const current = normalizeProgress(progress) ?? createDefaultProgress();
  if (!isRunResult(result)) return current;
  const completedPuzzles = new Set(current.completedPuzzles);
  completedPuzzles.add(result.puzzleId);
  const previousBest = current.bestResults[result.puzzleId];
  const bestResults = { ...current.bestResults };
  const comparison = previousBest ? compareRunResults(result, previousBest) : null;
  if (!previousBest || comparison === null || comparison >= 0) {
    bestResults[result.puzzleId] = structuredClone(result);
  }
  const wonCampaignNumber = result.outcome === 'win' && Number.isInteger(campaignNumber)
    ? Math.min(MAX_CAMPAIGN_LEVEL, campaignNumber + 1)
    : current.unlockedCampaignLevel;
  const tutorialCampaignUnlock = ftueCompleted === true ? 6 : current.unlockedCampaignLevel;
  return normalizeProgress({
    ...current,
    unlockedCampaignLevel: Math.max(current.unlockedCampaignLevel, wonCampaignNumber, tutorialCampaignUnlock),
    completedPuzzles: [...completedPuzzles],
    bestResults,
    ftue: {
      seen: current.ftue.seen || ftueSeen === true || ftueCompleted === true || ftueSkipped === true,
      completed: current.ftue.completed || ftueCompleted === true,
      skipped: current.ftue.skipped || ftueSkipped === true,
      unlockedLesson: result.outcome === 'win' && Number.isInteger(ftueLesson)
        ? Math.min(5, Math.max(current.ftue.unlockedLesson, ftueLesson + 1))
        : current.ftue.unlockedLesson,
    },
  });
}

export function recordDailyRunResult(progress, dailyId, result) {
  const current = normalizeProgress(progress) ?? createDefaultProgress();
  if (!isDailyId(dailyId) || !isRunResult(result)) return current;
  const previous = current.dailyResults[dailyId];
  const comparison = previous ? compareRunResults(result, previous.result) : null;
  if (previous && comparison !== null && comparison < 0) return current;
  return normalizeProgress({
    ...current,
    dailyResults: {
      ...current.dailyResults,
      [dailyId]: { result: structuredClone(result), assisted: !result.eligibleForChallenge },
    },
  });
}

export function setProgressSetting(progress, key, value) {
  const current = normalizeProgress(progress) ?? createDefaultProgress();
  if (!['reducedMotion', 'soundEnabled', 'hapticsEnabled'].includes(key) || typeof value !== 'boolean') return current;
  return { ...current, settings: { ...current.settings, [key]: value } };
}

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage ?? null; }
  catch { return null; }
}

function isRunResult(result) {
  return Boolean(result && typeof result === 'object' && !Array.isArray(result)
    && typeof result.puzzleId === 'string' && result.puzzleId.trim()
    && Number.isInteger(result.contentVersion) && result.contentVersion > 0
    && Number.isInteger(result.rulesVersion) && result.rulesVersion > 0
    && ['win', 'loss'].includes(result.outcome)
    && Number.isFinite(result.score) && result.score >= 0
    && Number.isInteger(result.movesUsed) && result.movesUsed >= 0
    && Number.isFinite(result.activeTimeMs) && result.activeTimeMs >= 0);
}

function isDailyId(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function compareIds(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
