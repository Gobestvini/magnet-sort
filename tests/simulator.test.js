import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from '../docs/design/fixtures/rules-v1.json' with { type: 'json' };
import { loadPrototypeLevel, validateLevelDefinition } from '../src/game/levels.js';
import { applyAction, canonicalStringify, createInitialState } from '../src/game/simulator.js';
import { allCells } from '../src/game/hex.js';

function levelFor(fixture, reverseTokens = false) {
  const level = loadPrototypeLevel('prototype-01-clear-all');
  const before = fixture.before;
  const tokens = before.tokens.map((token) => ({ ...token, cell: { ...token.cell } }));
  if (reverseTokens) tokens.reverse();
  return validateLevelDefinition({
    ...level,
    puzzleId: `fixture-${fixture.id}`,
    seed: `seed-${fixture.id}`,
    tokens,
    blockedCells: (before.blockedCells ?? level.blockedCells).map((cell) => ({ ...cell })),
    goal: fixture.id === 'win-last-move-clear-count' ? { kind: 'clearCount', mass: 3 }
      : fixture.id === 'clear-five-from-mini-stack' ? { kind: 'clearCount', mass: 10 }
        : fixture.id === 'chain-after-clear-opens-wave' ? { kind: 'clearCount', mass: 20 }
          : fixture.id === 'mini-stack-mass-two-merges-with-one' ? { kind: 'clearCount', mass: 10 }
            : { kind: 'clearCount', mass: 99 },
    moveLimit: before.remainingMoves ?? (fixture.id === 'loss-on-last-ineffective-legal-move' ? 1 : 8),
    magnetSchedule: [{ options: [fixture.action.color] }],
  });
}

function stateFor(fixture, reverseTokens = false) {
  const state = createInitialState(levelFor(fixture, reverseTokens));
  if (fixture.before.turn !== undefined) state.turn = fixture.before.turn;
  if (fixture.before.remainingMoves !== undefined) state.remainingMoves = fixture.before.remainingMoves;
  if (fixture.before.clearedMass !== undefined) state.clearedMass = fixture.before.clearedMass;
  return state;
}

function describeEvent(event) {
  if (event.type === 'tokenMoved') return `tokenMoved:${event.tokenId}:${event.from.col},${event.from.row}>${event.to.col},${event.to.row}`;
  if (event.type === 'stackMerged') return `stackMerged:${event.tokenId}:${event.mass}`;
  if (event.type === 'stackCleared') return `stackCleared:${event.tokenId}:${event.mass}`;
  if (event.type === 'goalProgress') return `goalProgress:${event.clearedMass}`;
  if (event.type === 'runEnded') return `runEnded:${event.outcome}`;
  return event.type;
}

test('all rules-v1 fixtures produce their ordered observable events and outcomes', () => {
  for (const fixture of fixtures.fixtures) {
    const result = applyAction(stateFor(fixture), fixture.action);
    assert.equal(result.accepted, true, fixture.id);
    const actual = result.events.map(describeEvent);
    let previousIndex = -1;
    for (const expected of fixture.after.events) {
      const index = actual.findIndex((entry, eventIndex) => eventIndex > previousIndex && (entry === expected || entry.startsWith(`${expected}:`)));
      assert.ok(index > previousIndex, `${fixture.id}: missing ordered event ${expected}; got ${actual.join(',')}`);
      previousIndex = index;
    }
    if (fixture.after.tokens) assert.deepEqual(result.state.tokens.map(({ tokenId, color, mass, cell }) => ({ tokenId, color, mass, cell })), fixture.after.tokens);
    if (fixture.after.clearedMass !== undefined) assert.equal(result.state.clearedMass, fixture.after.clearedMass, fixture.id);
    if (fixture.after.chainLinks !== undefined) assert.equal(result.state.chainLinks, fixture.after.chainLinks, fixture.id);
    if (fixture.after.terminal !== undefined) assert.deepEqual(result.state.terminal, fixture.after.terminal, fixture.id);
  }
});

test('every fixture replay and reversed input token order are byte-equivalent canonically', () => {
  for (const fixture of fixtures.fixtures) {
    const first = applyAction(stateFor(fixture), fixture.action);
    const replay = applyAction(stateFor(fixture), fixture.action);
    const reversed = applyAction(stateFor(fixture, true), fixture.action);
    assert.equal(canonicalStringify(first), canonicalStringify(replay), fixture.id);
    assert.equal(canonicalStringify(first), canonicalStringify(reversed), fixture.id);
  }
});

