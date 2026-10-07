import test from 'node:test';
import assert from 'node:assert/strict';
import { allCells, cellId } from '../src/game/hex.js';
import { cellToScreen, createBoardLayout, screenToCell } from '../src/render/layout.js';

test('all 49 staggered cells round-trip at multiple viewport sizes and DPRs', () => {
  for (const [width, height, dpr] of [[1280, 700, 1], [390, 430, 3], [844, 350, 2]]) {
    const layout = createBoardLayout(width, height, dpr);
    for (const { cell } of allCells()) {
      assert.deepEqual(screenToCell(cellToScreen(cell, layout), layout), cell, cellId(cell));
    }
    assert.ok(layout.radius * dpr % 1 === 0);
    assert.ok(layout.originX - layout.radius > 0);
    assert.ok(layout.originX + layout.boardWidth - layout.radius < width);
  }
});

test('hex edges and gaps do not select an adjacent cell', () => {
  const layout = createBoardLayout(800, 700);
  const first = cellToScreen({ col: 0, row: 0 }, layout);
  const edge = { x: first.x + layout.radius * 0.91 * 0.75, y: first.y + Math.sqrt(3) * layout.radius * 0.91 * 0.25 };
  assert.equal(screenToCell(edge, layout), null);
  const next = cellToScreen({ col: 0, row: 1 }, layout);
  assert.equal(screenToCell({ x: (first.x + next.x) / 2, y: (first.y + next.y) / 2 }, layout), null);
  assert.equal(screenToCell({ x: -1, y: -1 }, layout), null);
  assert.equal(screenToCell({ x: Number.NaN, y: 0 }, layout), null);
});
