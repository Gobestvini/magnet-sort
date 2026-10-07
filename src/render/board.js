import { Graphics } from 'pixi.js';
import { allCells } from '../game/hex.js';
import { drawResolutionEffects, drawTutorialHint } from './effects.js';
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
    const animation = interaction.animation;
    const renderTokens = animation?.active ? animation.tokens : state.tokens;
    const animatedById = new Map(renderTokens.map((token) => [token.tokenId, token]));
    const cells = allCells({ blockedCells: level.blockedCells, crates: level.crates, tokens: renderTokens });
    for (const entry of cells) {
        const token = animatedById.get(entry.tokenId) ?? state.tokens.find((item) => item.tokenId === entry.tokenId);
        const { x, y } = token?.x !== undefined
          ? cellToScreen({ col: token.x, row: token.y }, layout)
          : cellToScreen(entry.cell, layout);
      const r = layout.radius * 0.91;
      if (entry.kind === 'token') {
        const alpha = token?.alpha ?? 1;
        grid.roundRect(x - r * 0.9, y - r * 0.78, r * 1.8, r * 1.78, r * 0.42).fill({ color: 0x8a7462, alpha: 0.12 * alpha });
        drawHex(grid, x, y - r * 0.06, r, COLORS[token?.color] ?? 0x888888, true, alpha);
        drawPattern(pieces, token?.color, x, y - r * 0.18, r * 0.28, alpha);
        pieces.roundRect(x - r * 0.3, y + r * 0.17, r * 0.6, r * 0.38, r * 0.16).fill({ color: 0xffffff, alpha: 0.9 * alpha });
        // Numeric mass is rendered as vector bars so the canvas remains self-contained.
        drawNumber(pieces, token?.mass ?? 1, x, y + r * 0.36, r * 0.1, alpha);
      } else if (entry.kind === 'blocked') {
        drawHex(grid, x, y, r, 0xb5ac9f, false);
        grid.moveTo(x - r * 0.25, y - r * 0.25).lineTo(x + r * 0.25, y + r * 0.25)
          .moveTo(x + r * 0.25, y - r * 0.25).lineTo(x - r * 0.25, y + r * 0.25)
          .stroke({ color: 0x77716b, width: Math.max(2, r * 0.09), cap: 'round' });
      } else if (entry.kind === 'crate') {
        drawHex(grid, x, y, r, 0x9b6a3d, true);
        grid.roundRect(x - r * 0.48, y - r * 0.42, r * 0.96, r * 0.76, r * 0.08)
          .fill({ color: 0xb77a43 }).stroke({ color: 0x704522, width: Math.max(1.5, r * 0.08) });
        for (const offset of [-0.2, 0.2]) {
          grid.moveTo(x + offset * r, y - r * 0.4).lineTo(x + offset * r, y + r * 0.31)
            .stroke({ color: 0x704522, width: Math.max(1.5, r * 0.07) });
        }
        grid.moveTo(x - r * 0.43, y - r * 0.1).lineTo(x + r * 0.43, y - r * 0.1)
          .stroke({ color: 0xd8a36b, width: Math.max(1.2, r * 0.045) });
      } else {
        drawHex(grid, x, y, r, 0xf4eadc, false);
        drawHex(grid, x, y, r * 0.81, 0xfffcf7, false);
      }
    }
    drawTray(pieces, layout);
    if (interaction.previewCell) {
      const { x, y } = cellToScreen(interaction.previewCell, layout);
      drawDropTarget(preview, x, y, layout.radius, COLORS[interaction.selectedColor] ?? 0x5b84c9);
    }
    if (interaction.dragging && interaction.pointerPoint && interaction.selectedColor) {
      drawDraggedMagnet(preview, interaction.pointerPoint.x, interaction.pointerPoint.y - 34, layout.radius, COLORS[interaction.selectedColor] ?? COLORS.red);
    }
    const effects = [...(animation?.effects ?? [])];
    if (interaction.placementFeedback) effects.push(interaction.placementFeedback);
    drawResolutionEffects(preview, effects, layout);
    drawTutorialHint(preview, interaction.tutorialHint, layout);
  }

  return {
    render,
    dispose() { if (disposed) return; disposed = true; grid.destroy(); pieces.destroy(); preview.destroy(); },
  };
}

