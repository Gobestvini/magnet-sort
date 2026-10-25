import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaProgress, META_PROGRESS_KEY, META_HISTORY_WEEKS, META_MAX_WEEK_BOARDS, META_MAX_WINS,
  normalizeMetaProgress, utcWeek, EMBLEMS } from '../src/meta/progress.js';
import { getDaily } from '../src/prototype/daily-v4.js';

function memory() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const baseDate = '2026-10-25T14:00:00Z';
const campaign = (number = 1, seed = 1, extra = {}) => ({ mode: 'campaign', levelId: `magnet-v4-${String(number).padStart(2, '0')}`,
  seed, outcome: 'won', moves: 7, cleared: number * 50, assisted: false, attemptId: 'attempt-' + seed, ...extra });
const daily = (date = baseDate, extra = {}) => ({ mode: 'daily', ...getDaily(date), outcome: 'won', moves: 8, cleared: 70, assisted: false, ...extra });
const quest = (meta, id) => meta.snapshot().quests.find(entry => entry.id === id);

test('UTC ISO week handles Sunday, Monday, offsets and year boundary without reading local timezone', () => {
  assert.deepEqual(utcWeek(baseDate), { id: '2026-W43', start: '2026-10-19', end: '2026-10-26' });
  assert.equal(utcWeek('2026-10-26T00:00:00Z').id, '2026-W44');
  assert.equal(utcWeek('2026-10-25T23:00:00-02:00').id, '2026-W44');
  assert.deepEqual(utcWeek('2021-01-01'), { id: '2020-W53', start: '2020-12-28', end: '2021-01-04' });
  assert.throws(() => utcWeek('invalid'));
});

test('new progress is read-only until a result, with attainable locked cosmetic collection', () => {
  const storage = memory(), meta = createMetaProgress({ storage, now: () => baseDate });
  assert.equal(storage.getItem(META_PROGRESS_KEY), null);
  assert.deepEqual(meta.snapshot().quests.map(entry => entry.progress), [0, 0, 0]);
  assert.deepEqual(EMBLEMS.map(entry => entry.threshold), [1, 2, 3, 6, 9, 12]);
  assert.ok(meta.snapshot().emblems.every(entry => !entry.unlocked));
  assert.equal(meta.selectEmblem('violet').reason, 'locked-emblem');
  assert.equal(meta.claimQuest('campaign-wins').reason, 'incomplete-quest');
  assert.equal(storage.getItem(META_PROGRESS_KEY), null);
});

test('campaign board counts once globally and once each week; different seeds do not fake different levels', () => {
  const storage = memory(); let date = baseDate;
  const meta = createMetaProgress({ storage, now: () => date });
  assert.equal(meta.recordResult(campaign()).newWin, true);
  assert.equal(meta.recordResult(campaign()).reason, 'duplicate');
  assert.equal(meta.recordResult(campaign(1, 1, { attemptId: 'new-id', assisted: true })).reason, 'duplicate');
  assert.equal(meta.recordResult(campaign(1, 2)).newWin, true);
  assert.equal(quest(meta, 'campaign-wins').progress, 1);
  assert.equal(meta.snapshot().uniqueWins, 2);
  const reload = createMetaProgress({ storage, now: () => date });
  assert.equal(reload.recordResult(campaign()).reason, 'duplicate');
  date = '2026-10-26T12:00:00Z';
  assert.equal(meta.snapshot().weekId, '2026-W44');
  assert.equal(quest(meta, 'campaign-wins').progress, 0);
  assert.equal(meta.recordResult(campaign()).newWin, false);
  assert.equal(quest(meta, 'campaign-wins').progress, 1);
  assert.equal(meta.snapshot().uniqueWins, 2);
});

test('lost and improved results add only best-cleared delta; winning upgrades same board once', () => {
  const meta = createMetaProgress({ storage: memory(), now: () => baseDate });
  assert.equal(meta.recordResult(campaign(1, 1, { outcome: 'lost', cleared: 20 })).accepted, true);
  assert.equal(meta.snapshot().uniqueWins, 0);
  assert.equal(quest(meta, 'campaign-cleared').progress, 20);
  assert.equal(meta.recordResult(campaign(1, 1, { outcome: 'lost', cleared: 10 })).reason, 'duplicate');
  assert.equal(meta.recordResult(campaign(1, 1, { outcome: 'lost', cleared: 30 })).accepted, true);
  assert.equal(quest(meta, 'campaign-cleared').progress, 30);
  assert.equal(meta.recordResult(campaign(1, 1, { cleared: 50 })).newWin, true);
  assert.equal(quest(meta, 'campaign-cleared').progress, 50);
  assert.equal(quest(meta, 'campaign-wins').progress, 1);
  assert.equal(meta.recordResult(campaign(2)).accepted, true);
  assert.equal(quest(meta, 'campaign-cleared').progress, 100);
});

