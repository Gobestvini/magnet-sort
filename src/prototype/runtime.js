import './prototype.css';
import { h, render } from 'preact';
import { createStepper } from '../loop.js';
import { cellId } from '../game/hex.js';
import { canPlaceMagnet } from './model.js';
import { V4_CELLS } from './model-v4.js';
import { previewMagnetInfluence } from './magnet-influence.js';
import { previewBorderRings } from './border-preview.js';
import { v4Levels as prototypeLevels } from './levels-v4.js';
import { makeTransferTimeline } from './motion.js';
import { createThreeBoard } from './board.js';
import { loadBoardTextures, art } from './assets.js';
import { createMagnetDrag, stepMagnetDrag, dragSettled } from './drag.js';
import { PrototypeApp } from './App.js';
import { createCollectionView } from './collection.js';
import { tutorialPlacement } from './tutorial-guide.js';
import { createAudioSettings } from './audio-settings.js';
import { createPrototypeAudio } from './audio.js';
import { createV4Session } from './session.js';
import { PROGRESS_V4_KEY } from './progress-v4.js';
import { displayedForecast } from './spawn-forecast.js';
import { findV4Hint, hintText } from './hint-v4.js';

const root = document.querySelector('#ui-root');
// Preact mounts into an empty host; the static boot message belongs to HTML only.
root.replaceChildren();
const stepper = createStepper();
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function newSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
const urlSeed = new URLSearchParams(location.search).get('seed');
const fixedSeed = urlSeed !== null && /^\d+$/.test(urlSeed) && Number(urlSeed)<=0xffffffff ? Number(urlSeed) : null;
let experiment = null;
if (import.meta.env.DEV) {
  try { experiment = window.parent.__magnetPaceExperiment ?? null; } catch { /* Cross-origin dev embeds have no experiment. */ }
}
const session = createV4Session({ newSeed, fixedSeed: experiment ? fixedSeed ?? 0 : fixedSeed,
  rules: experiment?.rules, initialLevelIndex: experiment?.levelIndex ?? 0 });
