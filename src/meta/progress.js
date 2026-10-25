import { v4Levels } from '../prototype/levels-v4.js';
import { getDaily } from '../prototype/daily-v4.js';

export const META_PROGRESS_KEY = 'magnet-sort.meta.v1';
export const META_HISTORY_WEEKS = 8;
export const META_MAX_WINS = 4096;
export const META_MAX_WEEK_BOARDS = 256;
export const META_MAX_BONUS_CLAIMS = 4096;
export const FRAMES = Object.freeze([
  { id: 'plain', label: 'Plain frame', threshold: 0 },
  { id: 'gold', label: 'Golden frame', threshold: 3 },
  { id: 'stars', label: 'Star frame', threshold: 6 },
].map(value => Object.freeze(value)));
export const EMBLEMS = Object.freeze([
  { id: 'violet', color: 'violet', label: 'Violet Magnet', threshold: 1 },
  { id: 'blue', color: 'blue', label: 'Blue Magnet', threshold: 2 },
  { id: 'coral', color: 'coral', label: 'Coral Magnet', threshold: 3 },
  { id: 'gold', color: 'gold', label: 'Golden Magnet', threshold: 6 },
  { id: 'lime', color: 'lime', label: 'Lime Magnet', threshold: 9 },
  { id: 'teal', color: 'teal', label: 'Teal Magnet', threshold: 12 },
].map(value => Object.freeze(value)));
export const WEEKLY_QUESTS = Object.freeze([
  { id: 'campaign-wins', label: 'Win 3 different campaign levels', target: 3, reward: 1 },
  { id: 'campaign-cleared', label: 'Collect 100 campaign chips', target: 100, reward: 1 },
  { id: 'daily-win', label: 'Complete today\'s Daily board', target: 1, reward: 1 },
].map(value => Object.freeze(value)));

const DAY = 86_400_000, MAX_SAVE_CHARS = 512 * 1024;
const levelIds = new Set(v4Levels.map(level => level.id));
const questIds = new Set(WEEKLY_QUESTS.map(quest => quest.id));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, max = 1_000_000) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const key = value => value.levelId + ':' + value.seed;
const clone = value => structuredClone(value);
function day(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid meta date');
  return date.toISOString().slice(0, 10);
}
function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) && day(value) === value;
}

