import './prototype.css';
import { h, render } from 'preact';
import { createStepper } from '../loop.js';
import { cellId } from '../game/hex.js';
import { createPrototypeState, applyMagnet, canPlaceMagnet } from './model.js';
import { prototypeLevels } from './levels.js';
import { makeTransferTimeline } from './motion.js';
import { createThreeBoard } from './board.js';
import { PrototypeApp } from './App.js';

const root = document.querySelector('#ui-root');
// Preact mounts into an empty host; the static boot message belongs to HTML only.
root.replaceChildren();
const stepper = createStepper();
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let levelIndex = 0, level = prototypeLevels[0], state = createPrototypeState(level);
let selected = level.magnets[0], phase = 'playing', paused = false, notice = 'Choose a magnet and an empty tile.';
let displayedCleared = 0;
let clearingCount = 0;
let canvas = null, host = null, board = null, timeline = null, elapsed = 0, previousElapsed = 0;
let hover = null, keyboardCell = null, gesture = null, raf = null, previous = null, disposed = false, error = null;
const canvasRef = node => { canvas = node; };
const hostRef = node => { host = node; };
const cleanups = [];
function listen(target, name, handler, options) {
  target.addEventListener(name, handler, options);
  cleanups.push(() => target.removeEventListener(name, handler, options));
}
function ui() {
  if (disposed) return;
  render(h(PrototypeApp, { level, levelIndex, totalLevels: prototypeLevels.length, state: { ...state, cleared: displayedCleared }, phase, selected, paused, notice, reduced,
    canvasRef, hostRef, keyboardCell, error, clearingCount,
    onSelect: select, onToolDown: toolDown, onPause: () => setPaused(!paused), onReset: reset,
    onNext: () => loadLevel((levelIndex + 1) % prototypeLevels.length), onHint: hint,
    onReduced: event => { reduced = event.currentTarget.checked; ui(); }, onKeyboard: keyboard,
    onRetryRenderer: initializeBoard }), root);
}
function draw(alpha = 1) {
  const time = previousElapsed + (elapsed - previousElapsed) * alpha;
  board?.draw(level, state, { timeline, time, hover: keyboardCell ?? hover, selected, paused });
}
function schedule() {
  if (raf === null && !disposed && !paused && !document.hidden && board && timeline) raf = requestAnimationFrame(tick);
}
function cancelFrame() {
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null; previous = null; previousElapsed = elapsed; stepper.reset();
}
function tick(now) {
  raf = null;
  const delta = previous === null ? 0 : Math.max(0, (now - previous) / 1000);
  previous = now;
  const { alpha } = stepper.advance(delta, dt => { previousElapsed = elapsed; elapsed += dt; });
  const activeClear = timeline?.segments.find(segment => segment.type === 'unitsCleared' && segment.start <= elapsed && segment.end > elapsed)?.units.length ?? 0;
  if (activeClear !== clearingCount) { clearingCount = activeClear; ui(); }
  const cleared = timeline ? timeline.before.cleared + timeline.segments.filter(segment => segment.type === 'unitsCleared' && segment.end <= elapsed).reduce((sum, segment) => sum + segment.units.length, 0) : state.cleared;
  if (cleared !== displayedCleared) { displayedCleared = cleared; ui(); }
  if (timeline && elapsed >= timeline.duration) {
    timeline = null; phase = state.terminal ?? 'playing';
    notice = state.terminal === 'won' ? 'All pieces cleared!' : state.terminal === 'lost' ? 'Try a different magnet order.' : 'Choose a magnet for the next move.';
    ui();
  }
  draw(alpha); schedule();
}
function cancelGesture() {
  const active = gesture;
  gesture = null; hover = null;
  if (active?.element.hasPointerCapture?.(active.id)) active.element.releasePointerCapture(active.id);
}
function interactive() { return !disposed && board && !error && !paused && !document.hidden && phase === 'playing'; }
function select(color) {
  if (!interactive() || !state.magnets.includes(color)) return;
  selected = color; notice = 'Place a magnet on an empty tile.'; ui(); draw();
}
function submit(action) {
  if (!interactive()) return { accepted: false, reason: 'locked' };
  const before = state;
  const resolution = applyMagnet(before, action);
  if (!resolution.accepted) { notice = 'This tile is occupied. Choose an empty tile.'; ui(); return resolution; }
  state = resolution.state;
  timeline = makeTransferTimeline(before, resolution, reduced);
  elapsed = 0; previousElapsed = 0; phase = 'resolving';
  keyboardCell = null; cancelGesture(); cancelFrame(); ui(); draw(); schedule();
  return resolution;
}
function place(cell) { if (cell && selected) return submit({ type: 'placeMagnet', color: selected, cell }); }
function toolDown(event, color) {
  if (!interactive() || gesture || !event.isPrimary || event.button !== 0) return;
  select(color);
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, tool: true, element: event.currentTarget };
  event.currentTarget.setPointerCapture(event.pointerId);
}
function boardDown(event) {
  if (!interactive() || gesture || !event.isPrimary || event.button !== 0) return;
  keyboardCell = null;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, tool: false, element: canvas };
  canvas.setPointerCapture(event.pointerId);
  hover = board.pick(event.clientX, event.clientY); draw();
}
function pointerMove(event) {
  if (!interactive() || (gesture && gesture.id !== event.pointerId)) return;
  keyboardCell = null; hover = board.pick(event.clientX, event.clientY); draw();
}
function pointerUp(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const active = gesture;
  const cell = board.pick(event.clientX, event.clientY);
  const moved = Math.hypot(event.clientX - active.x, event.clientY - active.y) > 7;
  cancelGesture();
  if (interactive() && cell && (active.tool || !moved)) place(cell);
  draw();
}
function keyboard(event) {
  if (!interactive()) return;
  if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); place(keyboardCell); return; }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
  event.preventDefault();
  const cell = keyboardCell ?? { col: 3, row: 3 };
  const next = { col: cell.col + (event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0),
    row: cell.row + (event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0) };
  keyboardCell = level.cells.find(candidate => candidate.col === next.col && candidate.row === next.row) ?? cell;
  ui(); draw();
}
function setPaused(value) {
  paused = Boolean(value); cancelGesture(); cancelFrame(); ui(); draw();
  if (!paused) schedule();
}
function reset() { loadLevel(levelIndex); }
function loadLevel(index) {
  cancelGesture(); cancelFrame(); timeline = null; elapsed = 0; previousElapsed = 0; keyboardCell = null;
  levelIndex = index; level = prototypeLevels[index]; state = createPrototypeState(level);
  phase = 'playing'; paused = false; selected = state.magnets[0]; notice = 'Choose a magnet and an empty tile.';
  displayedCleared = 0; clearingCount = 0;
  ui(); draw();
}
function hint() {
  if (!interactive()) return;
  let expected = createPrototypeState(level);
  for (const action of level.solution) {
    if (JSON.stringify(expected) === JSON.stringify(state)) {
      selected = action.color; keyboardCell = action.cell;
      notice = `Hint: place the magnet at row ${action.cell.row}, column ${action.cell.col}.`;
      ui(); draw(); return;
    }
    expected = applyMagnet(expected, action).state;
  }
  notice = 'No hint for this position. Try exposing a lower color.'; ui();
}
function resize() {
  cancelGesture(); cancelFrame();
  board?.resize(host.clientWidth, host.clientHeight); draw(); schedule();
}
function initializeBoard() {
  board?.dispose(); board = null; error = null;
  try { board = createThreeBoard(canvas); resize(); }
  catch (failure) { error = failure.message; }
  ui();
}
function snapshot() {
  return { state: structuredClone(state), phase, selected, paused, levelIndex, puzzleId: level.id,
    timeline: timeline ? { duration: timeline.duration, elapsed, activeUnits: timeline.segments.filter(segment => segment.type === 'unitMoved' && segment.start <= elapsed && segment.end > elapsed).length } : null,
    renderer: board?.snapshot() ?? null, canvasCount: root.querySelectorAll('canvas').length,
    gesture: Boolean(gesture), pointerId: gesture?.id ?? null, rafScheduled: raf !== null, error };
}
function dispose() {
  if (disposed) return;
  disposed = true; cancelGesture(); cancelFrame(); timeline = null;
  observer.disconnect(); cleanups.forEach(cleanup => cleanup()); board?.dispose(); board = null;
  render(null, root); if (import.meta.env.DEV) delete window.gameDebug;
}
ui(); initializeBoard();
listen(canvas, 'pointerdown', boardDown);
listen(window, 'pointermove', pointerMove);
listen(window, 'pointerup', pointerUp);
listen(window, 'pointercancel', event => {
  if (!gesture || gesture.id === event.pointerId) { cancelGesture(); draw(); }
});
listen(window, 'lostpointercapture', event => { if (gesture?.id === event.pointerId) { cancelGesture(); draw(); } });
listen(canvas, 'pointerleave', () => { if (!gesture) { hover = null; draw(); } });
listen(window, 'resize', resize);
listen(window, 'blur', () => setPaused(true));
listen(document, 'visibilitychange', () => { if (document.hidden) setPaused(true); });
listen(canvas, 'webglcontextlost', event => { event.preventDefault(); setPaused(true); error = 'WebGL context lost'; ui(); });
listen(canvas, 'webglcontextrestored', initializeBoard);
const observer = new ResizeObserver(resize); observer.observe(host);
if (import.meta.env.DEV) window.gameDebug = { snapshot, reset, setPaused, loadLevel,
  playTestAction: submit, screenPosition: cell => board.screenPosition(cell), getLevel: () => structuredClone(level),
  setReducedMotion: value => { reduced = Boolean(value); ui(); }, dispose,
  legalCells: () => state.cells.filter(cell => canPlaceMagnet(state, cell)).map(cell => cellId(cell)) };
if (import.meta.hot) import.meta.hot.dispose(dispose);
