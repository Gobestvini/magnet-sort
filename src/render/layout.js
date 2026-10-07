import { allCells } from '../game/hex.js';

const SQRT3 = Math.sqrt(3);
const CELL_ROWS = 7;
const CELL_COLS = 7;

export function createBoardLayout(width, height, resolution = 1) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const dpr = Number.isFinite(resolution) && resolution > 0 ? resolution : 1;
  const availableHeight = Math.max(40, safeHeight - 66);
  const radius = Math.max(8, Math.floor(Math.min((safeWidth - 22) / 11, (availableHeight - 16) / (SQRT3 * (CELL_COLS + 0.5))) * dpr) / dpr);
  const boardWidth = radius * (1.5 * (CELL_ROWS - 1) + 2);
  const boardHeight = SQRT3 * radius * (CELL_COLS + 0.5);
  const originX = (safeWidth - boardWidth) / 2 + radius;
  const originY = (availableHeight - boardHeight) / 2 + SQRT3 * radius / 2;
  const layout = { width: safeWidth, height: safeHeight, radius, originX, originY, boardWidth, boardHeight, resolution: dpr };
  layout.centers = new Map(allCells().map(({ cell, cellId }) => [cellId, cellToScreen(cell, layout)]));
  return layout;
}

export function cellToScreen(cell, layout) {
  return {
    x: layout.originX + layout.radius * 1.5 * cell.row,
    y: layout.originY + SQRT3 * layout.radius * (cell.col + (cell.row % 2) / 2),
  };
}

export function screenToCell(point, layout) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  for (const { cell } of allCells()) {
    const center = cellToScreen(cell, layout);
    if (insideHex(point, center, layout.radius)) return cell;
  }
  return null;
}

export function isMagnetTrayPoint(point, layout) {
  const x = layout.width / 2;
  const r = layout.radius * 0.5;
  const y = Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.boardHeight + layout.radius * 0.9);
  return Math.abs(point.x - x) <= Math.max(r * 1.4, 24) && Math.abs(point.y - y) <= Math.max(r * 0.62, 22);
}

function insideHex(point, center, radius) {
  let inside = false;
  for (let i = 0, j = 5; i < 6; j = i, i += 1) {
    const angleI = Math.PI / 3 * i;
    const angleJ = Math.PI / 3 * j;
    const xi = center.x + Math.cos(angleI) * radius * 0.91;
    const yi = center.y + Math.sin(angleI) * radius * 0.91;
    const xj = center.x + Math.cos(angleJ) * radius * 0.91;
    const yj = center.y + Math.sin(angleJ) * radius * 0.91;
    const cross = (point.x - xi) * (yj - yi) - (point.y - yi) * (xj - xi);
    const edgeLength = Math.hypot(xj - xi, yj - yi);
    if (Math.abs(cross) <= 1e-7 * edgeLength && point.x >= Math.min(xi, xj) - 1e-7 && point.x <= Math.max(xi, xj) + 1e-7
      && point.y >= Math.min(yi, yj) - 1e-7 && point.y <= Math.max(yi, yj) + 1e-7) return false;
    if ((yi > point.y) !== (yj > point.y) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
