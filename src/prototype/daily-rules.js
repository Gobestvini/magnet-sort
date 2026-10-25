import { createV4Rules } from './model-v4.js';
import { DAILY_PRESET_ID, DAILY_CONTENT_VERSION, DAILY_CATALOG_VERSION, DAILY_GOALS, DAILY_SPAWN_INTERVALS } from './daily-catalog-v1.js';

// User-approved B, daily only. Campaign retains its original default rules.
export { DAILY_PRESET_ID, DAILY_CONTENT_VERSION, DAILY_CATALOG_VERSION };
export const DAILY_RULES = createV4Rules({
  goals: DAILY_GOALS,
  spawnIntervals: DAILY_SPAWN_INTERVALS
});
