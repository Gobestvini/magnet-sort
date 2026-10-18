import test from 'node:test';
import assert from 'node:assert/strict';
import { createV4State } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { canPlaceMagnet } from '../src/prototype/model.js';
import { previewMagnetInfluence } from '../src/prototype/magnet-influence.js';
import { tutorialPlacement, tutorialCurve, tutorialPoint, tutorialDragFrames } from '../src/prototype/tutorial-guide.js';

test('tutorial chooses a legal effective cell for every offered first-level magnet without changing state or RNG', () => {
  for (let seed = 0; seed < 100; seed++) {
    const state = createV4State(v4Levels[0], seed), before = structuredClone(state);
    for (const color of state.magnets) {
      const cell = tutorialPlacement(state, color);
      assert.ok(canPlaceMagnet(state, cell), `seed ${seed}, ${color}`);
      assert.ok(previewMagnetInfluence(state, cell, color).sources.length > 0, `effective seed ${seed}, ${color}`);
      assert.deepEqual(tutorialPlacement(state, color), cell);
      assert.notEqual(cell, state.cells.find(c => c.col === cell.col && c.row === cell.row));
    }
    assert.deepEqual(state, before);
  }
});

test('tutorial has no target for unavailable colors, a terminal state or a full board', () => {
  const state = createV4State(v4Levels[0], 1), color = state.magnets[0];
  assert.equal(tutorialPlacement(state, 'invalid'), null);
  assert.equal(tutorialPlacement({...state, terminal:'won'}, color), null);
  assert.equal(tutorialPlacement({...state, blockers:state.cells}, color), null);
});

test('drag demonstration travels from the measured magnet to the exact drop target and resets while invisible', () => {
  const start = {x:85,y:730}, end = {x:179,y:410}, curve = tutorialCurve(start, end);
  assert.deepEqual(tutorialPoint(curve, 0), start);
  assert.deepEqual(tutorialPoint(curve, 1), end);
  const frames = tutorialDragFrames(curve, .6);
  assert.equal(frames[0].transform, 'translate3d(85px,730px,0) scale(1)');
  assert.ok(frames.some(f => f.opacity === 1 && f.transform === 'translate3d(179px,410px,0) scale(0.6)'));
  assert.equal(frames.at(-1).opacity, 0);
  assert.equal(frames.at(-1).transform, frames[0].transform);
  for (const f of frames) assert.ok(!/NaN|Infinity/.test(f.transform));
});
