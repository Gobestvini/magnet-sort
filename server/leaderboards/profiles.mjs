import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createV4State, applyV4Magnet } from '../../src/prototype/model-v4.js';
import { v4Levels } from '../../src/prototype/levels-v4.js';
import { DAILY_CATALOG, DAILY_CATALOG_VERSION, DAILY_CONTENT_VERSION, DAILY_PRESET_ID } from '../../src/prototype/daily-catalog-v1.js';
import { DAILY_RULES } from '../../src/prototype/daily-rules.js';
import { ApiError, DAY, LIMITS, bad, object, keysOnly } from './config.mjs';

// Imports are relative to repository root: server/leaderboards -> ../../src.
export const CONTENT_VERSION = 'sub-ten-2026-10-20.1';
export const CAMPAIGN_PRESET = 'campaign-a-v1';
export const CATALOG_SHA256 = '3e02ff4c6b5b8a5cc3325681215928a02462074a89aaf60f19511b94bebdf06c';
export const defaultRules = { createV4State, applyV4Magnet };
const uint32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
export const today = now => new Date(now).toISOString().slice(0, 10);
export function dateMillis(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('INVALID_DATE');
  const value = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(value) || today(value) !== date) throw bad('INVALID_DATE');
  return value;
}
export function resolveDaily(date) {
  const delta = (dateMillis(date) - Date.UTC(2026, 0, 1)) / DAY;
  const index = ((delta % DAILY_CATALOG.length) + DAILY_CATALOG.length) % DAILY_CATALOG.length;
  return { rulesVersion: 4, date, catalogVersion: DAILY_CATALOG_VERSION, ...DAILY_CATALOG[index] };
}
function version(value, expected) { if (value !== expected) throw new ApiError(409, 'VERSION_MISMATCH'); }
export function canonicalDescriptor(mode, raw, { now = Date.now(), registration = true } = {}) {
  if (!object(raw) || Buffer.byteLength(JSON.stringify(raw)) > LIMITS.descriptor) throw bad('INVALID_DESCRIPTOR');
  version(raw.rulesVersion, 4);
  if (!v4Levels.some(level => level.id === raw.levelId) || !uint32(raw.seed)) throw bad('INVALID_DESCRIPTOR');
  if (mode === 'campaign') {
    if (!keysOnly(raw, ['rulesVersion', 'contentVersion', 'presetId', 'levelId', 'seed'])) throw bad('INVALID_DESCRIPTOR');
    version(raw.contentVersion, CONTENT_VERSION); version(raw.presetId, CAMPAIGN_PRESET);
    return { rulesVersion: 4, contentVersion: CONTENT_VERSION, presetId: CAMPAIGN_PRESET, levelId: raw.levelId, seed: raw.seed };
  }
  if (mode !== 'daily' || !keysOnly(raw, ['rulesVersion', 'contentVersion', 'presetId', 'catalogVersion', 'date', 'index', 'levelId', 'seed'])) throw bad('INVALID_DESCRIPTOR');
  version(raw.contentVersion, DAILY_CONTENT_VERSION); version(raw.presetId, DAILY_PRESET_ID); version(raw.catalogVersion, DAILY_CATALOG_VERSION);
  const expected = resolveDaily(raw.date);
  if (registration && raw.date !== today(now)) throw new ApiError(409, 'DAILY_DATE_CHANGED');
  if (raw.levelId !== expected.levelId || raw.seed !== expected.seed) throw new ApiError(409, 'DAILY_DESCRIPTOR_MISMATCH');
  if (raw.index !== undefined) {
    const currentIndex = DAILY_CATALOG.findIndex(item => item.levelId === expected.levelId && item.seed === expected.seed);
    if (raw.index !== currentIndex) throw new ApiError(409, 'DAILY_DESCRIPTOR_MISMATCH');
  }
  return expected;
}
export function boardKey(mode, descriptor) {
  return mode === 'campaign' ? `campaign:4:${descriptor.contentVersion}:${descriptor.presetId}` :
    `daily:4:${descriptor.date}:${descriptor.catalogVersion}:${descriptor.contentVersion}:${descriptor.presetId}`;
}
export function normalizeActions(raw) {
  if (!Array.isArray(raw)) throw bad('INVALID_ACTIONS');
  if (raw.length > LIMITS.actions) throw new ApiError(413, 'ACTIONS_TOO_LARGE');
  return raw.map(action => {
    if (!keysOnly(action, ['type', 'color', 'cell']) || action.type !== 'placeMagnet' || typeof action.color !== 'string' || action.color.length > 16 ||
        !keysOnly(action.cell, ['col', 'row']) || !Number.isInteger(action.cell.col) || !Number.isInteger(action.cell.row)) throw bad('INVALID_ACTION');
    return { type: 'placeMagnet', color: action.color, cell: { col: action.cell.col, row: action.cell.row } };
  });
}
export function digestReplay(mode, descriptor, actions) { return createHash('sha256').update(JSON.stringify({ mode, descriptor, actions })).digest('hex'); }
export function replay({ mode, descriptor, actions }) {
  const canonical = canonicalDescriptor(mode, descriptor, { registration: false });
  const normalized = normalizeActions(actions), rules = mode === 'daily' ? DAILY_RULES : defaultRules;
  let state = rules.createV4State(v4Levels.find(level => level.id === canonical.levelId), canonical.seed);
  for (const action of normalized) {
    const result = rules.applyV4Magnet(state, action);
    if (!result.accepted) throw new ApiError(422, 'REPLAY_REJECTED');
    state = result.state;
  }
  if (state.terminal !== 'won') throw new ApiError(422, 'REPLAY_NOT_WON');
  return { digest: digestReplay(mode, canonical, normalized), metrics: { moves: state.movesUsed, stars: state.stars, cleared: state.cleared } };
}
export async function validateDailyCatalog(pool) {
  if (DAILY_CATALOG.length !== 30 || createHash('sha256').update(JSON.stringify(DAILY_CATALOG)).digest('hex') !== CATALOG_SHA256) throw Error('Frozen daily catalog drift');
  const fixture = JSON.parse(await readFile(new URL('../../tools/fixtures/daily-v4-witnesses.json', import.meta.url), 'utf8'));
  if (fixture.catalogVersion !== DAILY_CATALOG_VERSION || fixture.entries?.length !== 30) throw Error('Daily witnesses mismatch');
  for (let index = 0; index < 30; index++) {
    const item = fixture.entries[index], date = today(Date.UTC(2026, 0, 1) + index * DAY), descriptor = resolveDaily(date);
    if (item.index !== index || item.levelId !== descriptor.levelId || item.seed !== descriptor.seed || item.presetId !== descriptor.presetId || item.contentVersion !== descriptor.contentVersion) throw Error('Daily witness descriptor mismatch');
    const result = await pool.run({ mode: 'daily', descriptor, actions: item.actions });
    if (result.metrics.moves !== item.moves || result.metrics.stars !== item.stars || result.metrics.cleared !== item.cleared) throw Error('Daily witness metrics mismatch');
  }
}
export function capabilities() { return { apiVersion: 1, campaign: true, daily: true, rulesVersion: 4, contentVersions: [CONTENT_VERSION], presetIds: [CAMPAIGN_PRESET, DAILY_PRESET_ID], catalogVersions: [DAILY_CATALOG_VERSION] }; }
export { DAILY_CATALOG_VERSION, DAILY_CONTENT_VERSION, DAILY_PRESET_ID };