// ISO weeks start on Monday; all dates and transitions use UTC.
export function utcWeek(instant) {
  const date = new Date(day(instant) + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = date.toISOString().slice(0, 10);
  const thursday = new Date(date.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  jan4.setUTCFullYear(year);
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const number = Math.floor((date - jan4) / (7 * DAY)) + 1;
  return { id: `${year}-W${String(number).padStart(2, '0')}`, start,
    end: new Date(date.getTime() + 7 * DAY).toISOString().slice(0, 10) };
}
function emptyWeek(info) {
  return { id: info.id, start: info.start, boards: [], dailyDates: [], claimed: [] };
}
function emptyProgress(today) {
  return { schemaVersion: 1, revision: 0, latestDay: today, wins: [], weeks: [], stamps: 0,
    bonusClaims: [], selectedEmblem: null, selectedFrame: 'plain' };
}
function validateBoard(value, result = false) {
  if (!object(value) || !levelIds.has(value.levelId) || !integer(value.seed, 0xffffffff) ||
      (result && (!integer(value.bestCleared) || typeof value.won !== 'boolean')))
    throw new TypeError('Invalid meta board');
  return result ? { levelId: value.levelId, seed: value.seed, bestCleared: value.bestCleared, won: value.won }
    : { levelId: value.levelId, seed: value.seed };
}
function unique(values, getKey = value => value) {
  return new Set(values.map(getKey)).size === values.length;
}
export function normalizeMetaProgress(value) {
  if (!object(value) || value.schemaVersion !== 1) throw new TypeError('Unsupported meta version');
  if (!integer(value.revision, Number.MAX_SAFE_INTEGER - 1) || !validDay(value.latestDay) ||
      !integer(value.stamps, 1_000_000_000) || !Array.isArray(value.wins) || value.wins.length > META_MAX_WINS ||
      !Array.isArray(value.weeks) || value.weeks.length > META_HISTORY_WEEKS ||
      !Array.isArray(value.bonusClaims) || value.bonusClaims.length > META_MAX_BONUS_CLAIMS ||
      !unique(value.bonusClaims) || value.bonusClaims.some(claim => !validBonusClaim(claim)))
    throw new TypeError('Invalid meta progress');
  const wins = value.wins.map(entry => validateBoard(entry));
  if (!unique(wins, key)) throw new TypeError('Duplicate meta win');
  const winKeys = new Set(wins.map(key));
  const newestWeek = utcWeek(value.latestDay);
  const weeks = value.weeks.map(entry => {
    if (!object(entry) || !validDay(entry.start)) throw new TypeError('Invalid meta week');
    const info = utcWeek(entry.start);
    if (info.id !== entry.id || info.start !== entry.start || entry.start > newestWeek.start ||
        !Array.isArray(entry.boards) || entry.boards.length > META_MAX_WEEK_BOARDS ||
        !Array.isArray(entry.dailyDates) || entry.dailyDates.length > 7 ||
        !Array.isArray(entry.claimed) || entry.claimed.length > WEEKLY_QUESTS.length)
      throw new TypeError('Invalid meta week');
    const boards = entry.boards.map(board => validateBoard(board, true));
    if (!unique(boards, key) || boards.some(board => board.won && !winKeys.has(key(board))) ||
        !unique(entry.dailyDates) || !unique(entry.claimed) ||
        entry.dailyDates.some(date => !validDay(date) || date < info.start || date >= info.end || date > value.latestDay) ||
        entry.claimed.some(id => !questIds.has(id))) throw new TypeError('Invalid meta week');
    const week = { id: info.id, start: info.start, boards, dailyDates: [...entry.dailyDates], claimed: [...entry.claimed] };
    if (week.claimed.some(id => questProgress(week, id) < WEEKLY_QUESTS.find(quest => quest.id === id).target))
      throw new TypeError('Unfinished claimed quest');
    return week;
  });
  if (!unique(weeks, week => week.id)) throw new TypeError('Duplicate meta week');
  const minimumStamps = weeks.reduce((sum, week) => sum + week.claimed.length, value.bonusClaims.length);
  if (minimumStamps > value.stamps) throw new TypeError('Invalid meta stamps');
  const selected = value.selectedEmblem;
  if (selected !== null && !EMBLEMS.some(emblem => emblem.id === selected && wins.length >= emblem.threshold))
    throw new TypeError('Locked meta emblem');
  if (!FRAMES.some(frame => frame.id === value.selectedFrame && value.stamps >= frame.threshold))
    throw new TypeError('Locked meta frame');
  return { schemaVersion: 1, revision: value.revision, latestDay: value.latestDay,
    wins, weeks: weeks.sort((a, b) => b.start.localeCompare(a.start)), stamps: value.stamps,
    bonusClaims: [...value.bonusClaims], selectedEmblem: selected, selectedFrame: value.selectedFrame };
}
function validBonusClaim(claim) {
  return typeof claim === 'string' && claim.length <= 160 &&
    /^victory-stamp:\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3]):(?:campaign:magnet-v4-(?:0[1-9]|1[0-2]):(?:0|[1-9]\d{0,9})|daily:\d{4}-\d{2}-\d{2})$/.test(claim);
}
function earnedBonusClaims(weeks) {
  return weeks.flatMap(week => [
    ...week.boards.filter(board => board.won).map(board => `victory-stamp:${week.id}:campaign:${key(board)}`),
    ...week.dailyDates.map(date => `victory-stamp:${week.id}:daily:${date}`),
  ]);
}
function questProgress(week, id) {
  if (id === 'campaign-wins') return new Set(week.boards.filter(board => board.won).map(board => board.levelId)).size;
  if (id === 'campaign-cleared') return Math.min(100, week.boards.reduce((sum, board) => sum + board.bestCleared, 0));
  return week.dailyDates.length ? 1 : 0;
}
function validResult(value) {
  if (!object(value) || !['campaign', 'daily'].includes(value.mode) ||
      !['won', 'lost'].includes(value.outcome) || !levelIds.has(value.levelId) || !integer(value.seed, 0xffffffff) ||
      !integer(value.cleared) || !integer(value.moves, 2048) || value.moves < 1 ||
      typeof value.assisted !== 'boolean') return false;
  if (value.mode === 'daily') {
    if (!validDay(value.date)) return false;
    const descriptor = getDaily(value.date);
    if (descriptor.levelId !== value.levelId || descriptor.seed !== value.seed) return false;
  }
  return true;
}

