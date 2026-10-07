import { cellToScreen } from './layout.js';

const COLORS = { red: 0xff514d, blue: 0x159bff, yellow: 0xffca31, green: 0x3cce63 };

export function drawResolutionEffects(graphics, effects, layout) {
  for (const effect of effects) {
    const { x, y } = cellToScreen(effect.cell ?? effect.to, layout);
    const radius = layout.radius;
    if (effect.type === 'placed-magnet') {
      const alpha = 1 - effect.progress;
      const color = COLORS[effect.color] ?? COLORS.red;
      const magnetRadius = radius * 0.48;
      graphics.ellipse(x, y + magnetRadius * 0.74, magnetRadius * 1.05, magnetRadius * 0.34)
        .fill({ color: 0x55483f, alpha: alpha * 0.22 });
      graphics.circle(x, y, radius * (0.65 + effect.progress * 0.3))
        .stroke({ color, width: Math.max(2, radius * 0.065), alpha: alpha * 0.55 });
      graphics.circle(x, y, magnetRadius * 1.13).fill({ color: 0xfffcf7, alpha: alpha * 0.98 })
        .stroke({ color: 0xffffff, width: Math.max(1.5, radius * 0.045), alpha });
      graphics.moveTo(x - magnetRadius * 0.42, y + magnetRadius * 0.1)
        .arc(x, y + magnetRadius * 0.1, magnetRadius * 0.42, Math.PI, 0)
        .stroke({ color, width: magnetRadius * 0.27, cap: 'round', alpha });
      graphics.moveTo(x - magnetRadius * 0.42, y + magnetRadius * 0.1).lineTo(x - magnetRadius * 0.42, y + magnetRadius * 0.45)
        .moveTo(x + magnetRadius * 0.42, y + magnetRadius * 0.1).lineTo(x + magnetRadius * 0.42, y + magnetRadius * 0.45)
        .stroke({ color, width: magnetRadius * 0.27, cap: 'round', alpha });
      graphics.moveTo(x - magnetRadius * 0.56, y + magnetRadius * 0.46).lineTo(x - magnetRadius * 0.29, y + magnetRadius * 0.46)
        .moveTo(x + magnetRadius * 0.29, y + magnetRadius * 0.46).lineTo(x + magnetRadius * 0.56, y + magnetRadius * 0.46)
        .stroke({ color: 0x5d5860, width: magnetRadius * 0.15, cap: 'round', alpha });
    } else if (effect.type === 'pull-line') {
      const { x: fromX, y: fromY } = cellToScreen(effect.from, layout);
      const end = effect.magnetCell ? cellToScreen(effect.magnetCell, layout) : { x, y };
      const bendX = (fromX + end.x) / 2 + (end.y - fromY) * 0.12;
      const bendY = (fromY + end.y) / 2 - (end.x - fromX) * 0.12;
      for (const [width, alpha, color] of [[0.4, 0.12, 0x00cfff], [0.22, 0.4, 0x56eaff], [0.07, 0.96, 0xeeffff]]) {
        graphics.moveTo(fromX, fromY - radius * 0.15).quadraticCurveTo(bendX, bendY, end.x, end.y)
          .stroke({ color, width: Math.max(2, radius * width), alpha: alpha * (1 - effect.progress * 0.25), cap: 'round' });
      }
      const pulse = 0.22 + ((effect.progress * 2) % 0.55);
      graphics.circle(fromX + (x - fromX) * pulse, fromY + (y - fromY) * pulse, radius * 0.1)
        .fill({ color: 0xffffff, alpha: 0.92 });
      graphics.circle(x, y, radius * (0.13 + effect.progress * 0.1))
        .fill({ color: COLORS[effect.color] ?? 0xef6b62, alpha: 0.72 * (1 - effect.progress * 0.4) });
    } else if (effect.type === 'merge') {
      const alpha = Math.sin(effect.progress * Math.PI);
      graphics.circle(x, y, radius * (0.46 + effect.progress * 0.22))
        .stroke({ color: 0xfff3c4, width: Math.max(2, radius * 0.08), alpha: alpha * 0.9 });
      drawBadge(graphics, x, y - radius * 0.62, effect.mass, 0x65533d, alpha, 'mass');
    } else if (effect.type === 'clear') {
      const alpha = 1 - effect.progress;
      graphics.circle(x, y, radius * (0.5 + effect.progress * 0.62))
        .stroke({ color: 0xffffff, width: Math.max(2, radius * 0.12), alpha });
      graphics.circle(x, y, radius * effect.progress * 0.72)
        .fill({ color: 0xf7c95d, alpha: alpha * 0.34 });
      drawBadge(graphics, x, y - radius * 0.64, effect.chain, COLORS.red, alpha, 'chain');
      graphics.circle(x, y, radius * (0.52 + effect.progress * 0.28))
        .stroke({ color: 0xf2c64e, width: Math.max(1.5, radius * 0.045), alpha: alpha * 0.7 });
    }
  }
}

