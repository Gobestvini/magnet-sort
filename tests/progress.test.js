import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultProgress, loadProgress, normalizeProgress,
  recordRunResult, saveProgress, setProgressSetting,
} from '../src/game/progress.js';

function memoryStorage(initial = null, fail = {}) {
  let value = initial;
  return {
    getItem() { if (fail.read) throw new Error('security'); return value; },
    setItem(_key, next) { if (fail.write) throw new Error('quota'); value = next; },
    value() { return value; },
  };
}

const win = { schemaVersion: 1, rulesVersion: 1, puzzleId: 'campaign-01', contentVersion: 1, mode: 'campaign', outcome: 'win', reason: 'clear-all', score: 500, movesUsed: 2, clearPercent: 100, clearedMass: 5, activeTimeMs: 8000, assistedFlags: {}, eligibilityVersion: 1, eligibleForChallenge: true };
const loss = { ...win, outcome: 'loss', reason: 'move-limit', score: 200, movesUsed: 3, clearPercent: 40 };

test('normal load and reload preserve versioned progress', () => {
  const storage = memoryStorage();
  const first = loadProgress(storage);
  assert.equal(first.progress.unlockedCampaignLevel, 1);
  assert.equal(first.progress.ftue.seen, false);
  assert.equal(saveProgress(first.progress, storage).saved, true);
  assert.equal(loadProgress(storage).source, 'storage');
  assert.deepEqual(loadProgress(storage).progress, first.progress);
  assert.equal(storage.value() !== null, true);
});

test('corrupt data, unavailable storage, and unknown schema fall back without throwing', () => {
  assert.equal(loadProgress(memoryStorage('{')).reason, 'corrupt-json');
  assert.equal(loadProgress(memoryStorage(JSON.stringify({ schemaVersion: 8 }))).reason, 'unsupported-version');
  assert.equal(loadProgress(memoryStorage(null, { read: true })).reason, 'storage-unavailable');
  assert.equal(loadProgress(null).progress.unlockedCampaignLevel, 1);
  const denied = saveProgress(createDefaultProgress(), memoryStorage(null, { write: true }));
  assert.equal(denied.saved, false);
  assert.equal(denied.reason, 'storage-write-failed');
});

test('malformed bounds and duplicate completion ids are rejected explicitly', () => {
  const base = createDefaultProgress();
  assert.equal(normalizeProgress({ ...base, unlockedCampaignLevel: 51 }), null);
  assert.equal(normalizeProgress({ ...base, completedPuzzles: ['x', 'x'] }), null);
  assert.equal(normalizeProgress({ ...base, ftue: { ...base.ftue, unlockedLesson: 6 } }), null);
});

test('only wins unlock campaign; best results use the shared comparator and retry does not erase progress', () => {
  let progress = recordRunResult(createDefaultProgress(), loss, { campaignNumber: 1 });
  assert.equal(progress.unlockedCampaignLevel, 1);
  progress = recordRunResult(progress, win, { campaignNumber: 1 });
  assert.equal(progress.unlockedCampaignLevel, 2);
  assert.equal(progress.bestResults['campaign-01'].outcome, 'win');
  progress = recordRunResult(progress, { ...loss, puzzleId: 'campaign-02' }, { campaignNumber: 2 });
  assert.equal(progress.unlockedCampaignLevel, 2);
  assert.equal(progress.completedPuzzles.includes('campaign-01'), true);
  assert.equal(progress.completedPuzzles.includes('campaign-02'), true);
  const retried = recordRunResult(progress, win, { campaignNumber: 1 });
  assert.equal(retried.unlockedCampaignLevel, 2);
  assert.equal(retried.completedPuzzles.length, 2);
});

test('FTUE advancement and settings persist independently of a fresh run', () => {
  let progress = recordRunResult(createDefaultProgress(), { ...win, puzzleId: 'ftue-01-place', mode: 'campaign' }, { ftueSeen: true, ftueLesson: 1 });
  assert.deepEqual(progress.ftue, { seen: true, completed: false, skipped: false, unlockedLesson: 2 });
  progress = recordRunResult(progress, { ...win, puzzleId: 'ftue-05-chain' }, { ftueSeen: true, ftueLesson: 5, ftueCompleted: true });
  assert.equal(progress.ftue.completed, true);
  assert.equal(progress.ftue.unlockedLesson, 5);
  assert.equal(progress.unlockedCampaignLevel, 6);
  progress = setProgressSetting(progress, 'reducedMotion', true);
  assert.equal(progress.settings.reducedMotion, true);
  assert.equal(saveProgress(progress, memoryStorage()).saved, true);
});
