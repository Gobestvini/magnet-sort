import './style.css';
import { h, render } from 'preact';
import { createStepper } from './loop.js';
import { createInput } from './input.js';
import { createPointerController } from './input/pointer.js';
import { createScene } from './scene.js';
import { createPixiApplication } from './render/application.js';
import { App } from './ui/App.js';

const uiRoot = document.querySelector('#ui-root');
if (!uiRoot) throw new Error('Magnet Sort UI mount point is missing');

let gameHost = null;
let canvasElement = null;
const surfaceRef = (node) => { gameHost = node; };
const canvasRef = (node) => { canvasElement = node; };

const input = createInput();
const stepper = createStepper();
let renderer = null;
let scene = null;
let paused = false;
let previous = null;
let frame = null;
let disposed = false;
let initializing = false;
let initAttempt = 0;
let error = null;
let tickCount = 0;
let observer = null;
let pointer = null;
let reducedMotionOverride = null;

function clearTiming() {
  previous = null;
  stepper.reset();
  input.reset();
}

function cancelFrame() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function scheduleFrame() {
  if (!disposed && renderer && scene && !paused && !document.hidden && frame === null) {
    frame = requestAnimationFrame(tick);
  }
}

function prefersReducedMotion() {
  return reducedMotionOverride ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function currentStatus() {
  if (error) return 'Нужен повторный запуск';
  if (!renderer) return initializing ? 'Загрузка поля…' : 'Готово к запуску';
  if (paused) return 'Пауза';
  const phase = scene?.getSession().phase;
  if (phase === 'resolving') return 'Магнит притягивает фишки…';
  if (phase === 'won') return 'Уровень пройден!';
  if (phase === 'lost') return 'Ходы закончились';
  if (phase === 'error') return 'Не удалось загрузить уровень';
  return 'Готово';
}

function renderUI() {
  if (disposed) return;
  render(h(App, {
    paused,
    ready: Boolean(renderer && scene && !error),
    initializing,
    error,
    session: scene?.getSession(),
    status: currentStatus(),
    interaction: scene?.snapshot().interaction,
    surfaceRef,
    canvasRef,
    onTogglePause: () => setPaused(!paused),
    onReset: reset,
    onRetry: retry,
    onRetryRenderer: initialize,
    onNextPuzzle: nextPuzzle,
    onChooseColor: (color) => pointer?.chooseColor(color),
    onSkipTutorial: skipTutorial,
  }), uiRoot);
}

function renderScene(alpha = 0) {
  if (!renderer || !scene) return;
  scene.render(renderer, renderer.canvas.clientWidth, renderer.canvas.clientHeight, alpha);
}

function resize() {
  clearTiming();
  if (!renderer || !scene) return;
  const width = gameHost.clientWidth;
  const height = gameHost.clientHeight;
  renderer.resize(width, height);
  scene.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
  renderScene(0);
}

function setPaused(value) {
  if (!renderer || !scene) return;
  paused = Boolean(value);
  syncPointerLock();
  clearTiming();
  if (paused) cancelFrame();
  renderUI();
  if (!paused) scheduleFrame();
}

function syncPointerLock() {
  const phase = scene?.getSession().phase;
  pointer?.setLocked(paused || document.hidden || (phase !== undefined && phase !== 'playing'));
}

function reset() {
  if (!scene) return;
  pointer?.cancel();
  scene.reset();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function retry() {
  if (!scene) return;
  pointer?.cancel();
  scene.retry();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function nextPuzzle() {
  if (!scene) return;
  pointer?.cancel();
  scene.nextPuzzle();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function skipTutorial() {
  if (!scene?.skipTutorial()) return;
  pointer?.cancel();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function tick(now) {
  frame = null;
  if (disposed || paused || document.hidden || !scene || !renderer) return;
  const delta = previous === null ? 0 : (now - previous) / 1000;
  previous = now;
  let phaseChanged = false;
  const result = stepper.advance(delta, (dt) => { phaseChanged = scene.update(dt, input) || phaseChanged; });
  tickCount += 1;
  renderScene(result.alpha);
  if (phaseChanged) {
    syncPointerLock();
    renderUI();
  }
  const phase = scene.getSession().phase;
  if (phase === 'won' || phase === 'lost' || phase === 'error') {
    cancelFrame();
    return;
  }
  scheduleFrame();
}

function handleVisibility() {
  pointer?.cancel();
  syncPointerLock();
  clearTiming();
  cancelFrame();
  if (!document.hidden) {
    renderScene(0);
    scheduleFrame();
  }
}

function handleBlur() {
  pointer?.cancel();
  clearTiming();
  if (renderer && scene && !paused) setPaused(true);
}

async function initialize() {
  if (disposed || initializing || renderer) return;
  initializing = true;
  error = null;
  const attempt = ++initAttempt;
  renderUI();
  let candidate;
  try {
    if (!gameHost || !canvasElement) throw new Error('Game surface is not mounted');
    candidate = await createPixiApplication(gameHost, canvasElement);
    if (disposed || attempt !== initAttempt) {
      candidate.destroy();
      return;
    }
    renderer = candidate;
    scene = createScene(renderer.stage, { reducedMotion: prefersReducedMotion });
    pointer = createPointerController(canvasElement, {
      getLayout: () => scene.getLayout(),
      getLevel: () => scene.getLevel(),
      getState: () => scene.getState(),
      onPreview: (interaction) => {
        scene?.setInteraction(interaction);
        renderScene(0);
        renderUI();
      },
      onAction: (action) => {
        const result = scene?.submitAction(action);
        if (result?.accepted) {
          syncPointerLock();
          renderScene(0);
          renderUI();
        }
      },
    });
    pointer.setLocked(paused || document.hidden);
    scene.resize(gameHost.clientWidth, gameHost.clientHeight);
    resize();
    renderUI();
    scheduleFrame();
  } catch {
    if (candidate && renderer === candidate) {
      scene?.dispose();
      scene = null;
      candidate.destroy();
      renderer = null;
    } else if (candidate) {
      candidate.destroy();
    }
    if (!disposed && attempt === initAttempt) {
      error = true;
      renderUI();
    }
  } finally {
    if (attempt === initAttempt) {
      initializing = false;
      renderUI();
    }
  }
}

renderUI();
window.addEventListener('resize', resize);
window.addEventListener('blur', handleBlur);
document.addEventListener('visibilitychange', handleVisibility);
if (typeof ResizeObserver !== 'undefined') {
  observer = new ResizeObserver(resize);
  observer.observe(gameHost);
}

function snapshot() {
  return {
    ...(scene?.snapshot() ?? { elapsed: 0 }),
    puzzleId: scene?.getSession().puzzleId ?? null,
    state: scene?.getSession().state ?? null,
    phase: scene?.getSession().phase ?? 'loading',
    moves: scene?.getSession().movesUsed ?? 0,
    tutorial: scene?.getSession().tutorial ?? null,
    result: scene?.getSession().result ?? null,
    activeTimeMs: scene?.getSession().activeTimeMs ?? 0,
    assistedFlags: scene?.getSession().assistedFlags ?? {},
    paused,
    keys: [...input.keys].sort(),
    rendererReady: Boolean(renderer),
    rafScheduled: frame !== null,
    tickCount,
    canvasCount: gameHost.querySelectorAll('canvas').length,
    pointer: pointer?.snapshot() ?? null,
  };
}

function dispose() {
  if (disposed) return;
  disposed = true;
  initAttempt += 1;
  cancelFrame();
  clearTiming();
  pointer?.dispose();
  pointer = null;
  observer?.disconnect();
  window.removeEventListener('resize', resize);
  window.removeEventListener('blur', handleBlur);
  document.removeEventListener('visibilitychange', handleVisibility);
  input.dispose();
  scene?.dispose();
  renderer?.destroy();
  scene = null;
  renderer = null;
  render(null, uiRoot);
  if (import.meta.env.DEV) delete window.gameDebug;
}

if (import.meta.env.DEV) {
  window.gameDebug = {
    snapshot,
    reset,
    retry,
    nextPuzzle,
    skipTutorial,
    setPaused,
    setReducedMotion(value) { reducedMotionOverride = Boolean(value); },
    loadTestLevel(level) {
      pointer?.cancel();
      scene?.loadTestLevel(level);
      renderUI();
      renderScene(0);
    },
    playTestAction(action) {
      const result = scene?.submitAction(action);
      if (result?.accepted) {
        syncPointerLock();
        renderUI();
        renderScene(0);
      }
      return result;
    },
    dispose,
  };
}
void initialize();

if (import.meta.hot) import.meta.hot.dispose(dispose);
