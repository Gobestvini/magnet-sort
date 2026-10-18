import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisibleProgress } from '../src/loading/visible-progress.js';

test('ready requires real completion and a second of visible loading', () => {
  const progress = createVisibleProgress();
  progress.step(0, true); progress.resources(1, 1);
  assert.equal(progress.step(1500, true).ready, false);
  progress.complete();
  assert.equal(progress.step(1501, true).ready, true);
  const fast = createVisibleProgress(); fast.complete(); fast.step(0, true);
  assert.equal(fast.step(999, true).ready, false);
  assert.equal(fast.step(1000, true).displayed, 1);
});
test('hidden time cannot skip the loading screen', () => {
  const progress = createVisibleProgress(); progress.complete();
  progress.step(0, true); progress.step(100, true); progress.step(110, false);
  progress.step(10000, false); progress.step(11000, true);
  assert.equal(progress.step(11500, true).ready, false);
  assert.equal(progress.step(11900, true).ready, true);
});
test('progress is monotonic and bounded by completed resources', () => {
  const progress = createVisibleProgress(); progress.step(0, true);
  progress.resources(1, 4); assert.equal(progress.step(500, true).displayed, .25);
  progress.resources(0, 4); progress.resources(NaN, 4); progress.resources(4, 0);
  assert.equal(progress.step(1000, true).displayed, .25);
  progress.resources(2, 4); assert.equal(progress.step(1500, true).displayed, .5);
  assert.equal(progress.step(2000, true).ready, false);
});
