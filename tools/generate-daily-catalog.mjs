import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createV4Rules } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { remainingUnits } from '../src/prototype/model.js';
import { chooseGreedy } from './verify-v4-balance.mjs';
import {
  DAILY_CATALOG, DAILY_CATALOG_VERSION, DAILY_PRESET_ID, DAILY_CONTENT_VERSION,
  DAILY_GOALS, DAILY_SPAWN_INTERVALS
} from '../src/prototype/daily-catalog-v1.js';

const rules = createV4Rules({ goals: DAILY_GOALS, spawnIntervals: DAILY_SPAWN_INTERVALS });
const fixturePath = fileURLToPath(new URL('./fixtures/daily-v4-witnesses.json', import.meta.url));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Authoring policy, not a runtime solver: first five winning seeds per L1–6.
// A cutoff is unknown; a failed greedy attempt does not prove unsolvability.
export function generateDailyCatalog() {
  const entries = [], counts = { won: 0, lost: 0, unknown: 0 };
  for (const level of v4Levels.slice(0, 6)) {
    let found = 0;
    for (let seed = 0; seed < 100 && found < 5; seed++) {
      let state = rules.createV4State(level, seed);
      const actions = [];
      while (!state.terminal && actions.length < 320) {
        const action = chooseGreedy(state);
        if (!action) throw Error('No legal action in nonterminal daily board');
        const result = rules.applyV4Magnet(state, action);
        if (!result.accepted) throw Error('Rejected authoring action');
        state = result.state; actions.push(action);
      }
      counts[state.terminal ?? 'unknown']++;
      if (state.terminal !== 'won') continue;
      let replay = rules.createV4State(level, seed);
      for (const action of actions) {
        const result = rules.applyV4Magnet(replay, action);
        if (!result.accepted) throw Error('Rejected daily witness');
        replay = result.state;
      }
      if (hash(replay) !== hash(state) || state.spawnedUnits !== remainingUnits(state) + state.cleared)
        throw Error('Daily witness replay/conservation mismatch');
      entries.push({ index: entries.length, levelId: level.id, seed,
        contentVersion: DAILY_CONTENT_VERSION, presetId: DAILY_PRESET_ID,
        actions, moves: state.movesUsed, cleared: state.cleared, stars: state.stars,
        finalStateSha256: hash(state) });
      found++;
    }
    if (found !== 5) throw Error('Not enough bounded winning witnesses for ' + level.id);
  }
  const catalog = entries.map(({ levelId, seed, contentVersion, presetId }) => ({ levelId, seed, contentVersion, presetId }));
  if (JSON.stringify(catalog) !== JSON.stringify(DAILY_CATALOG))
    throw Error('Frozen catalog differs. Create a NEW catalog version; do not replace entries.');
  return { catalogVersion: DAILY_CATALOG_VERSION, presetId: DAILY_PRESET_ID,
    contentVersion: DAILY_CONTENT_VERSION, seedRange: [0, 99], cutoff: 320, counts, entries };
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check', '--write'].includes(arg)) || (args.includes('--check') && args.includes('--write')))
    throw Error('Usage: node tools/generate-daily-catalog.mjs [--check|--write]');
  const fixture = generateDailyCatalog(), bytes = JSON.stringify(fixture, null, 2) + '\n';
  if (fs.existsSync(fixturePath)) {
    // --write initializes missing evidence only. Published-version evidence
    // cannot be silently regenerated after a rules or policy change either.
    const existing = fs.readFileSync(fixturePath, 'utf8').replace(/\r\n/g, '\n');
    if (existing !== bytes) throw Error('Frozen witness fixture differs. Review a NEW catalog version explicitly.');
  } else if (args.includes('--write')) fs.writeFileSync(fixturePath, bytes);
  else throw Error('Missing witness fixture; initialize explicitly with --write');
  console.log(`PASS ${fixture.entries.length} immutable daily witnesses; ${JSON.stringify(fixture.counts)}; catalog ${hash(DAILY_CATALOG)}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
