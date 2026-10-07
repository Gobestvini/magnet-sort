import { Graphics } from 'pixi.js';
import { allCells } from '../game/hex.js';
import { cellToScreen } from './layout.js';

const COLORS = { red: 0xef6b62, blue: 0x5388d8, yellow: 0xf2c64e, green: 0x54b995 };

export function createBoardRenderer(root) {
  const grid = new Graphics();
  const pieces = new Graphics();
  const preview = new Graphics();
  root.addChild(grid, pieces, preview);
  let disposed = false;

  function render(level, state, layout, interaction = {}) {
    if (disposed) return;
    grid.clear(); pieces.clear(); preview.clear();
    const cells = allCells({ blockedCells: level.blockedCells, tokens: state.tokens });
    for (const entry of cells) {
      const { x, y } = cellToScreen(entry.cell, layout);
      const r = layout.radius * 0.91;
      if (entry.kind === 'token') {
        grid.roundRect(x - r * 0.9, y - r * 0.78, r * 1.8, r * 1.78, r * 0.42).fill({ color: 0x8a7462, alpha: 0.12 });
        drawHex(grid, x, y - r * 0.06, r, COLORS[state.tokens.find((token) => token.tokenId === entry.tokenId)?.color] ?? 0x888888, true);
        const token = state.tokens.find((item) => item.tokenId === entry.tokenId);
        drawPattern(pieces, token.color, x, y - r * 0.18, r * 0.28);
        pieces.roundRect(x - r * 0.3, y + r * 0.17, r * 0.6, r * 0.38, r * 0.16).fill({ color: 0xffffff, alpha: 0.9 });
        // Numeric mass is rendered as vector bars so the canvas remains self-contained.
        drawNumber(pieces, token.mass, x, y + r * 0.36, r * 0.1);
      } else if (entry.kind === 'blocked') {
        drawHex(grid, x, y, r, 0xb5ac9f, false);
        grid.moveTo(x - r * 0.25, y - r * 0.25).lineTo(x + r * 0.25, y + r * 0.25)
          .moveTo(x + r * 0.25, y - r * 0.25).lineTo(x - r * 0.25, y + r * 0.25)
          .stroke({ color: 0x77716b, width: Math.max(2, r * 0.09), cap: 'round' });
      } else {
        drawHex(grid, x, y, r, 0xf4eadc, false);
        drawHex(grid, x, y, r * 0.81, 0xfffcf7, false);
      }
    }
    drawTray(pieces, layout);
    if (interaction.previewCell) {
      const { x, y } = cellToScreen(interaction.previewCell, layout);
      preview.circle(x, y, layout.radius * 0.64).stroke({ color: COLORS[interaction.selectedColor] ?? 0x5b84c9, width: Math.max(2.5, layout.radius * 0.1), alpha: 0.95 });
    }
    if (interaction.dragging && interaction.pointerPoint && interaction.selectedColor) {
      drawDraggedMagnet(preview, interaction.pointerPoint.x, interaction.pointerPoint.y - 34, layout.radius, COLORS[interaction.selectedColor] ?? COLORS.red);
    }
  }

  return {
    render,
    dispose() { if (disposed) return; disposed = true; grid.destroy(); pieces.destroy(); preview.destroy(); },
  };
}

function drawDraggedMagnet(graphics, x, y, boardRadius, color) {
  const radius = Math.min(26, Math.max(17, boardRadius * 0.48));
  graphics.ellipse(x, y + radius * 0.62, radius * 1.05, radius * 0.34).fill({ color: 0x55483f, alpha: 0.22 });
  graphics.circle(x, y, radius * 1.12).fill({ color: 0xfffcf7, alpha: 0.96 }).stroke({ color: 0xffffff, width: 2.5, alpha: 0.98 });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12)
    .arc(x, y + radius * 0.12, radius * 0.42, Math.PI, 0)
    .stroke({ color, width: radius * 0.27, cap: 'round' });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12).lineTo(x - radius * 0.42, y + radius * 0.48)
    .moveTo(x + radius * 0.42, y + radius * 0.12).lineTo(x + radius * 0.42, y + radius * 0.48)
    .stroke({ color, width: radius * 0.27, cap: 'round' });
  graphics.moveTo(x - radius * 0.54, y + radius * 0.49).lineTo(x - radius * 0.3, y + radius * 0.49)
    .moveTo(x + radius * 0.3, y + radius * 0.49).lineTo(x + radius * 0.54, y + radius * 0.49)
    .stroke({ color: 0x5d5860, width: radius * 0.17, cap: 'round' });
}

