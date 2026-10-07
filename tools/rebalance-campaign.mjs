// Offline content authoring only. Runtime loads the resulting frozen JSON files.
import { readFileSync, writeFileSync } from 'node:fs';
import { applyAction, createInitialState } from '../src/game/simulator.js';
import { allCells, cellId } from '../src/game/hex.js';

let seed = 20261007;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function actions(state) {
  const empty = allCells(state).filter(cell => cell.kind === 'empty');
  return state.selectedMagnetOptions.flatMap(color => empty.map(cell => ({
    type: 'placeMagnet', color, cell: { ...cell.cell },
  })));
}
function stateKey(state) {
  return JSON.stringify([state.tokens.map(t => [t.tokenId, t.mass, cellId(t.cell)]), state.crates]);
}
// Beam search finds a legal witness; it makes no claim of optimality.
function solve(level) {
  let frontier = [{ state: createInitialState(level), path: [] }];
  const visited = new Set(frontier.map(item => stateKey(item.state)));
  for (let depth = 0; depth < 10; depth++) {
    const next = [];
    for (const item of frontier) {
      for (const action of actions(item.state)) {
        const { state } = applyAction(item.state, action);
        const path = [...item.path, action];
        if (state.terminal?.outcome === 'win') return path;
        if (state.terminal) continue;
        const key = stateKey(state);
        if (visited.has(key)) continue;
        visited.add(key);
        next.push({ state, path, rank: state.clearedMass * 100 - state.tokens.length * 3 });
      }
    }
    next.sort((a, b) => b.rank - a.rank);
    frontier = next.slice(0, 10);
    if (!frontier.length) return null;
  }
  return null;
}
function randomWinRate(level, count = 80, fixedColors = false) {
  let wins = 0;
  for (let run = 0; run < count; run++) {
    let state = createInitialState(level);
    while (!state.terminal) {
      const options = actions(state).filter(action => !fixedColors || action.color === level.solution.actions[state.turn]?.color);
      state = applyAction(state, options[Math.floor(random() * options.length)]).state;
    }
    if (state.terminal.outcome === 'win') wins++;
  }
  return wins / count;
}

for (let number = 6; number <= 50; number++) {
  const file = `src/levels/campaign/campaign-${String(number).padStart(2, '0')}.json`;
  const original = JSON.parse(readFileSync(file, 'utf8'));
  seed = 20261007 + number * 997;
  const colorCount = number <= 10 ? 3 : 4;
  const minimumMoves = number <= 10 ? 3 : number <= 20 ? 4 : number <= 35 ? 5 : 6;
  const placementThreshold = number <= 10 ? 0.3 : 0.2;
  if (original.contentVersion === 2 && original.solution.actions.length >= minimumMoves
    && original.solution.actions.length === original.moveLimit) {
    const placementRate = randomWinRate(original, 80, true);
    if (placementRate <= placementThreshold) {
      delete original.design.difficulty.minimumSolutionMoves;
      original.design.difficulty.minimumAuthoredMoves = minimumMoves;
      original.design.difficulty.randomPlacementWinRate = placementRate;
      writeFileSync(file, `${JSON.stringify(original, null, 2)}\n`);
      console.log(`${number}: retained; random placement wins ${placementRate}`);
      continue;
    }
  }
  let accepted = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const level = structuredClone(original);
    level.contentVersion = 2;
    level.seed = `magnet-campaign-v2-${number}`;
    level.solution = undefined;
    level.goal = { kind: 'clearAll' };
    level.moveLimit = 10;
    const cells = shuffle(allCells().map(({ cell }) => cell));
    const obstacleCount = number <= 10 ? 9 + number % 4 : number <= 20 || number >= 36 ? 12 + number % 4 : 14 + number % 5;
    level.blockedCells = cells.splice(0, obstacleCount);
    level.crates = number >= 36 ? cells.splice(0, 2 + number % 3) : [];
    // Every color has enough mass to clear; no isolated leftover mass is authored.
    const colors = shuffle(level.colors).slice(0, colorCount);
    if (number === 6 && !colors.includes('green')) colors[0] = 'green';
    level.tokens = colors.flatMap((color, index) => {
      const masses = number >= 21 && index < (number >= 36 ? 2 : 1) ? [1, 2, 2, 1, 2, 2] : [1, 2, 2];
      return masses.map((mass, i) => ({ tokenId: `${color}-${i}`, color, mass, cell: cells.shift() }));
    });
    level.magnetSchedule = [{ options: [...colors] }];
    const path = solve(level);
    if (!path || path.length < minimumMoves || path.length > minimumMoves + 3) continue;
    level.moveLimit = path.length;
    const rate = randomWinRate(level);
    if (rate > (number <= 10 ? 0.3 : 0.15)) continue;
    let state = createInitialState(level);
    let cratesDestroyed = 0;
    for (const action of path) {
      const result = applyAction(state, action);
      state = result.state;
      cratesDestroyed += result.events.filter(event => event.type === 'crateDestroyed').length;
    }
    if (number >= 36 && cratesDestroyed === 0) continue;
    level.solution = { actions: path, expected: { outcome: 'win', clearedMass: state.initialMass, movesUsed: path.length } };
    const placementRate = randomWinRate(level, 80, true);
    if (placementRate > placementThreshold) continue;
    level.design = {
      band: original.design.band,
      concept: `Уровень ${number}: ${number >= 36 ? 'Разрушь ящики и расчисти смешанное поле.' : 'Очисти все цвета в ограниченное число ходов.'}`,
      aha: 'Планируй порядок цветов и положение магнита: чужие фишки перекрывают путь, а пустой ход расходует запас.',
      difficulty: { minimumAuthoredMoves: minimumMoves, authoredMoves: path.length, randomPolicyRuns: 80, randomPolicyWinRate: rate, randomPlacementWinRate: placementRate },
    };
    accepted = level;
    break;
  }
  if (!accepted) throw new Error(`No reviewed candidate for level ${number}`);
  writeFileSync(file, `${JSON.stringify(accepted, null, 2)}\n`);
  console.log(`${number}: ${accepted.tokens.length} tokens, ${accepted.solution.actions.length}/${accepted.moveLimit} moves, random wins ${accepted.design.difficulty.randomPolicyWinRate}`);
}