function drawDraggedMagnet(graphics, x, y, boardRadius, color) {
  const radius = Math.min(26, Math.max(17, boardRadius * 0.48));
  graphics.ellipse(x + radius * 0.18, y + radius * 1.02, radius * 1.2, radius * 0.42)
    .fill({ color: 0x55483f, alpha: 0.25 });
  graphics.circle(x, y + radius * 0.2, radius * 1.12).fill({ color: 0xbdb2a6, alpha: 0.98 });
  graphics.circle(x, y + radius * 0.04, radius * 1.1).fill({ color: 0xfffcf7, alpha: 0.99 })
    .stroke({ color: 0xffffff, width: 2.5, alpha: 0.98 });
  graphics.arc(x, y + radius * 0.12, radius * 0.56, Math.PI * 1.08, Math.PI * 1.92)
    .stroke({ color: 0xffffff, width: Math.max(1.5, radius * 0.09), alpha: 0.95 });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12)
    .arc(x, y + radius * 0.12, radius * 0.42, Math.PI, 0)
    .stroke({ color: shade(color, -0.2), width: radius * 0.3, cap: 'round' });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12).lineTo(x - radius * 0.42, y + radius * 0.48)
    .moveTo(x + radius * 0.42, y + radius * 0.12).lineTo(x + radius * 0.42, y + radius * 0.48)
    .stroke({ color: shade(color, -0.2), width: radius * 0.3, cap: 'round' });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12)
    .arc(x, y + radius * 0.12, radius * 0.42, Math.PI, 0)
    .stroke({ color, width: radius * 0.19, cap: 'round' });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12).lineTo(x - radius * 0.42, y + radius * 0.48)
    .moveTo(x + radius * 0.42, y + radius * 0.12).lineTo(x + radius * 0.42, y + radius * 0.48)
    .stroke({ color, width: radius * 0.19, cap: 'round' });
  graphics.moveTo(x - radius * 0.54, y + radius * 0.49).lineTo(x - radius * 0.3, y + radius * 0.49)
    .moveTo(x + radius * 0.3, y + radius * 0.49).lineTo(x + radius * 0.54, y + radius * 0.49)
    .stroke({ color: 0x5d5860, width: radius * 0.17, cap: 'round' });
}

function drawDropTarget(graphics, x, y, radius, color) {
  const size = radius * 0.78;
  drawHex(graphics, x, y + radius * 0.2, size, shade(color, -0.28), true, 0.95);
  drawHex(graphics, x, y, size * 0.94, 0xfff9eb, true, 0.98);
  graphics.circle(x, y, size * 0.68)
    .stroke({ color, width: Math.max(2.5, radius * 0.1), alpha: 0.95 });
  graphics.moveTo(x - size * 0.45, y - size * 0.5).lineTo(x + size * 0.04, y - size * 0.5)
    .stroke({ color: 0xffffff, width: Math.max(1.5, radius * 0.045), alpha: 0.9, cap: 'round' });
}

function shade(color, amount) {
  const channels = [16, 8, 0].map((shift) => (color >> shift) & 0xff);
  return channels.reduce((result, channel, index) => {
    const adjusted = Math.max(0, Math.min(255, Math.round(channel * (1 + amount))));
    return result | (adjusted << [16, 8, 0][index]);
  }, 0);
}

function drawHex(graphics, x, y, radius, color, raised, alpha = 1) {
  const depth = radius * (raised ? 0.2 : 0.12);
  const points = Array.from({ length: 6 }, (_, corner) => {
    const angle = Math.PI / 3 * corner - Math.PI / 6;
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  });
  if (raised) graphics.ellipse(x + radius * 0.04, y + depth * 1.2, radius * 0.98, radius * 0.8)
    .fill({ color: 0x8b715d, alpha: 0.2 * alpha });
  // Dark lower edge and a lighter top face make each hex read as a small tile.
  graphics.moveTo(points[0].x, points[0].y + depth);
  for (let corner = 1; corner < points.length; corner++) graphics.lineTo(points[corner].x, points[corner].y + depth);
  graphics.closePath().fill({ color: shade(color, -0.2), alpha });
  graphics.moveTo(points[0].x, points[0].y);
  for (let corner = 1; corner < points.length; corner++) graphics.lineTo(points[corner].x, points[corner].y);
  graphics.closePath().fill({ color, alpha });
  graphics.stroke({ color: raised ? 0xffffff : 0xe9ddce, width: Math.max(1, radius * 0.07), alpha: (raised ? 0.98 : 0.95) * alpha });
  graphics.moveTo(points[5].x * 0.65 + points[0].x * 0.35, points[5].y * 0.65 + points[0].y * 0.35)
    .lineTo(points[0].x * 0.65 + points[1].x * 0.35, points[0].y * 0.65 + points[1].y * 0.35)
    .stroke({ color: 0xffffff, width: Math.max(1, radius * 0.035), alpha: (raised ? 0.75 : 0.5) * alpha, cap: 'round' });
}

function drawPattern(graphics, color, x, y, size, alpha = 1) {
  if (color === 'red') {
    graphics.circle(x, y, size).fill({ color: 0xffffff, alpha: 0.93 * alpha });
    graphics.circle(x, y, size * 0.42).fill({ color: COLORS.red, alpha });
  } else if (color === 'blue') {
    for (let i = -1; i <= 1; i++) graphics.moveTo(x - size, y + i * size * 0.55).lineTo(x + size, y + i * size * 0.55).stroke({ color: 0xffffff, width: Math.max(1.5, size * 0.22), alpha: 0.95 * alpha });
  } else if (color === 'yellow') {
    graphics.star(x, y, 5, size, size * 0.48).fill({ color: 0xffffff, alpha: 0.96 * alpha });
  } else {
    graphics.moveTo(x, y - size).lineTo(x, y + size).moveTo(x - size, y).lineTo(x + size, y).stroke({ color: 0xffffff, width: Math.max(1.5, size * 0.25), alpha });
  }
}

function drawNumber(graphics, value, x, y, unit, alpha = 1) {
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
    for (let i = 0; i < 7; i++) if (segments[i]) graphics.moveTo(paths[i][0],paths[i][1]).lineTo(paths[i][2],paths[i][3]).stroke({ color: 0x4d4850, width: Math.max(1.5, unit * 0.28), cap: 'round', alpha });
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
