import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointerController } from '../src/input/pointer.js';
import { loadPrototypeLevel } from '../src/game/levels.js';
import { createBoardLayout, cellToScreen } from '../src/render/layout.js';

function setup() {
  const listeners = new Map();
  const captures = new Set();
  const target = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    getBoundingClientRect() { return { left: 0, top: 0 }; },
    setPointerCapture(id) { captures.add(id); },
    hasPointerCapture(id) { return captures.has(id); },
    releasePointerCapture(id) { captures.delete(id); },
  };
  const level = loadPrototypeLevel('prototype-03-blocker');
  const state = { tokens: level.tokens.map((token) => ({ ...token, cell: { ...token.cell } })) };
  const layout = createBoardLayout(800, 700);
  const actions = [];
  const previews = [];
  const controller = createPointerController(target, {
    getLayout: () => layout, getLevel: () => level, getState: () => state,
    onPreview: (value) => previews.push(value), onAction: (value) => actions.push(value),
  });
  function send(type, { x, y, pointerId = 1, isPrimary = true, button = 0, pointerType = 'touch' } = {}) {
    let prevented = false;
    listeners.get(type)?.({ clientX: x, clientY: y, pointerId, isPrimary, button, pointerType, preventDefault() { prevented = true; } });
    return prevented;
  }
  const tray = { x: layout.width / 2, y: Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.boardHeight + layout.radius * 0.9) };
  return { actions, captures, controller, layout, previews, send, state, tray };
}

test('magnet drag and tap-to-place each emit exactly one command', () => {
  const drag = setup();
  const destination = cellToScreen({ col: 3, row: 0 }, drag.layout);
  drag.send('pointerdown', drag.tray);
  assert.equal(drag.controller.snapshot().dragging, true);
  assert.deepEqual(drag.previews.at(-1).pointerPoint, drag.tray);
  drag.send('pointermove', destination);
  assert.deepEqual(drag.controller.snapshot().previewCell, { col: 3, row: 0 });
  assert.deepEqual(drag.controller.snapshot().pointerPoint, destination);
  assert.equal(drag.previews.at(-1).dragging, true);
  drag.send('pointerup', destination);
  assert.deepEqual(drag.actions, [{ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 0 } }]);
  assert.equal(drag.controller.snapshot().actionCount, 1);
  assert.equal(drag.controller.snapshot().pointerPoint, null);
  assert.equal(drag.captures.size, 0);

  const tap = setup();
  const target = cellToScreen({ col: 3, row: 0 }, tap.layout);
  tap.send('pointerdown', tap.tray); tap.send('pointerup', tap.tray);
  assert.equal(tap.controller.snapshot().selectedColor, 'red');
  tap.send('pointerdown', target); tap.send('pointerup', target);
  assert.equal(tap.actions.length, 1);
  assert.equal(tap.controller.snapshot().actionCount, 1);
});

test('blocked, occupied, outside, secondary-pointer and locked input never emit commands', () => {
  const ctx = setup();
  ctx.send('pointerdown', ctx.tray); ctx.send('pointerup', ctx.tray);
  for (const cell of [{ col: 2, row: 2 }, { col: 1, row: 3 }]) {
    const point = cellToScreen(cell, ctx.layout);
    ctx.send('pointerdown', point); ctx.send('pointerup', point);
  }
  ctx.send('pointerdown', { x: 1, y: 1 }); ctx.send('pointerup', { x: 1, y: 1 });
  const empty = cellToScreen({ col: 3, row: 0 }, ctx.layout);
  ctx.send('pointerdown', { ...empty, pointerId: 2, isPrimary: false });
  ctx.controller.setLocked(true);
  ctx.send('pointerdown', ctx.tray); ctx.send('pointerup', empty);
  assert.equal(ctx.actions.length, 0);
  assert.equal(ctx.controller.snapshot().actionCount, 0);
  assert.equal(ctx.controller.snapshot().pointerId, null);
});

test('pointercancel, pause lock, and dispose release capture and preview', () => {
  const ctx = setup();
  const point = cellToScreen({ col: 3, row: 0 }, ctx.layout);
  ctx.send('pointerdown', ctx.tray);
  ctx.send('pointermove', point);
  assert.equal(ctx.captures.has(1), true);
  ctx.send('pointercancel', point);
  assert.equal(ctx.controller.snapshot().selectedColor, null);
  assert.equal(ctx.controller.snapshot().previewCell, null);
  assert.equal(ctx.captures.size, 0);
  ctx.send('pointerdown', ctx.tray);
  ctx.controller.setLocked(true);
  assert.equal(ctx.captures.size, 0);
  assert.equal(ctx.controller.snapshot().dragging, false);
  ctx.controller.setLocked(false);
  ctx.send('pointerdown', ctx.tray);
  ctx.controller.dispose();
  assert.equal(ctx.captures.size, 0);
  assert.equal(ctx.previews.at(-1).selectedColor, null);
});
