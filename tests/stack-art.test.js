import test from 'node:test';
import assert from 'node:assert/strict';
import { chipSvg } from '../src/render/art.js';
import { MAX_VISUAL_STACK_LAYERS, visualStackLayers } from '../src/render/stack-art.js';

test('token mass maps to one distinct stack silhouette per visible layer and caps only the art', () => {
  assert.equal(MAX_VISUAL_STACK_LAYERS, 6);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(visualStackLayers), [1, 2, 3, 4, 5, 6, 6]);
  assert.equal(visualStackLayers(1.8), 1);
  assert.equal(visualStackLayers(0), 1);
  assert.equal(chipSvg('red', 6, false), chipSvg('red', 9, false));
});