test('quest claims persist exactly once and emblem selection never affects game save keys', () => {
  const storage = memory(); storage.setItem('magnet-sort.v4.progress.v1', 'untouched');
  const meta = createMetaProgress({ storage, now: () => baseDate });
  for (let level = 1; level <= 3; level++) meta.recordResult(campaign(level));
  assert.equal(quest(meta, 'campaign-wins').complete, true);
  assert.deepEqual(meta.claimQuest('campaign-wins'), { accepted: true, reward: 1, questId: 'campaign-wins', changed: true });
  assert.equal(meta.claimQuest('campaign-wins').reason, 'already-claimed');
  assert.equal(meta.claimQuest('campaign-cleared').accepted, true);
  assert.equal(meta.snapshot().stamps, 2);
  assert.equal(meta.selectEmblem('coral').accepted, true);
  assert.equal(meta.selectEmblem('gold').reason, 'locked-emblem');
  const resumed = createMetaProgress({ storage, now: () => baseDate });
  assert.equal(resumed.snapshot().selectedEmblem, 'coral');
  assert.equal(resumed.snapshot().stamps, 2);
  assert.equal(resumed.claimQuest('campaign-wins').reason, 'already-claimed');
  storage.removeItem('magnet-sort.v4.progress.v1');
  assert.equal(resumed.snapshot().uniqueWins, 3, 'campaign reset cannot reset cosmetics');
  assert.ok([...storage.data.keys()].every(key => key === META_PROGRESS_KEY));
});

test('Daily accepts only current catalog board and current date, never increasing campaign collection', () => {
  let date = baseDate;
  const meta = createMetaProgress({ storage: memory(), now: () => date });
  assert.equal(meta.recordResult(daily()).accepted, true);
  assert.equal(quest(meta, 'daily-win').progress, 1);
  assert.equal(meta.snapshot().uniqueWins, 0);
  assert.equal(quest(meta, 'campaign-cleared').progress, 0);
  assert.equal(meta.recordResult(daily()).reason, 'duplicate');
  assert.equal(meta.recordResult(daily('2026-10-24')).reason, 'ineligible-daily');
  assert.equal(meta.recordResult(daily(baseDate, { seed: 0xffffffff })).reason, 'invalid-result');
  assert.equal(meta.claimQuest('daily-win').accepted, true);
  date = '2026-10-26T00:00:00Z';
  assert.equal(meta.recordResult(daily()).reason, 'ineligible-daily', 'attempt pinned to yesterday is not today\'s Daily');
  assert.equal(meta.recordResult(daily(date)).accepted, true);
  assert.equal(meta.claimQuest('daily-win').accepted, true);
  assert.equal(meta.snapshot().stamps, 2);
});

test('invalid and nonterminal events cannot change progress', () => {
  const storage = memory(), meta = createMetaProgress({ storage, now: () => baseDate });
  for (const change of [{ mode: 'challenge' }, { outcome: 'playing' }, { cleared: NaN }, { cleared: -1 },
    { moves: 0 }, { moves: 2049 }, { seed: -1 }, { seed: 0x100000000 }, { levelId: 'magnet-v4-99' }, { assisted: undefined }])
    assert.equal(meta.recordResult(campaign(1, 1, change)).reason, 'invalid-result');
  assert.equal(meta.claimQuest('__proto__').reason, 'unknown-quest');
  assert.equal(meta.selectEmblem('unlimited').reason, 'unknown-emblem');
  assert.equal(storage.getItem(META_PROGRESS_KEY), null);
});

test('clock rollback cannot reopen a previous week or award results and claims', () => {
  let date = '2026-10-26T01:00:00Z';
  const storage = memory(), meta = createMetaProgress({ storage, now: () => date });
  meta.recordResult(campaign());
  date = '2026-10-25T12:00:00Z';
  assert.equal(meta.snapshot().weekId, '2026-W44');
  assert.equal(meta.snapshot().status.clockRollback, true);
  assert.equal(meta.recordResult(campaign(2)).reason, 'clock-rollback');
  assert.equal(meta.claimQuest('campaign-wins').reason, 'clock-rollback');
  assert.equal(meta.selectEmblem('violet').accepted, true, 'owned cosmetic remains selectable');
  date = '2026-10-26T02:00:00Z';
  assert.equal(meta.snapshot().status.clockRollback, false);
  assert.equal(meta.recordResult(campaign(2)).accepted, true);
});

