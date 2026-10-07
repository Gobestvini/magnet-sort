// Original vector artwork. Shared by Pixi textures, DOM controls and result cards.
export const PALETTE = Object.freeze({
  red: { light: '#ff8a80', face: '#ff514d', side: '#ce292c', dark: '#951c25' },
  blue: { light: '#54d5ff', face: '#159bff', side: '#0864ce', dark: '#034798' },
  yellow: { light: '#fff188', face: '#ffca31', side: '#e39409', dark: '#ad6405' },
  green: { light: '#91ed8b', face: '#3cce63', side: '#169443', dark: '#0d6d34' },
});

export function roundedHexPath(cx, cy, radius) {
  const points = Array.from({ length: 6 }, (_, i) => ({ x: cx + Math.cos(i * Math.PI / 3) * radius, y: cy + Math.sin(i * Math.PI / 3) * radius }));
  let path = '';
  for (let i = 0; i < 6; i++) {
    const prev = points[(i + 5) % 6], here = points[i], next = points[(i + 1) % 6];
    const a = { x: here.x + (prev.x - here.x) * 0.15, y: here.y + (prev.y - here.y) * 0.15 };
    const b = { x: here.x + (next.x - here.x) * 0.15, y: here.y + (next.y - here.y) * 0.15 };
    path += (i === 0 ? 'M' : 'L') + a.x.toFixed(2) + ',' + a.y.toFixed(2) + 'Q' + here.x.toFixed(2) + ',' + here.y.toFixed(2) + ' ' + b.x.toFixed(2) + ',' + b.y.toFixed(2);
  }
  return path + 'Z';
}

function wrap(defs, body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs>' + defs + '</defs>' + body + '</svg>';
}

const shadow = '<filter id="shadow" x="-40%" y="-40%" width="180%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>';

export function chipSvg(color = 'blue', mass = 1, number = true) {
  const p = PALETTE[color] ?? PALETTE.blue;
  const layers = Math.min(3, Math.max(1, mass));
  const cy = 117 - (layers - 1) * 10;
  const defs = shadow + '<linearGradient id="face" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="' + p.light + '"/><stop offset=".42" stop-color="' + p.face + '"/><stop offset="1" stop-color="' + p.face + '"/></linearGradient><linearGradient id="side" x2=".2" y2="1"><stop stop-color="' + p.side + '"/><stop offset="1" stop-color="' + p.dark + '"/></linearGradient><linearGradient id="rim" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".8"/><stop offset=".55" stop-color="' + p.light + '"/><stop offset="1" stop-color="' + p.side + '"/></linearGradient>';
  let body = '<ellipse cx="130" cy="165" rx="82" ry="61" fill="#573a23" opacity=".25" filter="url(#shadow)"/>';
  for (let layer = 0; layer < layers; layer++) {
    const y = 117 - layer * 10;
    body += '<path d="' + roundedHexPath(128, y + 19, 86) + '" fill="url(#side)" stroke="' + p.dark + '" stroke-width="2"/><path d="' + roundedHexPath(128, y, 86) + '" fill="url(#rim)" stroke="' + p.side + '" stroke-width="2"/>';
  }
  body += '<path d="' + roundedHexPath(128, cy - 3, 80) + '" fill="url(#face)"/><path d="' + roundedHexPath(128, cy - 5, 77) + '" fill="none" stroke="#ffffff" stroke-opacity=".15" stroke-width="2"/><path d="M58 ' + (cy - 23) + 'Q74 ' + (cy - 65) + ' 92 ' + (cy - 69) + 'H164" fill="none" stroke="#ffffff" stroke-opacity=".62" stroke-width="3" stroke-linecap="round"/>';
  body += '<g transform="translate(128 ' + (cy - 5) + ')" fill="' + p.side + '" stroke="' + p.dark + '" stroke-opacity=".45" stroke-width="2">';
  if (color === 'red') body += '<path d="M0 -23Q4 -23 7 -18L24 13Q26 20 19 20H-19Q-26 20-23 13L-7 -18Q-4 -23 0 -23Z"/>';
  else if (color === 'yellow') body += '<path d="M0 -24L8 -8 26 -6 13 7 16 25 0 16-16 25-13 7-26-6-8-8Z" stroke-linejoin="round"/>';
  else if (color === 'green') body += '<path d="M0 -4C-23 -36-39 -2-14 6C-37 29-2 39 0 14C5 42 38 24 14 7C41 0 20 -31 0 -4Z"/>';
  else body += '<circle r="23"/>';
  body += '</g><path d="M108 ' + (cy - 13) + 'Q115 ' + (cy - 32) + ' 137 ' + (cy - 26) + '" fill="none" stroke="' + p.light + '" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>';
  body += '<circle cx="172" cy="' + (cy + 38) + '" r="16" fill="' + p.dark + '" opacity=".84" stroke="' + p.light + '" stroke-width="2"/>';
  if (number) body += '<text x="172" y="' + (cy + 46) + '" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="900">' + mass + '</text>';
  return wrap(defs, body);
}

