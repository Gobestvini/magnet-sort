import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allCells,
  axialToOffset,
  cellId,
  hexDistance,
  isCell,
  neighborCells,
  offsetToAxial,
} from '../src/game/hex.js';

test('all 49 board coordinates round-trip through odd-r axial coordinates', () => {
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const cell = { col, row };
      assert.deepEqual(axialToOffset(offsetToAxial(cell)), cell);
      assert.equal(cellId(cell), `r${row}c${col}`);
      assert.equal(isCell(cell), true);
    }
  }
});

test('neighbors stay inside the board, are reciprocal, and have distance one', () => {
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const cell = { col, row };
      const neighbors = neighborCells(cell);
      assert.ok(neighbors.length <= 6);
      assert.equal(new Set(neighbors.map(cellId)).size, neighbors.length);
      for (const neighbor of neighbors) {
        assert.equal(isCell(neighbor), true);
        assert.equal(hexDistance(cell, neighbor), 1);
        assert.ok(neighborCells(neighbor).some((candidate) => cellId(candidate) === cellId(cell)));
      }
    }
  }
  assert.equal(neighborCells({ col: 0, row: 0 }).length, 2);
  assert.equal(neighborCells({ col: 3, row: 3 }).length, 6);
});

test('distance is symmetric and out-of-board axial coordinates are omitted', () => {
  assert.equal(hexDistance({ col: 0, row: 0 }, { col: 6, row: 6 }), 9);
  assert.equal(hexDistance({ col: 6, row: 6 }, { col: 0, row: 0 }), 9);
  assert.equal(axialToOffset({ q: 100, r: 100 }), null);
  assert.throws(() => offsetToAxial({ col: 7, row: 0 }), RangeError);
  assert.throws(() => hexDistance({ col: 0.5, row: 0 }, { col: 1, row: 0 }), RangeError);
});

test('board materialization lists every position as empty, blocked, or token', () => {
  const cells = allCells({
    blockedCells: [{ col: 1, row: 0 }],
    tokens: [{ tokenId: 'piece-1', color: 'red', mass: 1, cell: { col: 2, row: 0 } }],
  });
  assert.equal(cells.length, 49);
  assert.deepEqual(cells[0], { cell: { col: 0, row: 0 }, cellId: 'r0c0', kind: 'empty' });
  assert.equal(cells[1].kind, 'blocked');
  assert.deepEqual(cells[2], { cell: { col: 2, row: 0 }, cellId: 'r0c2', kind: 'token', tokenId: 'piece-1' });
  assert.equal(cells.every((entry, index) => entry.cellId === `r${Math.floor(index / 7)}c${index % 7}`), true);
});