test('history is bounded while all-time collection dedupe survives expiry', () => {
  let millis = Date.parse('2026-01-05T12:00:00Z');
  const storage = memory(), meta = createMetaProgress({ storage, now: () => millis });
  for (let week = 0; week < 12; week++) {
    meta.recordResult(campaign());
    millis += 7 * 86400000;
  }
  const stored = JSON.parse(storage.getItem(META_PROGRESS_KEY));
  assert.equal(stored.weeks.length, META_HISTORY_WEEKS);
  assert.equal(meta.snapshot().uniqueWins, 1);
  assert.equal(meta.recordResult(campaign()).newWin, false);
});

test('stale tabs refuse writes and can explicitly reload; primary storage remains unchanged', () => {
  const storage = memory(), a = createMetaProgress({ storage, now: () => baseDate }), b = createMetaProgress({ storage, now: () => baseDate });
  a.recordResult(campaign());
  const saved = storage.getItem(META_PROGRESS_KEY);
  assert.equal(b.recordResult(campaign(2)).reason, 'conflict');
  assert.equal(storage.getItem(META_PROGRESS_KEY), saved);
  assert.equal(b.snapshot().status.reason, 'conflict');
  assert.equal(b.reload(), true);
  assert.equal(b.recordResult(campaign(2)).accepted, true);
  assert.equal(b.snapshot().uniqueWins, 2);
  assert.equal(a.snapshot().status.reason, 'conflict');
});

test('blocked/corrupt storage is visible, preserved, and cannot produce apparent persisted rewards', () => {
  const blocked = createMetaProgress({ storage: null, now: () => baseDate });
  assert.equal(blocked.snapshot().status.reason, 'storage-unavailable');
  assert.equal(blocked.recordResult(campaign()).accepted, false);
  const storage = memory(); storage.setItem(META_PROGRESS_KEY, '{broken');
  const bad = createMetaProgress({ storage, now: () => baseDate });
  assert.equal(bad.snapshot().status.reason, 'invalid-data');
  assert.equal(bad.recordResult(campaign()).reason, 'invalid-data');
  assert.equal(storage.getItem(META_PROGRESS_KEY), '{broken');
  storage.setItem(META_PROGRESS_KEY, JSON.stringify({ schemaVersion: 42 }));
  assert.equal(bad.reload(), false);
  assert.equal(bad.snapshot().status.reason, 'unsupported-version');
  const denied = createMetaProgress({ storage: { getItem: () => null, setItem() { throw new Error('quota'); } }, now: () => baseDate });
  assert.equal(denied.recordResult(campaign()).reason, 'storage-write-failed');
  assert.equal(denied.snapshot().uniqueWins, 0);
});

test('malformed saved claims, duplicate wins and locked selections are rejected', () => {
  const storage = memory(), meta = createMetaProgress({ storage, now: () => baseDate });
  meta.recordResult(campaign());
  const valid = JSON.parse(storage.getItem(META_PROGRESS_KEY));
  for (const alter of [value => value.wins.push(value.wins[0]), value => { value.selectedEmblem = 'teal'; },
    value => { value.weeks[0].claimed = ['campaign-wins']; value.stamps = 1; },
    value => { value.weeks[0].boards[0].bestCleared = Infinity; },
    value => { value.weeks[0].boards[0].seed = 42; }]) {
    const copy = structuredClone(valid); alter(copy);
    assert.throws(() => normalizeMetaProgress(copy));
  }
});

test('weekly capacity refuses new fingerprints rather than evicting dedupe records', () => {
  const meta = createMetaProgress({ storage: memory(), now: () => baseDate });
  for (let seed = 0; seed < META_MAX_WEEK_BOARDS; seed++) assert.equal(meta.recordResult(campaign(1, seed, { outcome: 'lost', cleared: 1 })).accepted, true);
  assert.equal(meta.recordResult(campaign(1, META_MAX_WEEK_BOARDS)).reason, 'capacity');
  assert.equal(meta.recordResult(campaign(1, 0, { outcome: 'lost', cleared: 1 })).reason, 'duplicate');
});

test('all-time collection capacity refuses a new win without dropping old fingerprints', () => {
  const storage = memory(), initial = createMetaProgress({ storage, now: () => baseDate });
  initial.recordResult(campaign());
  const full = JSON.parse(storage.getItem(META_PROGRESS_KEY));
  full.wins = Array.from({ length: META_MAX_WINS }, (_, seed) => ({ levelId: 'magnet-v4-01', seed }));
  storage.setItem(META_PROGRESS_KEY, JSON.stringify(full));
  const meta = createMetaProgress({ storage, now: () => baseDate });
  assert.equal(meta.snapshot().uniqueWins, META_MAX_WINS);
  const before = storage.getItem(META_PROGRESS_KEY);
  assert.equal(meta.recordResult(campaign(2, 100)).reason, 'capacity');
  assert.equal(storage.getItem(META_PROGRESS_KEY), before);
});

