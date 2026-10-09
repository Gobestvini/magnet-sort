import test from 'node:test';
import assert from 'node:assert/strict';
import { cellId, neighborCells } from '../src/game/hex.js';
import { createPrototypeState, applyMagnet, remainingUnits, canPlaceMagnet, topColor } from '../src/prototype/model.js';
import { prototypeLevels } from '../src/prototype/levels.js';
import { makeTransferTimeline, sampleTransferTimeline } from '../src/prototype/motion.js';

const action = (color, col = 3, row = 3) => ({ type: 'placeMagnet', color, cell: { col, row } });
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

function replayEvents(before, result, color) {
  const byCell = new Map(before.stacks.map(stack => [cellId(stack.cell), structuredClone(stack.units)]));
  let cleared = before.cleared;
  for (const event of result.events) {
    if (event.type === 'unitMoved') {
      assert.ok(neighborCells(event.from).some(cell => cellId(cell) === cellId(event.to)), 'one event crosses exactly one hex edge');
      assert.equal(event.unit.color, color);
      const source = byCell.get(cellId(event.from));
      assert.equal(source.length - 1, event.fromIndex);
      assert.deepEqual(source.pop(), event.unit, 'only the actual top unit can leave');
      const destination = byCell.get(cellId(event.to)) ?? [];
      assert.ok(!destination.length || destination.at(-1).color === color, 'incompatible tops block transfer');
      assert.equal(destination.length, event.toIndex);
      destination.push(event.unit); byCell.set(cellId(event.to), destination);
    } else {
      const stack = byCell.get(cellId(event.cell));
      assert.deepEqual(stack, event.units);
      assert.equal(stack.length, before.clearSize);
      cleared += stack.length; stack.length = 0;
    }
    assert.equal([...byCell.values()].reduce((sum, units) => sum + units.length, 0) + cleared, before.initialUnits);
  }
  const actual = [...byCell].filter(([, units]) => units.length).sort(([a], [b]) => a.localeCompare(b));
  const expected = result.state.stacks.map(stack => [cellId(stack.cell), stack.units]).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(actual, expected);
}

test('all authored v3 puzzles win through unit transfers and preserve immutable input', () => {
  for (const level of prototypeLevels) {
    let state = freeze(createPrototypeState(level));
    for (const command of level.solution) {
      const before = JSON.stringify(state);
      const result = applyMagnet(state, freeze(structuredClone(command)));
      assert.equal(result.accepted, true); replayEvents(state, result, command.color);
      assert.equal(JSON.stringify(state), before);
      assert.equal(result.state.cleared + remainingUnits(result.state), state.initialUnits);
      state = freeze(result.state);
    }
    assert.equal(state.terminal, 'won');
  }
});

test('occupied, blocked, outside, unavailable and legacy commands spend no move', () => {
  const state = createPrototypeState(prototypeLevels[1]);
  for (const command of [action('violet', 1, 2), action('violet', 3, 2), action('violet', 0, 0), action('yellow'),
    { type: 'placeStack', color: 'blue', cell: { col: 3, row: 3 } }]) {
    const result = applyMagnet(state, command);
    assert.equal(result.accepted, false); assert.equal(result.state, state);
  }
});

test('covered units remain in their original stack until the top colour is removed', () => {
  const state = createPrototypeState(prototypeLevels[2]);
  const blue = applyMagnet(state, action('blue'));
  assert.equal(topColor(blue.state.stacks.find(stack => cellId(stack.cell) === 'r2c2')), 'violet');
  assert.equal(blue.state.stacks.find(stack => cellId(stack.cell) === 'r2c2').units.length, 6);
  const violet = applyMagnet(state, action('violet'));
  assert.equal(violet.state.cleared, 0, 'three is an incomplete group, not an automatic component merge');
  assert.equal(topColor(violet.state.stacks.find(stack => cellId(stack.cell) === 'r2c2')), 'blue');
  assert.equal(violet.state.stacks.find(stack => cellId(stack.cell) === 'r3c3').units.length, 3);
});

test('disconnected colour stays still; accepted ineffective placement still consumes a move', () => {
  const level = { ...prototypeLevels[0], cells: [{ col: 1, row: 1 }, { col: 5, row: 5 }],
    blockers: [], stacks: [{ cell: { col: 1, row: 1 }, units: [{ id: 'alone', color: 'violet' }] }], moves: 1 };
  const before = createPrototypeState(level);
  const result = applyMagnet(before, action('violet', 5, 5));
  assert.equal(result.accepted, true); assert.deepEqual(result.events, []);
  assert.equal(result.state.terminal, 'lost'); assert.equal(result.state.remainingMoves, 0);
  assert.equal(applyMagnet(result.state, action('violet', 5, 5)).accepted, false);
});

test('last allowed move can win, clearing exact batches of six without losing remainder', () => {
  const state = createPrototypeState({ ...prototypeLevels[0], moves: 1 });
  const result = applyMagnet(state, action('violet'));
  assert.equal(result.state.terminal, 'won');
  assert.deepEqual(result.events.filter(e => e.type === 'unitsCleared').map(e => e.units.length), [6, 6]);
});

test('every legal initial placement replays safely, deterministically regardless of stack array order', () => {
  for (const level of prototypeLevels) {
    const before = createPrototypeState(level);
    for (const cell of level.cells.filter(cell => canPlaceMagnet(before, cell))) for (const color of level.magnets) {
      const command = { type: 'placeMagnet', cell, color };
      const result = applyMagnet(before, command);
      const reversed = { ...before, stacks: [...before.stacks].reverse() };
      assert.deepEqual(applyMagnet(reversed, command), result);
      replayEvents(before, result, color);
    }
  }
});

test('presentation staggers real units; each frame retains identity and final poses equal authoritative state', () => {
  const before = createPrototypeState(prototypeLevels[2]);
  const result = applyMagnet(before, action('violet'));
  for (const reduced of [false, true]) {
    const timeline = freeze(makeTransferTimeline(before, result, reduced));
    const moves = timeline.segments.filter(segment => segment.type === 'unitMoved');
    assert.ok(moves.some((segment, i) => i > 0 && segment.batch === moves[i - 1].batch && segment.start < moves[i - 1].end), 'consecutive units overlap in flight');
    for (let t = 0; t <= timeline.duration; t += 1 / 120) {
      const frame = sampleTransferTimeline(timeline, t);
      assert.equal(new Set(frame.units.map(unit => unit.id)).size, frame.units.length, 'no duplicate or ghost units');
      assert.equal(frame.units.length, before.initialUnits);
    }
    const final = sampleTransferTimeline(timeline, timeline.duration);
    assert.equal(final.complete, true); assert.equal(final.magnet, null);
    const expected = result.state.stacks.flatMap(stack => stack.units.map((unit, index) => ({ ...unit, cell: stack.cell, index, scale: 1 }))).sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(final.units.sort((a, b) => a.id.localeCompare(b.id)), expected);
  }
});