function drawHex(graphics, x, y, radius, color, raised) {
  if (raised) graphics.ellipse(x, y + radius * 0.12, radius * 0.94, radius * 0.86).fill({ color: 0xb5886a, alpha: 0.16 });
  for (let corner = 0; corner < 6; corner++) {
    const angle = Math.PI / 3 * corner - Math.PI / 6;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (corner === 0) graphics.moveTo(px, py); else graphics.lineTo(px, py);
  }
  graphics.closePath().fill({ color });
  graphics.stroke({ color: raised ? 0xffffff : 0xe9ddce, width: Math.max(1, radius * 0.07), alpha: raised ? 0.95 : 0.9 });
}

function drawPattern(graphics, color, x, y, size) {
  if (color === 'red') {
    graphics.circle(x, y, size).fill({ color: 0xffffff, alpha: 0.93 });
    graphics.circle(x, y, size * 0.42).fill({ color: COLORS.red });
  } else if (color === 'blue') {
    for (let i = -1; i <= 1; i++) graphics.moveTo(x - size, y + i * size * 0.55).lineTo(x + size, y + i * size * 0.55).stroke({ color: 0xffffff, width: Math.max(1.5, size * 0.22), alpha: 0.95 });
  } else if (color === 'yellow') {
    graphics.star(x, y, 5, size, size * 0.48).fill({ color: 0xffffff, alpha: 0.96 });
  } else {
    graphics.moveTo(x, y - size).lineTo(x, y + size).moveTo(x - size, y).lineTo(x + size, y).stroke({ color: 0xffffff, width: Math.max(1.5, size * 0.25) });
  }
}

function drawNumber(graphics, value, x, y, unit) {
  // Seven-segment glyphs for masses 1–9, the supported level range.
  const digits = [
    [1,1,1,1,1,1,0], [0,1,1,0,0,0,0], [1,1,0,1,1,0,1],
    [1,1,1,1,0,0,1], [0,1,1,0,0,1,1], [1,0,1,1,0,1,1],
    [1,0,1,1,1,1,1], [1,1,1,0,0,0,0], [1,1,1,1,1,1,1],
  ];
  const w = unit * 0.95, h = unit * 0.54;
  const text = String(value);
  const digitWidth = w * 2.15;
  for (let digit = 0; digit < text.length; digit++) {
    const number = Number(text[digit]);
    const segments = digits[number - 1] ?? digits[0];
    const cx = x + (digit - (text.length - 1) / 2) * digitWidth;
    const paths = [
      [cx-w,y-h,cx+w,y-h], [cx+w,y-h,cx+w,y], [cx+w,y,cx+w,y+h], [cx-w,y+h,cx+w,y+h],
      [cx-w,y,cx-w,y+h], [cx-w,y-h,cx-w,y], [cx-w,y,cx+w,y],
    ];
    for (let i = 0; i < 7; i++) if (segments[i]) graphics.moveTo(paths[i][0],paths[i][1]).lineTo(paths[i][2],paths[i][3]).stroke({ color: 0x4d4850, width: Math.max(1.5, unit * 0.28), cap: 'round' });
  }
}

function drawTray(graphics, layout) {
  const x = layout.width / 2;
  const y = Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.boardHeight + layout.radius * 0.9);
  const r = layout.radius * 0.5;
  graphics.roundRect(x - r * 1.4, y - r * 0.62, r * 2.8, r * 1.24, r * 0.45).fill({ color: 0xffffff, alpha: 0.8 }).stroke({ color: 0xe8ded1, width: 1.5 });
  // Horseshoe magnet silhouette: two colored poles joined by a curved body.
  graphics.moveTo(x - r * 0.55, y + r * 0.08)
    .arc(x, y + r * 0.08, r * 0.55, Math.PI, 0)
    .stroke({ color: COLORS.red, width: Math.max(3, r * 0.25), cap: 'round' });
  graphics.moveTo(x - r * 0.55, y + r * 0.08).lineTo(x - r * 0.55, y + r * 0.43)
    .moveTo(x + r * 0.55, y + r * 0.08).lineTo(x + r * 0.55, y + r * 0.43).stroke({ color: COLORS.red, width: Math.max(3, r * 0.25), cap: 'round' });
  graphics.moveTo(x - r * 0.67, y + r * 0.45).lineTo(x - r * 0.43, y + r * 0.45)
    .moveTo(x + r * 0.43, y + r * 0.45).lineTo(x + r * 0.67, y + r * 0.45).stroke({ color: 0x59545b, width: Math.max(2, r * 0.13), cap: 'round' });
}