export function cellSvg(kind = 'empty') {
  const face = kind === 'blocked' ? '#bbc5cb' : kind === 'crate' ? '#d9a06c' : '#fae8cf';
  const light = kind === 'blocked' ? '#d9e0e3' : kind === 'crate' ? '#f3c995' : '#fff7eb';
  let body = '<path d="' + roundedHexPath(128, 136, 92) + '" fill="#ac825f" opacity=".18"/><path d="' + roundedHexPath(128, 128, 92) + '" fill="url(#cell)" stroke="#d9b999" stroke-width="3"/><path d="' + roundedHexPath(128, 126, 86) + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>';
  if (kind === 'blocked') body += '<path d="M105 107L151 151M151 107L105 151" stroke="#87949d" stroke-width="11" stroke-linecap="round"/>';
  if (kind === 'crate') body += '<rect x="81" y="82" width="94" height="94" rx="12" fill="#cd8c51" stroke="#8f582d" stroke-width="6"/><path d="M91 91L165 165M165 91L91 165M128 84V174" stroke="#f1bd80" stroke-width="9"/>';
  return wrap('<linearGradient id="cell" x2=".3" y2="1"><stop stop-color="' + light + '"/><stop offset="1" stop-color="' + face + '"/></linearGradient>', body);
}

export function magnetSvg(color = 'blue') {
  const p = PALETTE[color] ?? PALETTE.blue;
  const defs = shadow + '<radialGradient id="halo"><stop stop-color="#b6ffff" stop-opacity=".94"/><stop offset=".65" stop-color="#37dfff" stop-opacity=".55"/><stop offset="1" stop-color="#11c9ff" stop-opacity="0"/></radialGradient><linearGradient id="pad" x2=".3" y2="1"><stop stop-color="#54ebff"/><stop offset=".5" stop-color="#14b9ff"/><stop offset="1" stop-color="#075bd0"/></linearGradient><linearGradient id="body" x2=".7" y2="1"><stop stop-color="' + p.light + '"/><stop offset=".4" stop-color="' + p.face + '"/><stop offset="1" stop-color="' + p.side + '"/></linearGradient><linearGradient id="metal" x2=".3" y2="1"><stop stop-color="#fff"/><stop offset=".6" stop-color="#f5fcff"/><stop offset="1" stop-color="#adcce3"/></linearGradient>';
  const base = '<circle cx="128" cy="127" r="125" fill="url(#halo)"/><path d="' + roundedHexPath(128, 145, 89) + '" fill="#075ba6"/><path d="' + roundedHexPath(128, 127, 89) + '" fill="url(#pad)" stroke="#b6ffff" stroke-width="4"/><path d="' + roundedHexPath(128, 124, 78) + '" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>';
  const u = 'M-36 -37V4A36 36 0 0 0 36 4V-37';
  return wrap(defs, base + '<g transform="translate(128 119) rotate(28)"><path d="' + u + '" transform="translate(0 10)" fill="none" stroke="' + p.dark + '" stroke-width="29" stroke-linejoin="round"/><path d="' + u + '" fill="none" stroke="url(#body)" stroke-width="27" stroke-linejoin="round"/><path d="M-36 -38V-21M36 -38V-21" stroke="url(#metal)" stroke-width="28"/><path d="M-42 -8V3A28 28 0 0 0 9 31" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/></g>');
}

const urls = new Map();
export function artUrl(svg) {
  if (!urls.has(svg)) urls.set(svg, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  return urls.get(svg);
}

const thumbnails = new WeakMap();
export function boardThumbnailSvg(level) {
  if (thumbnails.has(level)) return thumbnails.get(level);
  const tokenByCell = new Map(level.tokens.map(token => [token.cell.col + ':' + token.cell.row, token]));
  const blocked = new Set(level.blockedCells.map(cell => cell.col + ':' + cell.row));
  const crates = new Set((level.crates ?? []).map(cell => cell.col + ':' + cell.row));
  let body = '';
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const key = col + ':' + row, token = tokenByCell.get(key);
    const x = 25 + row * 43, y = 22 + (col + (row % 2) / 2) * 49.65;
    body += '<image x="' + (x - 36) + '" y="' + (y - 36) + '" width="72" height="72" href="' + artUrl(cellSvg(blocked.has(key) ? 'blocked' : crates.has(key) ? 'crate' : 'empty')) + '"/>';
    if (token) body += '<image x="' + (x - 36) + '" y="' + (y - 36) + '" width="72" height="72" href="' + artUrl(chipSvg(token.color, token.mass)) + '"/>';
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="395" viewBox="-17 -17 340 395">' + body + '</svg>';
  thumbnails.set(level, svg);
  return svg;
}
