import { campaignLevelIds, loadCampaignLevel } from '../game/levels.js';

// Versioned deterministic rotation over the reviewed campaign mapping.
export const DAILY_ROTATION_VERSION = 1;
const UTC_DAY_MS = 86_400_000;
const EPOCH_UTC_DAY = Date.UTC(2026, 0, 1) / UTC_DAY_MS;

export function getDailyPuzzle(instant = new Date()) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Daily puzzle requires a valid instant');
  const dailyId = date.toISOString().slice(0, 10);
  const dayNumber = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / UTC_DAY_MS;
  const ids = campaignLevelIds().slice(5);
  if (ids.length === 0) throw new Error('Daily rotation has no campaign levels');
  const offset = ((dayNumber - EPOCH_UTC_DAY) % ids.length + ids.length) % ids.length;
  const level = loadCampaignLevel(ids[offset]);
  return {
    dailyId,
    puzzleId: level.puzzleId,
    seed: level.seed,
    contentVersion: level.contentVersion,
    rulesVersion: level.rulesVersion,
    rotationVersion: DAILY_ROTATION_VERSION,
    level,
  };
}
