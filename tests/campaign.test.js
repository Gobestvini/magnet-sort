import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignLevelIds, loadCampaignLevel, createLevelBoard } from '../src/game/levels.js';
import { applyAction, createInitialState } from '../src/game/simulator.js';

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
  for (const level of levels.slice(5, 10)) assert.ok(level.blockedCells.length >= 6 && level.blockedCells.length <= 10, level.puzzleId);
  for (const level of levels.slice(10, 20)) assert.ok(level.moveLimit >= 8 && level.moveLimit <= 12, level.puzzleId);
  for (const level of levels.slice(20, 35)) assert.equal(level.magnetSchedule[0].options.length, 2, level.puzzleId);
  for (const level of levels.slice(35)) {
    assert.equal(level.rulesVersion, 2, level.puzzleId);
    assert.ok(level.crates.length > 0, level.puzzleId);
  }
});

test('v2 clear adjacent to a crate destroys it after clear and preserves token mass', () => {
  const level = loadCampaignLevel('campaign-36');
  const before = createInitialState(level);
  assert.ok(before.crates.length > 0);
  const result = applyAction(before, level.solution.actions[0]);
  assert.equal(result.accepted, true);
  const clearIndex = result.events.findIndex((event) => event.type === 'stackCleared');
  const crateIndex = result.events.findIndex((event) => event.type === 'crateDestroyed');
  assert.ok(clearIndex >= 0);
  assert.ok(crateIndex > clearIndex);
  assert.equal(result.state.crates.length, 0);
  assert.equal(result.state.clearedMass, result.state.initialMass);
});