test('snapshots are detached and disposed owners cannot claim or change records', () => {
  const meta = createMetaProgress({ storage: memory(), now: () => baseDate });
  meta.recordResult(campaign());
  const snapshot = meta.snapshot(); snapshot.emblems[0].unlocked = false; snapshot.quests[0].progress = 300;
  assert.equal(meta.snapshot().emblems[0].unlocked, true);
  assert.equal(meta.snapshot().quests[0].progress, 1);
  meta.dispose();
  assert.equal(meta.recordResult(campaign(2)).reason, 'disposed');
  assert.equal(meta.selectEmblem('violet').reason, 'disposed');
  assert.equal(meta.reload(), false);
});

test('cosmetic bonus stamp requires a completed board and a stable deduplicated claim', () => {
  const storage = memory(), meta = createMetaProgress({ storage, now: () => baseDate });
  const claimId = 'victory-stamp:2026-W43:campaign:magnet-v4-01:1';
  assert.equal(meta.grantBonusStamp({ claimId }).reason, 'ineligible-claim');
  assert.equal(meta.grantBonusStamp({ claimId: 'random-invoice' }).reason, 'invalid-claim');
  meta.recordResult(campaign());
  assert.equal(meta.grantBonusStamp({ claimId }).stamps, 1);
  assert.equal(meta.grantBonusStamp({ claimId }).reason, 'already-claimed');
  assert.equal(meta.grantBonusStamp({ claimId: 'victory-stamp:2026-W43:campaign:magnet-v4-01:2' }).reason, 'ineligible-claim');
  const reloaded = createMetaProgress({ storage, now: () => baseDate });
  assert.equal(reloaded.grantBonusStamp({ claimId }).reason, 'already-claimed');
  assert.equal(reloaded.snapshot().stamps, 1);
});

test('quest and ad stamps unlock frames without being spent, with no premium entitlement', () => {
  const storage = memory(); let date = baseDate;
  const meta = createMetaProgress({ storage, now: () => date });
  assert.equal(meta.selectFrame('gold').reason, 'locked-frame');
  for (let level = 1; level <= 3; level++) {
    meta.recordResult(campaign(level));
    meta.grantBonusStamp({ claimId: `victory-stamp:2026-W43:campaign:magnet-v4-${String(level).padStart(2, '0')}:1` });
  }
  assert.equal(meta.snapshot().stamps, 3);
  assert.equal(meta.selectFrame('gold').accepted, true);
  assert.equal(meta.selectFrame('stars').reason, 'locked-frame');
  meta.claimQuest('campaign-wins'); meta.claimQuest('campaign-cleared');
  meta.recordResult(daily()); meta.claimQuest('daily-win');
  assert.equal(meta.snapshot().stamps, 6);
  assert.equal(meta.selectFrame('stars').accepted, true);
  assert.equal(meta.selectFrame('supporter_aurora').reason, 'unknown-frame');
  date = '2026-10-26T01:00:00Z';
  assert.equal(meta.snapshot().selectedFrame, 'stars');
  assert.equal(meta.snapshot().stamps, 6);
  assert.equal(createMetaProgress({ storage, now: () => date }).snapshot().selectedFrame, 'stars');
});

test('a verified ad completion can grant its prior-week board stamp after week rollover', () => {
  const storage = memory(); let date = baseDate;
  const meta = createMetaProgress({ storage, now: () => date });
  meta.recordResult(campaign());
  date = '2026-10-26T00:00:01Z';
  assert.equal(meta.grantBonusStamp({ claimId: 'victory-stamp:2026-W43:campaign:magnet-v4-01:1' }).accepted, true);
  assert.equal(meta.snapshot().weekId, '2026-W44');
  assert.equal(meta.snapshot().stamps, 1);
});

test('bonus eligibility is read-only and hides exhausted, stale or unsaved ad rewards', () => {
  const storage = memory(), meta = createMetaProgress({ storage, now: () => baseDate });
  const claimId = 'victory-stamp:2026-W43:campaign:magnet-v4-01:1';
  assert.equal(meta.canClaimBonusStamp({ claimId }), false);
  meta.recordResult(campaign());
  const before = storage.getItem(META_PROGRESS_KEY);
  assert.equal(meta.canClaimBonusStamp({ claimId }), true);
  assert.equal(storage.getItem(META_PROGRESS_KEY), before);
  meta.grantBonusStamp({ claimId });
  assert.equal(meta.canClaimBonusStamp({ claimId }), false);
  const stale = createMetaProgress({ storage, now: () => baseDate });
  meta.recordResult(campaign(2));
  assert.equal(stale.canClaimBonusStamp({ claimId: 'victory-stamp:2026-W43:campaign:magnet-v4-02:1' }), false);
  const blocked = createMetaProgress({ storage: null, now: () => baseDate });
  assert.equal(blocked.canClaimBonusStamp({ claimId }), false);
});
