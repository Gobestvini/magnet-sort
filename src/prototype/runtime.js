import './prototype.css';
import { h, render } from 'preact';
import { createStepper } from '../loop.js';
import { cellId } from '../game/hex.js';
import { canPlaceMagnet } from './model.js';
import { createV4State, applyV4Magnet, V4_CELLS } from './model-v4.js';
import { previewMagnetInfluence } from './magnet-influence.js';
import { previewBorderRings } from './border-preview.js';
import { v4Levels as prototypeLevels } from './levels-v4.js';
import { makeTransferTimeline } from './motion.js';
import { createThreeBoard } from './board.js';
import { loadBoardTextures, art } from './assets.js';
import { createMagnetDrag, stepMagnetDrag, dragSettled } from './drag.js';
import { PrototypeApp } from './App.js';
import { createCollectionView } from './collection.js';

const root = document.querySelector('#ui-root');
// Preact mounts into an empty host; the static boot message belongs to HTML only.
root.replaceChildren();
const stepper = createStepper();
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function newSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
const urlSeed = new URLSearchParams(location.search).get('seed');
const fixedSeed = urlSeed !== null && /^\d+$/.test(urlSeed) && Number(urlSeed)<=0xffffffff ? Number(urlSeed) : null;
let runSeed = fixedSeed ?? newSeed();
let levelIndex = 0, level = prototypeLevels[0], state = createV4State(level, runSeed);
let boardLevel = { ...level, cells: V4_CELLS };
let runId = 1;
let selected = state.magnets[0], phase = 'playing', paused = false, notice = `Collect ${state.goal} pieces. Place a magnet on an empty tile.`;
let displayedCleared = 0;
const collection = createCollectionView();
let collectionLayer = null, counterNode = null, progressNode = null;
let displayedMagnets = state.magnets.join(',');
let displayedQueueTurn = 0;
const collectionRef = node => { collectionLayer = node; };
const counterRef = node => { counterNode = node; };
const progressRef = node => { progressNode = node; };
let canvas = null, host = null, board = null, timeline = null, elapsed = 0, previousElapsed = 0;
let hover = null, keyboardCell = null, gesture = null, raf = null, previous = null, disposed = false, error = null;
const canvasRef = node => { canvas = node; };
const hostRef = node => { host = node; };
const cleanups = [];
let drag = null, dragNode = null;
const dragRef = node => { dragNode = node; };
let boardGeneration = 0, loading = true, loadingProgress = 0;
let startupProgress = () => {};
function listen(target, name, handler, options) {
  target.addEventListener(name, handler, options);
  cleanups.push(() => target.removeEventListener(name, handler, options));
}
function ui() {
  if (disposed) return;
  const tutorialCell = levelIndex === 0 && state.turn === 0 ? state.cells.find(cell => canPlaceMagnet(state,cell)) : null;
  const target = board && tutorialCell ? board.screenPosition(tutorialCell) : null;
  const rect = host?.getBoundingClientRect();
  const magnets = timeline && elapsed < timeline.queueStart ? timeline.before.magnets : state.magnets;
  const queueTurn=timeline && elapsed < timeline.queueStart ? timeline.before.turn : state.turn;
  render(h(PrototypeApp, { level, levelIndex, runId, totalLevels: prototypeLevels.length, state: { ...state, magnetRadii:timeline&&elapsed<timeline.queueStart?timeline.before.magnetRadii:state.magnetRadii, magnets, queueTurn, cleared: displayedCleared }, phase, selected, paused, notice, reduced,
    canvasRef, hostRef, dragRef, collectionRef, counterRef, progressRef, keyboardCell, error, loading, loadingProgress,
    tutorialTarget: target && rect ? { x: target.x - rect.left, y: target.y - rect.top } : null,
    onSelect: select, onToolDown: toolDown, onPause: () => setPaused(!paused), onReset: reset,
    onNext: () => loadLevel((levelIndex + 1) % prototypeLevels.length), onHint: hint,
    onReduced: event => { reduced = event.currentTarget.checked; ui(); }, onKeyboard: keyboard,
    onRetryRenderer: initializeBoard }), root);
  // Match the former held size (80% of the button, capped at 100px, with 12% lift).
  for (const tool of root.querySelectorAll('.magnet-tool')) {
    tool.querySelector('img').style.width = Math.min(100, tool.getBoundingClientRect().width * .8) * 1.12 + 'px';
  }
}
let influenceCache={state:null,key:null,plan:null};
function draw(alpha = 1) {
  for (const tool of root.querySelectorAll('.magnet-tool')) {
    tool.toggleAttribute('data-dragging', drag?.color === tool.dataset.magnetColor);
  }
  const time = previousElapsed + (elapsed - previousElapsed) * alpha;
  const previewCell=keyboardCell??hover;
  const previewKey=!paused&&phase==='playing'&&previewCell?cellId(previewCell)+':'+selected:null;
  if(influenceCache.state!==state||influenceCache.key!==previewKey)influenceCache={state,key:previewKey,plan:previewKey?previewBorderRings(state,previewCell,selected):null};
  const frame = board?.draw(boardLevel, state, { timeline, time, hover: keyboardCell ?? hover, selected, paused,
    hideMagnet: Boolean(drag), dragging: Boolean(drag && !drag.released), reduced,
    influence: influenceCache.plan,
    hint: null });
  const cleared = frame?.collected ?? state.cleared;
  if (cleared !== displayedCleared) { displayedCleared = cleared; ui(); }
  const magnets = timeline && time < timeline.queueStart ? timeline.before.magnets : state.magnets;
  const queueTurn=timeline && time < timeline.queueStart ? timeline.before.turn : state.turn;
  if (magnets.join(',') !== displayedMagnets || queueTurn!==displayedQueueTurn) { displayedMagnets = magnets.join(','); displayedQueueTurn=queueTurn; ui(); }
  collection.draw(frame, time, board, collectionLayer, progressNode, timeline?.reduced ?? reduced, displayedCleared/state.goal);
  if (dragNode) {
    dragNode.hidden = !drag;
    if (drag) {
      const x = drag.previousX + (drag.x - drag.previousX) * alpha;
      const y = drag.previousY + (drag.y - drag.previousY) * alpha;
      const angle = drag.previousAngle + (drag.angle - drag.previousAngle) * alpha;
      const lift = drag.released ? Math.max(0, 1 - drag.age * 5) : 1;
      dragNode.style.width = (drag.previousSize + (drag.size-drag.previousSize)*alpha) + 'px';
      dragNode.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${angle}deg)`;
      dragNode.style.filter = `drop-shadow(0 ${4 + lift * 12}px ${3 + lift * 5}px #200c6866)`;
      const source = art('magnet-' + drag.color);
      if (dragNode.getAttribute('src') !== source) dragNode.setAttribute('src', source);
    }
  }
}
function schedule() {
  if (raf === null && !disposed && !paused && !document.hidden && board && (timeline || drag || (influenceCache.plan&&!reduced))) raf = requestAnimationFrame(tick);
}
function cancelFrame() {
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null; previous = null; previousElapsed = elapsed; stepper.reset();
}
function tick(now) {
  raf = null;
  const delta = previous === null ? 0 : Math.max(0, (now - previous) / 1000);
  previous = now;
  const { alpha } = stepper.advance(delta, dt => {
    previousElapsed = elapsed; elapsed += dt;
    if (drag) { stepMagnetDrag(drag, dt, reduced); if (dragSettled(drag, reduced)) drag = null; }
  });
  if (timeline && elapsed >= timeline.duration) {
    timeline = null; phase = state.terminal ?? 'playing';
    if(!state.magnets.includes(selected))selected=state.magnets[0];
    notice = state.terminal === 'won' ? 'Goal reached!' : state.terminal === 'lost' ? 'No empty tiles left. Try again.' : 'Choose a magnet for the next move.';
    ui();
  }
  draw(alpha); schedule();
}
function cancelGesture() {
  const active = gesture;
  gesture = null; hover = null; keyboardCell = null;
  drag = null;
  if (active?.element.hasPointerCapture?.(active.id)) active.element.releasePointerCapture(active.id);
}
function interactive() { return !disposed && board && !loading && !root.inert && !error && !paused && !document.hidden && phase === 'playing'; }
function select(color) {
  if (!interactive() || !state.magnets.includes(color)) return;
  selected = color; notice = 'Place a magnet on an empty tile.'; ui(); draw(); schedule();
}
function submit(action) {
  if (!interactive()) return { accepted: false, reason: 'locked' };
  const before = state;
  const resolution = applyV4Magnet(before, action);
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
  const rect = event.currentTarget.querySelector('img').getBoundingClientRect();
  gesture.home = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  drag = createMagnetDrag(gesture.home.x, gesture.home.y, color, rect.width);
  draw(); schedule();
  event.currentTarget.setPointerCapture(event.pointerId);
}
function boardDown(event) {
  if (!interactive() || gesture || !event.isPrimary || event.button !== 0) return;
  drag = null;
  keyboardCell = null;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, tool: false, element: canvas };
  canvas.setPointerCapture(event.pointerId);
  hover = board.pick(event.clientX, event.clientY); draw();
}
function pointerMove(event) {
  if (!interactive() || (gesture && gesture.id !== event.pointerId)) return;
  keyboardCell = null; hover = board.pick(event.clientX, event.clientY);
  if (gesture) {
    gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7;
    if (gesture.moved && !drag) drag = createMagnetDrag(gesture.x, gesture.y, selected, board.magnetScreenSize());
    if (drag && gesture.moved) {
      drag.targetX = event.clientX; drag.targetY = event.clientY - (reduced ? 0 : 32);
      drag.targetSize = hover ? board.magnetScreenSize() : drag.homeSize;
      if (reduced) stepMagnetDrag(drag, 0, true);
      schedule();
    }
  }
  draw(); schedule();
}
function pointerUp(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const active = gesture;
  const cell = board.pick(event.clientX, event.clientY);
  const moved = active.moved || Math.hypot(event.clientX - active.x, event.clientY - active.y) > 7;
  const released = drag;
  const valid = interactive() && cell && canPlaceMagnet(state, cell);
  cancelGesture();
  if (valid) place(cell);
  else if (interactive() && cell) { notice = 'This tile is occupied. Choose an empty tile.'; ui(); }
  if (released && moved && !reduced) {
    const target = valid ? board.magnetScreenPosition(cell) : active.home ?? { x: active.x, y: active.y };
    drag = released; drag.targetX = target.x; drag.targetY = target.y; drag.released = true; drag.age = 0;
    drag.targetSize = valid ? board.magnetScreenSize() : drag.homeSize;
  }
  draw(); schedule();
}
function keyboard(event) {
  if (!interactive()) return;
  if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); place(keyboardCell); return; }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
  event.preventDefault();
  const cell = keyboardCell ?? { col: 3, row: 3 };
  const next = { col: cell.col + (event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0),
    row: cell.row + (event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0) };
  keyboardCell = state.cells.find(candidate => candidate.col === next.col && candidate.row === next.row) ?? cell;
  ui(); draw(); schedule();
}
function setPaused(value) {
  paused = Boolean(value); cancelGesture(); cancelFrame(); ui(); draw();
  if (!paused) schedule();
}
function reset() { loadLevel(levelIndex, runSeed); }
function loadLevel(index, seed = fixedSeed ?? newSeed()) {
  if(!Number.isInteger(index)||!prototypeLevels[index])throw new Error('Invalid level index');
  runId++;
  cancelGesture(); cancelFrame(); timeline = null; elapsed = 0; previousElapsed = 0; keyboardCell = null;
  levelIndex = index; level = prototypeLevels[index]; runSeed=seed; state = createV4State(level, runSeed);
  boardLevel = { ...level, cells: V4_CELLS }; displayedMagnets=state.magnets.join(',');displayedQueueTurn=0;
  phase = 'playing'; paused = false; selected = state.magnets[0]; notice = 'Choose a magnet and an empty tile.';
  displayedCleared = 0; collection.clear();
  ui(); draw();
}
function hint() {
  if (!interactive()) return;
  notice = 'Match exposed colors in the two nearest rings. New stacks appear as you play.'; ui();
}
function resize() {
  cancelGesture(); cancelFrame();
  board?.resize(host.clientWidth, host.clientHeight); draw(); schedule();
  ui();
}
async function initializeBoard() {
  const generation = ++boardGeneration;
  cancelGesture(); cancelFrame(); loading = true; loadingProgress = 0;
  board?.dispose(); board = null; error = null;
  ui();
  let textures;
  try {
    textures = await loadBoardTextures(progress => {
      if (!disposed && generation === boardGeneration) { loadingProgress = progress; startupProgress(progress); ui(); }
    });
    if (disposed || generation !== boardGeneration) {
      Object.values(textures).forEach(texture => texture.dispose()); return;
    }
    board = createThreeBoard(canvas, textures); resize();
  }
  catch (failure) {
    if (textures) Object.values(textures).forEach(texture => texture.dispose());
    if (disposed || generation !== boardGeneration) return;
    error = failure.message;
  }
  loading = false;
  ui();
  return !error;
}
function snapshot() {
  return { state: structuredClone(state), phase, selected, paused, levelIndex, puzzleId: level.id,
    timeline: timeline ? { duration: timeline.duration, elapsed, activeUnits: timeline.segments.filter(segment => segment.type === 'unitMoved' && segment.start <= elapsed && segment.end > elapsed).length } : null,
    renderer: board?.snapshot() ?? null, canvasCount: root.querySelectorAll('canvas').length,
    displayedCleared, collection: collection.snapshot(),
    drag: drag ? { x: drag.x, y: drag.y, targetX: drag.targetX, targetY: drag.targetY, size:drag.size, targetSize:drag.targetSize, homeSize:drag.homeSize, angle: drag.angle, released: drag.released } : null,
    gesture: Boolean(gesture), pointerId: gesture?.id ?? null, rafScheduled: raf !== null, error, loading };
}
export function dispose() {
  if (disposed) return;
  disposed = true; boardGeneration++; cancelGesture(); cancelFrame(); timeline = null;
  collection.dispose(); observer.disconnect(); cleanups.forEach(cleanup => cleanup()); board?.dispose(); board = null;
  render(null, root); if (import.meta.env.DEV) delete window.gameDebug;
}
ui();
export function startRuntime(onProgress = () => {}) { startupProgress = onProgress; return initializeBoard(); }
listen(canvas, 'pointerdown', boardDown);
listen(window, 'pointermove', pointerMove);
listen(window, 'pointerup', pointerUp);
listen(window, 'pointercancel', event => {
  if (!gesture || gesture.id === event.pointerId) { cancelGesture(); draw(); }
});
listen(window, 'lostpointercapture', event => { if (gesture?.id === event.pointerId) { cancelGesture(); draw(); } });
listen(canvas, 'pointerleave', () => { if (!gesture) { hover = null; draw(); } });
listen(window, 'resize', resize);
listen(window, 'scroll', () => draw(), { passive: true });
listen(window, 'blur', () => setPaused(true));
listen(document, 'visibilitychange', () => { if (document.hidden) setPaused(true); });
listen(canvas, 'webglcontextlost', event => { event.preventDefault(); setPaused(true); error = 'WebGL context lost'; ui(); });
listen(canvas, 'webglcontextrestored', initializeBoard);
const observer = new ResizeObserver(resize); observer.observe(host);
if (import.meta.env.DEV) window.gameDebug = { snapshot, reset, setPaused, loadLevel,
  finishTestPresentation:()=>{
    if(!timeline||paused)return;
    elapsed=timeline.duration;previousElapsed=elapsed;
    tick(performance.now());
  },
  inspectPresentation: (before,resolution,time,reducedValue=false) => {
    const inspection=makeTransferTimeline(before,resolution,reducedValue);
    const sample=board.draw(boardLevel,resolution.state,{timeline:inspection,time,reduced:reducedValue});
    collection.draw(sample,time,board,collectionLayer,progressNode,reducedValue,sample.collected/before.goal);
    return {frame:sample,renderer:board.snapshot(),timeline:inspection};
  },
  inspectInfluence:(before,cell,color,time,reducedValue=false)=>{
    board.draw(boardLevel,before,{influence:previewBorderRings(before,cell,color),time,reduced:reducedValue});
    return board.snapshot();
  },
  finishInspection:()=>{collection.clear();draw();},
  inspectBackingLighting:legacy=>board.inspectBackingLighting(legacy),
  playTestAction: submit, screenPosition: cell => board.screenPosition(cell), getLevel: () => structuredClone(level),
  setReducedMotion: value => { reduced = Boolean(value); ui(); draw(); schedule(); }, dispose,
  legalCells: () => state.cells.filter(cell => canPlaceMagnet(state, cell)).map(cell => cellId(cell)) };
if (import.meta.hot) import.meta.hot.dispose(dispose);
