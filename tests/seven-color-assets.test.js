import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLORS } from '../src/prototype/model.js';

test('seven distinguishable color IDs have real alpha PNG chips and magnets', () => {
  assert.deepEqual(Object.keys(COLORS), ['violet','blue','coral','gold','lime','teal','pink']);
  assert.equal(new Set(Object.values(COLORS).map(c => c.hex)).size, 7);
  for (const color of Object.keys(COLORS)) for (const kind of ['chip','magnet']) {
    const data = readFileSync(new URL(`../public/art/mockup/${kind}-${color}.png`, import.meta.url));
    assert.equal(data.toString('hex',0,8), '89504e470d0a1a0a');
    assert.ok(data.readUInt32BE(16)>=256 && data.readUInt32BE(20)>=256);
    assert.equal(data[25], 6, `${kind}-${color} must preserve RGBA transparency`);
  }
});