let state = session.state, runSeed = state.seed;
let levelIndex = prototypeLevels.findIndex(candidate => candidate.id === state.puzzleId), level = prototypeLevels[levelIndex];
let boardLevel = { ...level, cells: V4_CELLS };
let runId = 1;
let userPaused = false, platformPaused = false;
let windowFocused = document.hasFocus();
const audioPreferences = createAudioSettings();
let audioSettings = audioPreferences.get();
const audio = createPrototypeAudio({ settings: audioSettings, debug: import.meta.env.DEV });
audio.beginRun(runId);
let selected = state.terminal ? null : state.magnets[0], phase = state.terminal ?? 'playing', paused = false, notice = `Collect ${state.goal} pieces. Place a magnet on an empty tile.`;
let displayedCleared = state.cleared;
const collection = createCollectionView();
let collectionLayer = null, counterNode = null, progressNode = null;
let displayedMagnets = state.magnets.join(',');
let displayedQueueTurn = state.turn;
let displayedForecastKey = '';
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
let tutorialChoice = {state:null,color:null,cell:null};
let hintChoice = null, hintMessage = false, hintCache = {state:null,value:null};
function clearHint() {
  hintChoice = null;
  if (hintMessage) { notice = 'Choose a magnet and an empty tile.'; keyboardCell = null; }
  hintMessage = false;
}
function getHintTarget() { return hintChoice && board ? { ...board.screenPosition(hintChoice.cell), size: board.magnetScreenSize() } : null; }
function getTutorialTarget() {
  if (!board || levelIndex !== 0 || state.turn !== 0) return null;
  if (tutorialChoice.state !== state || tutorialChoice.color !== selected)
    tutorialChoice = {state,color:selected,cell:tutorialPlacement(state,selected)};
  return tutorialChoice.cell ? {...board.screenPosition(tutorialChoice.cell),cell:tutorialChoice.cell,size:board.magnetScreenSize()} : null;
}
function listen(target, name, handler, options) {
  target.addEventListener(name, handler, options);
  cleanups.push(() => target.removeEventListener(name, handler, options));
}
function syncAudio() {
  audio.setLifecycle({ paused: paused || loading || Boolean(error), blocked: platformPaused || document.hidden || !windowFocused || root.inert });
}
function audioGesture(event) {
  if (!event.isTrusted || (event.type === 'keydown' && (event.repeat || event.ctrlKey || event.metaKey || event.altKey))) return;
  // An iframe receives pointerdown before its default focus action. Trusted input
  // inside the game is already an explicit return; the user pause still applies.
  if (!document.hidden && (event.type === 'pointerdown' || event.type === 'click')) windowFocused = true;
  syncAudio(); void audio.unlockFromGesture();
}
function changeAudio(patch, event) {
  audioSettings = audioPreferences.update(patch);
  audio.setSettings(audioSettings);
  if (event?.isTrusted) { syncAudio(); void audio.unlockFromGesture(); }
  if ('sfxEnabled' in patch && patch.sfxEnabled) audio.playUi();
  ui();
}
function uiAction(action) { action(); audio.playUi(); }
function ui() {
  if (disposed) return;
  const magnets = timeline && elapsed < timeline.queueStart ? timeline.before.magnets : state.magnets;
  const queueTurn=timeline && elapsed < timeline.queueStart ? timeline.before.turn : state.turn;
  render(h(PrototypeApp, { level, levelIndex, runId, totalLevels: prototypeLevels.length, state: { ...state, magnetRadii:timeline&&elapsed<timeline.queueStart?timeline.before.magnetRadii:state.magnetRadii, magnets, queueTurn, cleared: displayedCleared }, phase, selected, paused, notice, reduced,
    canvasRef, hostRef, dragRef, collectionRef, counterRef, progressRef, keyboardCell, error, loading, loadingProgress,
    getTutorialTarget, hintChoice, getHintTarget, audioSettings, onAudioChange: changeAudio, saveStatus: session.status(), canUndo: canUndo(), onUndo: () => uiAction(undo),
    spawnForecast: displayedForecast(state, timeline, elapsed, experiment?.rules),
    onFreshSave: () => uiAction(() => { session.recoverSave(); ui(); }),
    onReloadSave: () => location.reload(),
    onSelect: select, onToolDown: toolDown, onPause: () => uiAction(() => setPaused(!userPaused)), onReset: () => uiAction(reset),
    onNext: () => uiAction(() => loadLevel((levelIndex + 1) % prototypeLevels.length)), onHint: hint,
    onReduced: event => { reduced = event.currentTarget.checked; ui(); }, onKeyboard: keyboard,
    onRetryRenderer: () => uiAction(initializeBoard) }), root);
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
  const forecastKey = JSON.stringify(displayedForecast(state, timeline, time, experiment?.rules));
  if (forecastKey !== displayedForecastKey) { displayedForecastKey = forecastKey; ui(); }
  if (timeline) audio.advanceTimeline(time);
  const previewCell=keyboardCell??hover;
  const previewKey=!paused&&phase==='playing'&&selected&&previewCell?cellId(previewCell)+':'+selected:null;
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
    audio.advanceTimeline(timeline.duration);
    timeline = null; phase = state.terminal ?? 'playing';
    audio.playResult(state.terminal);
    selected = null;
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
  if (color !== selected) clearHint();
  audio.playGame('select');
  selected = color; if (!hintMessage) notice = 'Place a magnet on an empty tile.'; ui(); draw(); schedule();
}
function submit(action) {
  if (!interactive()) return { accepted: false, reason: 'locked' };
  const before = state;
  const resolution = session.submit(action);
  if (!resolution.accepted) { audio.playGame('reject'); notice = 'This tile is occupied. Choose an empty tile.'; ui(); return resolution; }
  clearHint();
  state = resolution.state;
  timeline = makeTransferTimeline(before, resolution, reduced);
  audio.beginTimeline(timeline, state.turn); audio.playGame('place');
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
  if (!interactive() || !selected || gesture || !event.isPrimary || event.button !== 0) return;
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
  else if (interactive() && cell) { audio.playGame('reject'); notice = 'This tile is occupied. Choose an empty tile.'; ui(); }
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
  userPaused = Boolean(value); updatePause();
}
export function setPlatformPaused(value) { platformPaused = Boolean(value); updatePause(); }
function updatePause() {
  paused = userPaused || platformPaused; clearHint(); syncAudio(); cancelGesture(); cancelFrame(); ui(); draw();
  if (!paused) schedule();
}
function reset() { loadLevel(levelIndex, runSeed); }
function canUndo() {
  return !disposed && board && !loading && !error && !paused && !document.hidden && !timeline &&
    (phase === 'playing' || phase === 'lost') && session.canUndo;
}
function clearPresentation() {
  clearHint();
  runId++;
  cancelGesture(); cancelFrame(); timeline = null; elapsed = 0; previousElapsed = 0;
  collection.clear();
  displayedCleared = state.cleared; displayedMagnets = state.magnets.join(','); displayedQueueTurn = state.turn; displayedForecastKey = '';
  audio.beginRun(runId); syncAudio();
}
function undo() {
  if (root.inert || !canUndo()) return { accepted: false, reason: 'locked' };
  const result = session.undo();
  if (!result.accepted) return result;
  state = result.state; phase = 'playing'; selected = null;
  notice = 'Last move undone. Choose a magnet.';
  clearPresentation(); ui(); draw();
  canvas?.focus({ preventScroll: true });
  return result;
}
function loadLevel(index, seed = fixedSeed ?? newSeed()) {
  if(!Number.isInteger(index)||!prototypeLevels[index])throw new Error('Invalid level index');
  state = session.start(index, seed);
  levelIndex = index; level = prototypeLevels[index]; runSeed=state.seed;
  boardLevel = { ...level, cells: V4_CELLS };
  phase = 'playing'; userPaused = false; paused = platformPaused; selected = state.magnets[0]; notice = 'Choose a magnet and an empty tile.';
  clearPresentation();
  ui(); draw();
}
function hint() {
  if (!interactive()) return;
  cancelGesture(); cancelFrame();
  if (hintCache.state !== state) hintCache = {state,value:findV4Hint(state)};
  hintChoice = hintCache.value;
  hintMessage = true;
  if (hintChoice) { selected = hintChoice.color; keyboardCell = { ...hintChoice.cell }; session.markAssisted(); }
  notice = hintText(hintChoice, displayedForecast(state, null, 0, experiment?.rules));
  ui(); draw(); schedule(); audio.playUi();
}
function resize() {
  // Layout can change when Hint replaces the first-move tutorial. Cancelling
  // a pointer drag must not discard the independently selected keyboard tile.
  const cursor = keyboardCell;
  cancelGesture(); cancelFrame();
  keyboardCell = cursor;
  board?.resize(host.clientWidth, host.clientHeight); draw(); schedule();
  ui();
}
async function initializeBoard() {
  clearHint();
  const generation = ++boardGeneration;
  cancelGesture(); cancelFrame(); loading = true; loadingProgress = 0;
  syncAudio();
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
  syncAudio();
  ui();
  return !error;
}
function snapshot() {
  return { state: structuredClone(state), phase, selected, paused, levelIndex, puzzleId: level.id,
    timeline: timeline ? { duration: timeline.duration, elapsed, activeUnits: timeline.segments.filter(segment => segment.type === 'unitMoved' && segment.start <= elapsed && segment.end > elapsed).length } : null,
    renderer: board?.snapshot() ?? null, canvasCount: root.querySelectorAll('canvas').length,
    displayedCleared, hint: hintChoice ? structuredClone(hintChoice) : null, collection: collection.snapshot(), audio: audio.snapshot(), saveStatus: session.status(), attempt: session.attempt,
    drag: drag ? { x: drag.x, y: drag.y, targetX: drag.targetX, targetY: drag.targetY, size:drag.size, targetSize:drag.targetSize, homeSize:drag.homeSize, angle: drag.angle, released: drag.released } : null,
    gesture: Boolean(gesture), pointerId: gesture?.id ?? null, rafScheduled: raf !== null, error, loading };
}
export function dispose() {
  if (disposed) return;
  disposed = true; boardGeneration++; cancelGesture(); cancelFrame(); timeline = null;
  clearHint();
  audio.dispose();
  collection.dispose(); session.dispose(); observer.disconnect(); cleanups.forEach(cleanup => cleanup()); board?.dispose(); board = null;
  render(null, root); if (import.meta.env.DEV) delete window.gameDebug;
}
ui();
export function startRuntime(onProgress = () => {}) { startupProgress = onProgress; return initializeBoard(); }
listen(root, 'pointerdown', audioGesture, { capture: true });
listen(root, 'click', audioGesture, { capture: true });
listen(root, 'keydown', audioGesture, { capture: true });
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
listen(window, 'blur', () => { windowFocused = false; setPaused(true); });
listen(window, 'focus', () => { windowFocused = true; syncAudio(); });
listen(window, 'storage', event => {
  if (event.key === PROGRESS_V4_KEY || event.key === null) { session.checkConflict(); ui(); }
});
listen(document, 'visibilitychange', () => { if (document.hidden) setPaused(true); else syncAudio(); });
listen(canvas, 'webglcontextlost', event => { event.preventDefault(); setPaused(true); error = 'WebGL context lost'; ui(); });
listen(canvas, 'webglcontextrestored', initializeBoard);
const observer = new ResizeObserver(resize); observer.observe(host);
if (import.meta.env.DEV) window.gameDebug = { snapshot, reset, setPaused, setPlatformPaused, loadLevel,
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