// Local cosmetics only. This is deliberately separate from paid inventory and
// game saves. localStorage comparisons catch normal stale tabs, not malicious
// edits or simultaneous compare-and-swap races; no money is entrusted to this.
export function createMetaProgress({ storage, getStorage = () => globalThis.localStorage, now = () => Date.now() } = {}) {
  let target, expected = null, reason = null, disposed = false;
  let progress = emptyProgress(day(now()));
  function load() {
    reason = null;
    try {
      target = storage === undefined ? getStorage() : storage;
      if (!target) throw new Error('Storage unavailable');
      expected = target.getItem(META_PROGRESS_KEY);
    } catch { reason = 'storage-unavailable'; return false; }
    if (expected !== null) {
      try {
        if (typeof expected !== 'string' || expected.length > MAX_SAVE_CHARS) throw new TypeError('Invalid meta save');
        progress = normalizeMetaProgress(JSON.parse(expected));
      } catch (error) {
        reason = error.message.includes('Unsupported') ? 'unsupported-version' : 'invalid-data'; return false;
      }
    } else progress = emptyProgress(day(now()));
    return true;
  }
  load();
  function checkConflict() {
    if (disposed || reason) return;
    try { if (target.getItem(META_PROGRESS_KEY) !== expected) reason = 'conflict'; }
    catch { reason = 'storage-unavailable'; }
  }
  function clock() {
    const today = day(now());
    return { today, rollback: today < progress.latestDay, info: utcWeek(today < progress.latestDay ? progress.latestDay : today) };
  }
  function currentWeek(info, value = progress) { return value.weeks.find(week => week.id === info.id) ?? emptyWeek(info); }
  function mutate(change, { allowRollback = false } = {}) {
    checkConflict();
    if (disposed) return { accepted: false, reason: 'disposed' };
    if (reason) return { accepted: false, reason };
    if (progress.revision >= Number.MAX_SAFE_INTEGER - 1) return { accepted: false, reason: 'capacity' };
    const current = clock();
    if (current.rollback && !allowRollback) return { accepted: false, reason: 'clock-rollback' };
    const next = clone(progress), week = currentWeek(current.info, next);
    if (!next.weeks.some(entry => entry.id === week.id)) next.weeks.push(week);
    const result = change(next, week, current);
    if (!result.accepted) return result;
    next.latestDay = current.today < next.latestDay ? next.latestDay : current.today;
    next.weeks.sort((a, b) => b.start.localeCompare(a.start));
    next.weeks = next.weeks.slice(0, META_HISTORY_WEEKS);
    next.revision++;
    try {
      const raw = JSON.stringify(next);
      if (raw.length > MAX_SAVE_CHARS) return { accepted: false, reason: 'capacity' };
      // Check again just before writing: no unrelated campaign/daily key is touched.
      if (target.getItem(META_PROGRESS_KEY) !== expected) { reason = 'conflict'; return { accepted: false, reason }; }
      target.setItem(META_PROGRESS_KEY, raw);
      progress = next; expected = raw;
      return { ...result, changed: true };
    } catch { reason = 'storage-write-failed'; return { accepted: false, reason }; }
  }
  function snapshot() {
    checkConflict();
    const current = clock(), week = currentWeek(current.info);
    return {
      weekId: current.info.id, weekStartsAt: current.info.start, weekEndsAt: current.info.end,
      quests: WEEKLY_QUESTS.map(quest => {
        const count = Math.min(quest.target, questProgress(week, quest.id));
        return { ...quest, progress: count, complete: count >= quest.target, claimed: week.claimed.includes(quest.id) };
      }),
      stamps: progress.stamps, uniqueWins: progress.wins.length, selectedEmblem: progress.selectedEmblem,
      selectedFrame: progress.selectedFrame,
      frames: FRAMES.map(frame => ({ ...frame, unlocked: progress.stamps >= frame.threshold, selected: frame.id === progress.selectedFrame })),
      emblems: EMBLEMS.map(emblem => ({ ...emblem, unlocked: progress.wins.length >= emblem.threshold, selected: emblem.id === progress.selectedEmblem })),
      status: { saved: !reason && !disposed, reason: disposed ? 'disposed' : reason, clockRollback: current.rollback },
    };
  }
  return {
    snapshot,
    recordResult(result) {
      if (!validResult(result)) return { accepted: false, reason: 'invalid-result' };
      return mutate((next, week, current) => {
        if (result.mode === 'daily') {
          if (result.outcome !== 'won' || result.date !== current.today) return { accepted: false, reason: 'ineligible-daily' };
          if (week.dailyDates.includes(result.date)) return { accepted: false, reason: 'duplicate' };
          week.dailyDates.push(result.date);
          return { accepted: true, newWin: false };
        }
        let board = week.boards.find(entry => key(entry) === key(result));
        const won = result.outcome === 'won', newWin = won && !next.wins.some(entry => key(entry) === key(result));
        if (!board && week.boards.length >= META_MAX_WEEK_BOARDS) return { accepted: false, reason: 'capacity' };
        if (newWin && next.wins.length >= META_MAX_WINS) return { accepted: false, reason: 'capacity' };
        if (board && board.bestCleared >= result.cleared && (!won || board.won) && !newWin)
          return { accepted: false, reason: 'duplicate' };
        if (!board) {
          board = { levelId: result.levelId, seed: result.seed, bestCleared: 0, won: false };
          week.boards.push(board);
        }
        board.bestCleared = Math.max(board.bestCleared, result.cleared);
        board.won ||= won;
        if (newWin) next.wins.push({ levelId: result.levelId, seed: result.seed });
        return { accepted: true, newWin };
      });
    },
    claimQuest(id) {
      if (!questIds.has(id)) return { accepted: false, reason: 'unknown-quest' };
      return mutate((next, week) => {
        const quest = WEEKLY_QUESTS.find(entry => entry.id === id);
        if (week.claimed.includes(id)) return { accepted: false, reason: 'already-claimed' };
        if (questProgress(week, id) < quest.target) return { accepted: false, reason: 'incomplete-quest' };
        if (next.stamps > 1_000_000_000 - quest.reward) return { accepted: false, reason: 'capacity' };
        week.claimed.push(id); next.stamps += quest.reward;
        return { accepted: true, reward: quest.reward, questId: id };
      });
    },
    selectEmblem(id) {
      if (!EMBLEMS.some(entry => entry.id === id)) return { accepted: false, reason: 'unknown-emblem' };
      return mutate(next => {
        if (next.wins.length < EMBLEMS.find(entry => entry.id === id).threshold) return { accepted: false, reason: 'locked-emblem' };
        if (next.selectedEmblem === id) return { accepted: false, reason: 'already-selected' };
        next.selectedEmblem = id; return { accepted: true, emblemId: id };
      }, { allowRollback: true });
    },
    selectFrame(id) {
      const frame = FRAMES.find(entry => entry.id === id);
      if (!frame) return { accepted: false, reason: 'unknown-frame' };
      return mutate(next => {
        if (next.stamps < frame.threshold) return { accepted: false, reason: 'locked-frame' };
        if (next.selectedFrame === id) return { accepted: false, reason: 'already-selected' };
        next.selectedFrame = id; return { accepted: true, frameId: id };
      }, { allowRollback: true });
    },
    grantBonusStamp({ claimId } = {}) {
      if (!validBonusClaim(claimId)) return { accepted: false, reason: 'invalid-claim' };
      return mutate(next => {
        if (next.bonusClaims.includes(claimId)) return { accepted: false, reason: 'already-claimed' };
        // An ad may finish just after UTC midnight/week rollover. Its original
        // completed board remains eligible while retained; a new random claim ID
        // or a result that was never recorded is not a reward opportunity.
        if (!earnedBonusClaims(next.weeks).includes(claimId)) return { accepted: false, reason: 'ineligible-claim' };
        if (next.bonusClaims.length >= META_MAX_BONUS_CLAIMS || next.stamps >= 1_000_000_000)
          return { accepted: false, reason: 'capacity' };
        next.bonusClaims.push(claimId); next.stamps++;
        return { accepted: true, reward: 1, stamps: next.stamps, claimId };
      });
    },
    canClaimBonusStamp({ claimId } = {}) {
      checkConflict();
      return !disposed && !reason && !clock().rollback && validBonusClaim(claimId) &&
        progress.bonusClaims.length < META_MAX_BONUS_CLAIMS && progress.stamps < 1_000_000_000 &&
        !progress.bonusClaims.includes(claimId) && earnedBonusClaims(progress.weeks).includes(claimId);
    },
    reload() { if (disposed) return false; return load(); },
    dispose() { disposed = true; },
  };
}
