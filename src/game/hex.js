const ROWS = 7;
const COLS = 7;

// Axial direction order is part of rulesVersion 1 and is used by path tie-breaks.
const DIRECTIONS = Object.freeze([
  Object.freeze({ q: 1, r: 0 }),
  Object.freeze({ q: 1, r: -1 }),
  Object.freeze({ q: 0, r: -1 }),
  Object.freeze({ q: -1, r: 0 }),
  Object.freeze({ q: -1, r: 1 }),
  Object.freeze({ q: 0, r: 1 }),
]);

export function isCell(cell) {
  return Boolean(cell)
    && Number.isInteger(cell.col) && cell.col >= 0 && cell.col < COLS
    && Number.isInteger(cell.row) && cell.row >= 0 && cell.row < ROWS;
}

export function offsetToAxial(cell) {
  assertCell(cell);
  return { q: cell.col - Math.floor(cell.row / 2), r: cell.row };
}

export function axialToOffset(axial) {
  if (!axial || !Number.isInteger(axial.q) || !Number.isInteger(axial.r)) {
    throw new TypeError('axial coordinate must contain integer q and r');
  }
  const cell = { col: axial.q + Math.floor(axial.r / 2), row: axial.r };
  return isCell(cell) ? cell : null;
}

export function cellId(cell) {
  assertCell(cell);
  return `r${cell.row}c${cell.col}`;
}

export function neighborCells(cell) {
  const { q, r } = offsetToAxial(cell);
  return DIRECTIONS
    .map((direction) => axialToOffset({ q: q + direction.q, r: r + direction.r }))
    .filter(Boolean);
}

export function hexDistance(first, second) {
  const a = offsetToAxial(first);
  const b = offsetToAxial(second);
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function allCells({ blockedCells = [], tokens = [] } = {}) {
  const blocked = new Set(blockedCells.map(cellId));
  const tokenAt = new Map(tokens.map((token) => [cellId(token.cell), token]));
  return Array.from({ length: ROWS * COLS }, (_, index) => {
    const cell = { col: index % COLS, row: Math.floor(index / COLS) };
    const id = cellId(cell);
    const token = tokenAt.get(id);
    return {
      cell,
      cellId: id,
      kind: blocked.has(id) ? 'blocked' : token ? 'token' : 'empty',
      ...(token ? { tokenId: token.tokenId } : {}),
    };
  });
}

function assertCell(cell) {
  if (!isCell(cell)) throw new RangeError('cell must be an integer odd-r coordinate inside the 7x7 board');
}
