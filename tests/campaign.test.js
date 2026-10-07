import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignLevelIds, loadCampaignLevel, createLevelBoard } from '../src/game/levels.js';
import { applyAction, createInitialState } from '../src/game/simulator.js';
import { allCells } from '../src/game/hex.js';

test('all 50 campaign levels validate and their authored replays win with conserved mass', () => {
  const ids = campaignLevelIds();
  assert.equal(ids.length, 50);
  assert.equal(new Set(ids).size, 50);
  const levels = ids.map(loadCampaignLevel);
  assert.deepEqual(levels.map((level) => level.campaignNumber), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(levels[5].colors.includes('green'), true, 'green is first introduced after FTUE at level 6');
  for (const level of levels) {
    const board = createLevelBoard(level);
    assert.ok(board.some((cell) => cell.kind === 'empty'), `${level.puzzleId} has legal placement space`);
    let state = createInitialState(level);
    for (const action of level.solution.actions) {
      const result = applyAction(state, action);
      assert.equal(result.accepted, true, level.puzzleId);
      state = result.state;
      assert.equal(state.tokens.reduce((sum, token) => sum + token.mass, 0) + state.clearedMass, state.initialMass, `${level.puzzleId} conserves mass`);
    }
    assert.equal(state.terminal?.outcome, level.solution.expected.outcome, level.puzzleId);
    assert.equal(state.clearedMass, level.solution.expected.clearedMass, level.puzzleId);
    assert.equal(level.solution.actions.length, level.solution.expected.movesUsed, level.puzzleId);
    if (level.moveLimit !== null) assert.ok(level.solution.actions.length <= level.moveLimit, `${level.puzzleId} within move limit`);
  }
});

test('campaign bands contain their required authored mechanics', () => {
  const levels = campaignLevelIds().map(loadCampaignLevel);
  for (const level of levels.slice(5)) {
    const minimum = level.campaignNumber <= 10 ? 3 : level.campaignNumber <= 20 ? 4 : level.campaignNumber <= 35 ? 5 : 6;
    assert.equal(level.contentVersion, 2, level.puzzleId);
    assert.ok(level.solution.actions.length >= minimum, level.puzzleId);
    assert.equal(level.moveLimit, level.solution.actions.length, `${level.puzzleId} has no excessive move allowance`);
    assert.ok(level.blockedCells.length >= 9, level.puzzleId);
    assert.ok(level.magnetSchedule[0].options.length >= 3, level.puzzleId);
  }
  for (const level of levels.slice(35)) {
    assert.equal(level.rulesVersion, 2, level.puzzleId);
    assert.ok(level.crates.length > 0, level.puzzleId);
  }
});

test('v2 clear adjacent to a crate destroys it after clear and preserves token mass', () => {
  const level = loadCampaignLevel('campaign-36');
  const before = createInitialState(level);
  assert.ok(before.crates.length > 0);
  let state = before;
  let destroyed = 0;
  for (const action of level.solution.actions) {
    const result = applyAction(state, action);
    assert.equal(result.accepted, true);
    for (const event of result.events.filter(event => event.type === 'crateDestroyed')) {
      assert.ok(result.events.some(clear => clear.type === 'stackCleared' && clear.wave === event.wave && clear.seq < event.seq));
      destroyed++;
    }
    state = result.state;
  }
  assert.ok(destroyed > 0);
  assert.equal(state.clearedMass, state.initialMass);
});

function legalActions(state) {
  return state.selectedMagnetOptions.flatMap(color => allCells(state)
    .filter(cell => cell.kind === 'empty')
    .map(({ cell }) => ({ type: 'placeMagnet', color, cell })));
}

test('rebalanced campaign has no one-move wins from any legal starting placement', () => {
  for (const level of campaignLevelIds().slice(5).map(loadCampaignLevel)) {
    const state = createInitialState(level);
    for (const action of legalActions(state)) {
      assert.notEqual(applyAction(state, action).state.terminal?.outcome, 'win', level.puzzleId);
    }
  }
});

test('random legal play rarely wins the rebalanced campaign with an independent seed', () => {
  let seed = 713;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const level of campaignLevelIds().slice(5).map(loadCampaignLevel)) {
    let wins = 0;
    for (let run = 0; run < 100; run++) {
      let state = createInitialState(level);
      while (!state.terminal) {
        const options = legalActions(state);
        state = applyAction(state, options[Math.floor(random() * options.length)]).state;
      }
      wins += Number(state.terminal.outcome === 'win');
    }
    assert.ok(wins <= (level.campaignNumber <= 10 ? 30 : 15), `${level.puzzleId}: ${wins}/100 random wins`);
  }
});

test('knowing the solution colors still requires choosing magnet positions', () => {
  let seed = 991;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const level of campaignLevelIds().slice(5).map(loadCampaignLevel)) {
    let wins = 0;
    for (let run = 0; run < 100; run++) {
      let state = createInitialState(level);
      for (const authored of level.solution.actions) {
        if (state.terminal) break;
        const options = legalActions(state).filter(action => action.color === authored.color);
        state = applyAction(state, options[Math.floor(random() * options.length)]).state;
      }
      wins += Number(state.terminal?.outcome === 'win');
    }
    assert.ok(wins <= (level.campaignNumber <= 10 ? 45 : 35), `${level.puzzleId}: ${wins}/100 wins with random positions`);
  }
});
