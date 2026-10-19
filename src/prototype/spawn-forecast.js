import { stacksForMove } from './model-v4.js';
import { spawnInterval } from './difficulty.js';

export function forecast(state, rules) {
  if (state.terminal) return null;
  const interval = rules?.spawnInterval ?? spawnInterval, schedule = rules?.stacksForMove ?? stacksForMove;
  for (let turnsUntilSpawn = 1; turnsUntilSpawn <= interval(state.levelNumber); turnsUntilSpawn++) {
    const plannedCount = schedule(state.movesUsed + turnsUntilSpawn, state.levelNumber);
    if (plannedCount) return { turnsUntilSpawn, plannedCount };
  }
  return null;
}
export function displayedForecast(state, timeline, time = 0, rules) {
  if (!timeline) return forecast(state, rules);
  if (state.terminal) return time < timeline.duration ? forecast(timeline.before, rules) : null;
  const boundary = timeline.segments.find(segment => segment.type === 'stackSpawned')?.start ?? timeline.queueStart;
  return forecast(time < boundary ? timeline.before : state, rules);
}
export function forecastText(value) {
  if (!value) return '';
  return value.turnsUntilSpawn === 1 ? `New stacks next move: +${value.plannedCount}` :
    `New stacks in ${value.turnsUntilSpawn} moves: +${value.plannedCount}`;
}
