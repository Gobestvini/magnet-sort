import { createV4Rules } from '../../src/prototype/model-v4.js';
export const PACE_VERSION = 'telegram-pace-1';
const numbers = Array.from({ length: 12 }, (_, i) => i + 1);
const cadence = n => n <= 6 ? 1 : n <= 9 ? 2 : 3;
export const PACE_PROFILES = Object.freeze({
  A: Object.freeze({ id: 'A', label: 'Current', goals: Object.freeze(numbers.map(n => 50*n)), spawnIntervals: Object.freeze(numbers.map(cadence)) }),
  B: Object.freeze({ id: 'B', label: 'Short goal', goals: Object.freeze(numbers.map(n => 30+10*n)), spawnIntervals: Object.freeze(numbers.map(cadence)) }),
  C: Object.freeze({ id: 'C', label: 'Short goal, cadence 2 late', goals: Object.freeze(numbers.map(n => 30+10*n)), spawnIntervals: Object.freeze(numbers.map(n => n <= 6 ? 1 : 2)) })
});
export function paceRules(id) {
  const profile = PACE_PROFILES[id];
  if (!profile) throw new TypeError('Unknown pace profile');
  return createV4Rules(profile);
}
