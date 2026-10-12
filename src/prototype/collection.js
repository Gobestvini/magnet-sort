import { art } from './assets.js';
import { COLORS } from './model.js';

// Shares runtime's sampled clock: no CSS animation, timer, or second RAF.
export function createCollectionView() {
  const images = new Map();
  const pools = { path: [], circle: [] };
  let target = null, effects = null;
  let used = { path: 0, circle: 0 };
  const glowColors = Object.fromEntries(Object.entries(COLORS).map(([id, info]) => [id, info.hex]));
  function mark(layer, tag, attrs) {
    if (!effects) {
      effects = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      effects.classList.add('collection-effects'); effects.setAttribute('aria-hidden', 'true');
      layer.prepend(effects);
    }
    const index = used[tag]++;
    let node = pools[tag][index];
    if (!node) { node = document.createElementNS(effects.namespaceURI, tag); pools[tag].push(node); effects.append(node); }
    node.style.display = '';
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  }
  function sparkle(layer, x, y, size, color, opacity) {
    mark(layer, 'path', { d: `M${x} ${y-size}L${x+size*.3} ${y-size*.3}L${x+size} ${y}L${x+size*.3} ${y+size*.3}L${x} ${y+size}L${x-size*.3} ${y+size*.3}L${x-size} ${y}L${x-size*.3} ${y-size*.3}Z`, fill: color, stroke: 'none', opacity });
  }
  function burst(layer, origin, age, color, radius) {
    const p = age / .36, opacity = (1 - p) ** 2;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6 + .2, spread = radius * (.22 + p * (.8 + i % 3 * .16));
      const x = origin.x + Math.cos(angle) * spread, y = origin.y + Math.sin(angle) * spread * .65 + p * p * 9;
      if (i % 3 === 0) sparkle(layer, x, y, (1 - p) * 4 + .5, '#fff7cb', opacity);
      else mark(layer, 'circle', { cx: x, cy: y, r: (1 - p) * 2 + .4, fill: i % 2 ? color : '#fff7cb', opacity });
    }
  }
  function clear() {
    for (const image of images.values()) image.remove();
    images.clear();
    effects?.remove(); effects = null; pools.path.length = pools.circle.length = 0;
    if (target) { target.style.transform = ''; target.style.filter = ''; }
  }
  return {
    draw(frame, time, board, layer, counter, reduced, progress = 0) {
      if (!frame || !board || !layer || !counter) { clear(); return; }
      if (target !== counter) { clear(); target = counter; }
      const age = frame.lastArrival === null ? Infinity : time - frame.lastArrival;
      const pulse = reduced ? 0 : Math.max(0, 1 - age / .18);
      const rect = counter.getBoundingClientRect();
      const edgeInset = Math.min(rect.height/2,rect.width/2);
      const end = { x: rect.left + edgeInset + (rect.width-2*edgeInset)*Math.max(0,Math.min(1,progress)), y: rect.top + rect.height / 2 };
      used = { path: 0, circle: 0 };
      if (!reduced) {
        for (const b of frame.bursts) {
          const at = board.chipScreenPosition(b.cell, 0, 1);
          burst(layer, at, b.age, glowColors[b.color], at.width * .65);
        }
        if (age >= 0 && age < .36) burst(layer, end, age, '#ffe49b', 19);
      }
      const active = new Set();
      for (const unit of frame.units.filter(unit => unit.collecting && !reduced)) {
        active.add(unit.id);
        let image = images.get(unit.id);
        if (!image) {
          image = document.createElement('img'); image.className = 'collection-hex';
          image.src = art('chip-' + unit.color); image.alt = ''; image.draggable = false; image.decoding = 'sync';
          image.dataset.unitId = unit.id; layer.append(image); images.set(unit.id, image);
        }
        const start = board.chipScreenPosition(unit.cell, unit.index, unit.pack);
        const p = unit.progress, t = p * p;
        const side = unit.index % 2 ? -1 : 1;
        const controlX = start.x + side * Math.min(70, start.width * (1 + unit.index % 3 * .2));
        const controlY = start.y - Math.min(100, Math.abs(start.y - end.y) * .45);
        const position = progress => {
          const t = progress * progress, inv = 1 - t;
          return { x: inv * inv * start.x + 2 * inv * t * controlX + t * t * end.x,
            y: inv * inv * start.y + 2 * inv * t * controlY + t * t * end.y };
        };
        const { x, y } = position(p);
        // A short curved tail uses the same trajectory, rather than a straight
        // line between frames. Sampling remains deterministic on pause/resize.
        const tail = Array.from({ length: 10 }, (_, i) => position(Math.max(0, p - .23 * (1 - i / 9))));
        const opacity = Math.min(1, p * 12, (1 - p) * 8), color = glowColors[unit.color];
        mark(layer, 'path', { d: tail.map((at, i) => `${i ? 'L' : 'M'}${at.x} ${at.y}`).join(''), fill: 'none', stroke: color, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: opacity * .13 });
        for (let i = 1; i < tail.length; i++) {
          mark(layer, 'path', { d: `M${tail[i-1].x} ${tail[i-1].y}L${tail[i].x} ${tail[i].y}`, fill: 'none', stroke: i > 6 ? '#fff6df' : color, 'stroke-width': .5 + i * .32, 'stroke-linecap': 'round', opacity: opacity * i / 12 });
        }
        for (let i = 0; i < 2; i++) {
          const at = position(Math.max(0, p - .09 - i * .075));
          sparkle(layer, at.x + Math.sin(p * 14 + unit.index + i * 3) * 7, at.y + Math.cos(p * 11 + i) * 5, 2 + i, '#fff7cb', opacity * .65);
        }
        // Match the small individual wafer at handoff, then regain the previous
        // flight size smoothly; the trajectory and trail remain unchanged.
        const unfold = 1 - (1 - Math.min(1, p / .18)) ** 3;
        const scale = (1 + unfold * (.68 / .38 - 1)) * (1 + Math.sin(p * Math.PI) * .2 - t * .72);
        image.style.width = start.width + 'px'; image.style.height = start.height + 'px';
        image.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${side * Math.sin(p * Math.PI) * 16}deg) scale(${scale})`;
        image.style.opacity = String(Math.min(1, (1 - p) * 8));
        image.dataset.progress = String(p);
        image.dataset.targetX=String(end.x);image.dataset.targetY=String(end.y);
      }
      for (const [id, image] of images) if (!active.has(id)) { image.remove(); images.delete(id); }
      for (const tag of ['path', 'circle']) for (let i = used[tag]; i < pools[tag].length; i++) pools[tag][i].style.display = 'none';
    },
    clear,
    snapshot: () => [...images].map(([id, image]) => ({ id, progress: Number(image.dataset.progress) })),
    dispose() { clear(); target = null; },
  };
}