export function drawTutorialHint(graphics, hint, layout) {
  if (!hint?.active) return;
  const target = cellToScreen(hint.cell, layout);
  const token = cellToScreen(hint.tokenCell, layout);
  const tray = {
    x: layout.width / 2,
    y: Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.boardHeight + layout.radius * 0.9),
  };
  const color = COLORS[hint.color] ?? COLORS.red;
  const seconds = hint.elapsed;
  if (seconds < 1) {
    const pulse = 0.5 + 0.5 * Math.sin(seconds * Math.PI * 3);
    graphics.circle(tray.x, tray.y, layout.radius * (0.64 + pulse * 0.12))
      .stroke({ color, width: Math.max(2, layout.radius * 0.09), alpha: 0.8 });
  } else if (seconds < 2) {
    const progress = seconds - 1;
    const x = tray.x + (target.x - tray.x) * progress;
    const y = tray.y + (target.y - tray.y) * progress;
    drawHintMagnet(graphics, x, y, layout.radius * 0.28, color, 0.85);
    graphics.moveTo(tray.x, tray.y).lineTo(target.x, target.y)
      .stroke({ color, width: Math.max(1.5, layout.radius * 0.04), alpha: 0.22 });
  } else {
    const progress = seconds - 2;
    drawHintMagnet(graphics, target.x, target.y, layout.radius * 0.27, color, 0.85);
    graphics.moveTo(token.x, token.y).lineTo(target.x, target.y)
      .stroke({ color, width: Math.max(2, layout.radius * 0.07), alpha: 0.55 });
    const x = token.x + (target.x - token.x) * progress;
    const y = token.y + (target.y - token.y) * progress;
    graphics.circle(x, y, layout.radius * 0.24).fill({ color, alpha: 0.35 })
      .stroke({ color: 0xffffff, width: Math.max(1.5, layout.radius * 0.06), alpha: 0.9 });
    graphics.circle(x, y, layout.radius * 0.09).fill({ color: 0xffffff, alpha: 0.9 });
  }
}

function drawBadge(graphics, x, y, value, color, alpha, kind) {
  if (alpha <= 0.01) return;
  const text = String(value);
  const width = kind === 'chain' ? 37 : Math.max(31, text.length * 13 + 19);
  graphics.roundRect(x - width / 2, y - 10, width, 20, 8)
    .fill({ color, alpha: alpha * 0.94 });
  if (kind === 'chain') {
    graphics.circle(x - 8, y, 4).stroke({ color: 0xffe4a0, width: 1.7, alpha });
    graphics.circle(x - 3, y, 4).stroke({ color: 0xffe4a0, width: 1.7, alpha });
    drawNumber(graphics, value, x + 6, y + 3, 3.1, alpha);
  } else {
    drawNumber(graphics, value, x, y + 3.2, 3.3, alpha);
  }
}

function drawHintMagnet(graphics, x, y, radius, color, alpha) {
  graphics.ellipse(x, y + radius * 0.72, radius * 1.12, radius * 0.36)
    .fill({ color: 0x55483f, alpha: alpha * 0.24 });
  graphics.circle(x, y, radius * 1.18).fill({ color: 0xfffcf7, alpha: alpha * 0.96 });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12)
    .arc(x, y + radius * 0.12, radius * 0.42, Math.PI, 0)
    .stroke({ color, width: radius * 0.28, cap: 'round', alpha });
  graphics.moveTo(x - radius * 0.42, y + radius * 0.12).lineTo(x - radius * 0.42, y + radius * 0.48)
    .moveTo(x + radius * 0.42, y + radius * 0.12).lineTo(x + radius * 0.42, y + radius * 0.48)
    .stroke({ color, width: radius * 0.28, cap: 'round', alpha });
}

function drawNumber(graphics, value, x, y, unit, alpha) {
  const digits = [
    [1,1,1,1,1,1,0], [0,1,1,0,0,0,0], [1,1,0,1,1,0,1],
    [1,1,1,1,0,0,1], [0,1,1,0,0,1,1], [1,0,1,1,0,1,1],
    [1,0,1,1,1,1,1], [1,1,1,0,0,0,0], [1,1,1,1,1,1,1],
  ];
  const string = String(value);
  const digitWidth = unit * 2.5;
  for (let digit = 0; digit < string.length; digit++) {
    const number = Number(string[digit]);
    const segments = digits[number - 1] ?? digits[0];
    const cx = x + (digit - (string.length - 1) / 2) * digitWidth;
    const halfWidth = unit * 0.8;
    const halfHeight = unit * 0.52;
    const paths = [
      [cx-halfWidth,y-halfHeight,cx+halfWidth,y-halfHeight], [cx+halfWidth,y-halfHeight,cx+halfWidth,y],
      [cx+halfWidth,y,cx+halfWidth,y+halfHeight], [cx-halfWidth,y+halfHeight,cx+halfWidth,y+halfHeight],
      [cx-halfWidth,y,cx-halfWidth,y+halfHeight], [cx-halfWidth,y-halfHeight,cx-halfWidth,y],
      [cx-halfWidth,y,cx+halfWidth,y],
    ];
    for (let index = 0; index < 7; index++) if (segments[index]) {
      graphics.moveTo(paths[index][0],paths[index][1]).lineTo(paths[index][2],paths[index][3])
        .stroke({ color: 0xffffff, width: Math.max(1.4, unit * 0.58), cap: 'round', alpha });
    }
  }
}
