import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLevelBoard,
  loadPrototypeLevel,
  parseLevelDefinition,
  prototypeLevelIds,
  validateLevelDefinition,
} from '../src/game/levels.js';

test('three prototype levels are valid, versioned and have authored solutions', () => {
  const ids = prototypeLevelIds();
  assert.deepEqual(ids, ['prototype-01-clear-all', 'prototype-02-clear-count', 'prototype-03-blocker']);
  const levels = ids.map(loadPrototypeLevel);
  assert.equal(new Set(levels.map((level) => level.puzzleId)).size, 3);
  assert.ok(levels.some((level) => level.goal.kind === 'clearAll'));
  assert.ok(levels.some((level) => level.goal.kind === 'clearCount'));
  for (const level of levels) {
    assert.equal(level.schemaVersion, 1);
    assert.equal(level.rulesVersion, 1);
    assert.ok(level.solution.actions.length > 0);
    assert.equal(level.solution.expected.outcome, 'win');
  }
});

test('loading and normalization are deterministic and do not share mutable arrays', () => {
  const first = loadPrototypeLevel('prototype-02-clear-count');
  const second = loadPrototypeLevel('prototype-02-clear-count');
  assert.deepEqual(first, second);
  first.tokens[0].cell.col = 6;
  first.magnetSchedule[0].options.push('green');
  assert.deepEqual(loadPrototypeLevel('prototype-02-clear-count'), second);

  const reordered = structuredClone(second);
  reordered.tokens.reverse();
  reordered.blockedCells.reverse();
  assert.deepEqual(validateLevelDefinition(reordered), second);
});

test('board expansion represents all 49 cells and distinguishes blockers and tokens', () => {
  const level = loadPrototypeLevel('prototype-03-blocker');
  const board = createLevelBoard(level);
  assert.equal(board.length, 49);
  assert.equal(board.filter((cell) => cell.kind === 'blocked').length, 5);
  assert.equal(board.filter((cell) => cell.kind === 'token').length, 1);
  assert.equal(board.filter((cell) => cell.kind === 'empty').length, 43);
});

test('invalid JSON and unsupported versions include puzzleId and field in the error', () => {
  assert.throws(() => parseLevelDefinition('{"puzzleId":"broken",'), /broken\.JSON/);
  const badVersion = loadPrototypeLevel('prototype-01-clear-all');
  badVersion.rulesVersion = 9;
  assert.throws(() => validateLevelDefinition(badVersion), /prototype-01-clear-all\.rulesVersion/);
  badVersion.rulesVersion = 1;
  badVersion.geometry.rows = 8;
  assert.throws(() => validateLevelDefinition(badVersion), /prototype-01-clear-all\.geometry/);
});

test('validator rejects duplicate ids, bad cells, overlaps, invalid masses, goals and magnet options', () => {
  const base = loadPrototypeLevel('prototype-01-clear-all');
  const cases = [
    ['tokens[1].tokenId', (level) => level.tokens.push({ ...level.tokens[0], cell: { col: 2, row: 2 } })],
    ['tokens[0].cell', (level) => { level.tokens[0].cell = { col: 7, row: 1 }; }],
    ['tokens[0].mass', (level) => { level.tokens[0].mass = 0; }],
    ['tokens[0].cell', (level) => { level.blockedCells.push({ ...level.tokens[0].cell }); }],
    ['goal.mass', (level) => { level.goal = { kind: 'clearCount', mass: 0 }; }],
    ['moveLimit', (level) => { level.moveLimit = 0; }],
    ['magnetSchedule[0].options', (level) => { level.magnetSchedule[0].options = ['purple']; }],
  ];
  for (const [field, mutate] of cases) {
    const candidate = structuredClone(base);
    mutate(candidate);
    assert.throws(() => validateLevelDefinition(candidate), (error) => {
      assert.match(error.message, /prototype-01-clear-all/);
      assert.ok(error.message.includes(field), error.message);
      return true;
    });
  }
});

test('clearAll rejects a threshold and a level without a stable seed', () => {
  const level = loadPrototypeLevel('prototype-01-clear-all');
  level.goal.mass = 5;
  assert.throws(() => validateLevelDefinition(level), /prototype-01-clear-all\.goal\.mass/);
  delete level.goal.mass;
  level.seed = '';
  assert.throws(() => validateLevelDefinition(level), /prototype-01-clear-all\.seed/);
});
