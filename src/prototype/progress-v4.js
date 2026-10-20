import { createV4State, applyV4Magnet } from './model-v4.js';
import { v4Levels } from './levels-v4.js';

export const PROGRESS_V4_KEY = 'magnet-sort.v4.progress.v1';
export const V4_CONTENT_VERSION = 'sub-ten-2026-10-20.1';
export const MAX_ATTEMPT_ACTIONS = 2048;
const MAX_SAVE_BYTES = 512 * 1024;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const levelFor = id => v4Levels.find(level => level.id === id);
const uint32 = v => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;

export function createAttempt(levelId, seed) {
  if (!levelFor(levelId) || !uint32(seed)) throw new TypeError('Invalid attempt');
  return { levelId, seed, actions: [], assisted: false };
}
export function replayAttempt(value, rules = { createV4State, applyV4Magnet }) {
  if (!object(value) || !levelFor(value.levelId) || !uint32(value.seed) ||
      typeof value.assisted !== 'boolean' || !Array.isArray(value.actions) ||
      value.actions.length > MAX_ATTEMPT_ACTIONS) throw new TypeError('Invalid attempt');
  let state = rules.createV4State(levelFor(value.levelId), value.seed);
  const actions = [];
  for (const raw of value.actions) {
    if (!object(raw) || raw.type !== 'placeMagnet' || typeof raw.color !== 'string' ||
        !object(raw.cell) || !Number.isInteger(raw.cell.col) || !Number.isInteger(raw.cell.row))
      throw new TypeError('Invalid action');
    const action = { type: 'placeMagnet', color: raw.color, cell: { col: raw.cell.col, row: raw.cell.row } };
    const result = rules.applyV4Magnet(state, action);
    if (!result.accepted) throw new TypeError('Rejected replay action');
    state = result.state; actions.push(action);
  }
  return { attempt: { levelId: value.levelId, seed: value.seed, actions, assisted: value.assisted }, state };
}
export function emptyProgress(attempt) {
  return { schemaVersion: 1, contentVersion: V4_CONTENT_VERSION, revision: 0,
    lastLevelId: attempt.levelId, completedByLevel: {}, activeAttempt: attempt };
}
export function normalizeProgress(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.contentVersion !== V4_CONTENT_VERSION)
    throw new TypeError('Unsupported progress version');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision >= Number.MAX_SAFE_INTEGER ||
      !object(value.completedByLevel) || value.lastLevelId !== value.activeAttempt?.levelId)
    throw new TypeError('Invalid progress');
  const completedByLevel = {};
  for (const [id, entry] of Object.entries(value.completedByLevel)) {
    if (!levelFor(id) || !object(entry) || !Number.isInteger(entry.bestStars) ||
        entry.bestStars < 1 || entry.bestStars > 3) throw new TypeError('Invalid completion');
    completedByLevel[id] = { bestStars: entry.bestStars };
  }
  const replay = replayAttempt(value.activeAttempt);
  return { progress: { schemaVersion: 1, contentVersion: V4_CONTENT_VERSION, revision: value.revision,
    lastLevelId: value.lastLevelId, completedByLevel, activeAttempt: replay.attempt }, state: replay.state };
}
export function withAttempt(progress, attempt, state) {
  const completedByLevel = { ...progress.completedByLevel };
  if (state.terminal === 'won') completedByLevel[attempt.levelId] = {
    bestStars: Math.max(completedByLevel[attempt.levelId]?.bestStars ?? 0, state.stars)
  };
  return { ...progress, lastLevelId: attempt.levelId, activeAttempt: attempt, completedByLevel };
}

// Exact raw-value comparison detects ordinary concurrent-tab writes even when
// revisions collide. localStorage has no compare-and-swap; this is optimistic.
export function createProgressStore({ storage, getStorage = () => globalThis.localStorage } = {}) {
  let target, expected = null, reason = null, progress = null, state = null;
  try {
    target = storage === undefined ? getStorage() : storage;
    if (!target) throw Error('Storage unavailable');
    expected = target.getItem(PROGRESS_V4_KEY);
  } catch { reason = 'storage-unavailable'; }
  if (!reason && expected !== null) {
    try {
      if (typeof expected !== 'string' || expected.length > MAX_SAVE_BYTES) throw new TypeError('Invalid progress');
      let value;
      try { value = JSON.parse(expected); } catch { throw new TypeError('Invalid progress'); }
      ({ progress, state } = normalizeProgress(value));
    } catch (error) {
      reason = error.message.includes('Unsupported') ? 'unsupported-version' : 'invalid-data';
    }
  }
  function checkConflict() {
    if (reason) return;
    try { if (target.getItem(PROGRESS_V4_KEY) !== expected) reason = 'conflict'; }
    catch { reason = 'storage-unavailable'; }
  }
  return {
    loaded: { progress, state },
    status: () => ({ saved: !reason, reason }),
    checkConflict,
    suspend(cause) { reason = cause; },
    save(value) {
      checkConflict();
      if (reason) return false;
      const next = { ...value, revision: value.revision + 1 };
      try {
        const raw = JSON.stringify(next);
        if (raw.length > MAX_SAVE_BYTES) { reason = 'action-limit'; return false; }
        target.setItem(PROGRESS_V4_KEY, raw);
        expected = raw; value.revision = next.revision; return true;
      } catch { reason = 'storage-write-failed'; return false; }
    },
    recover(value) {
      if (!['invalid-data', 'unsupported-version', 'storage-write-failed', 'storage-unavailable'].includes(reason)) return false;
      // A recovery button must not silently replace a newer record either.
      try {
        target ??= storage === undefined ? getStorage() : storage;
        if (!target) return false;
        if (target.getItem(PROGRESS_V4_KEY) !== expected) { reason = 'conflict'; return false; }
        reason = null; return this.save(value);
      } catch { reason = 'storage-unavailable'; return false; }
    }
  };
}