test('multi-action deterministic replay preserves canonical state and event bytes', () => {
  const fixture = fixtures.fixtures.find((item) => item.id === 'chain-after-clear-opens-wave');
  const run = () => {
    let state = stateFor(fixture);
    const events = [];
    for (const action of [fixture.action, { type: 'placeMagnet', color: 'red', cell: { col: 0, row: 0 } }]) {
      const result = applyAction(state, action);
      assert.equal(result.accepted, true);
      state = result.state;
      events.push(...result.events);
    }
    return { state, events };
  };
  assert.equal(canonicalStringify(run()), canonicalStringify(run()));
});

test('invalid actions and unsupported state versions cannot mutate state or consume a turn', () => {
  const state = createInitialState(loadPrototypeLevel('prototype-03-blocker'));
  for (const [action, reason] of [
    [{ type: 'placeMagnet', color: 'green', cell: { col: 3, row: 3 } }, 'unavailable-color'],
    [{ type: 'placeMagnet', color: 'red', cell: { col: 2, row: 2 } }, 'cell-blocked'],
    [{ type: 'placeMagnet', color: 'red', cell: { col: 1, row: 3 } }, 'cell-occupied'],
    [{ type: 'placeMagnet', color: 'red', cell: { col: 7, row: 3 } }, 'cell-out-of-bounds'],
  ]) {
    const before = canonicalStringify(state);
    const result = applyAction(state, action);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, reason);
    assert.equal(result.state, state);
    assert.equal(canonicalStringify(state), before);
  }
  assert.throws(() => applyAction({ ...state, rulesVersion: 2 }, { type: 'placeMagnet', color: 'red', cell: { col: 3, row: 3 } }), /unsupported game state/);
});

test('terminal states reject further placements without changing the terminal result', () => {
  const win = fixtures.fixtures.find((item) => item.id === 'win-last-move-clear-count');
  const result = applyAction(stateFor(win), win.action);
  const rejected = applyAction(result.state, win.action);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'terminal');
  assert.equal(rejected.state, result.state);
  assert.equal(result.events.at(-1).type, 'runEnded');
});

test('mass six merges and clears, while all board invariants hold through authored replays', () => {
  const base = loadPrototypeLevel('prototype-01-clear-all');
  const massSix = validateLevelDefinition({
    ...base,
    puzzleId: 'sim-mass-six', seed: 'sim-mass-six-v1', goal: { kind: 'clearCount', mass: 6 }, moveLimit: 2,
    tokens: [1, 2, 3].map((mass, index) => ({ tokenId: `blue-${index}`, color: 'blue', mass: 2, cell: { col: index + 1, row: 3 } })),
  });
  const cleared = applyAction(createInitialState(massSix), { type: 'placeMagnet', color: 'red', cell: { col: 4, row: 3 } });
  assert.equal(cleared.state.clearedMass, 6);
  assert.equal(cleared.state.mergedUnits, 5);
  assert.deepEqual(cleared.state.tokens, []);
  assert.equal(cleared.state.terminal.reason, 'clear-count');

  for (const puzzleId of ['prototype-01-clear-all', 'prototype-02-clear-count', 'prototype-03-blocker']) {
    const level = loadPrototypeLevel(puzzleId);
    let state = createInitialState(level);
    for (const solution of level.solution.actions) {
      const result = applyAction(state, solution);
      assert.equal(result.accepted, true, puzzleId);
      state = result.state;
      const positions = state.tokens.map((token) => `${token.cell.row}:${token.cell.col}`);
      assert.equal(new Set(positions).size, positions.length, `${puzzleId}: no overlapping tokens`);
      assert.equal(state.tokens.reduce((sum, token) => sum + token.mass, 0) + state.clearedMass, state.initialMass, `${puzzleId}: conserved mass`);
      assert.deepEqual(result.events.map((event) => event.seq), result.events.map((_, index) => index + 1));
    }
    assert.equal(state.terminal?.outcome, 'win', puzzleId);
  }
});

test('initial state detects a board with no legal placement', () => {
  const base = loadPrototypeLevel('prototype-01-clear-all');
  const full = validateLevelDefinition({
    ...base, puzzleId: 'full-board-no-placement', seed: 'full-board-v1', goal: { kind: 'clearCount', mass: 100 }, moveLimit: 2,
    tokens: allCells().map(({ cell }, index) => ({ tokenId: `token-${String(index).padStart(2, '0')}`, color: 'blue', mass: 1, cell })),
  });
  const initial = createInitialState(full);
  assert.deepEqual(initial.terminal, { outcome: 'loss', reason: 'no-legal-action' });
  assert.equal(applyAction(initial, { type: 'placeMagnet', color: 'red', cell: { col: 0, row: 0 } }).reason, 'terminal');
});
