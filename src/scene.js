import { Container, Graphics } from 'pixi.js';
import { createSession } from './game/session.js';
import { createBoardRenderer } from './render/board.js';
import { createBoardLayout } from './render/layout.js';
import { createResolutionPlayer } from './render/resolution-player.js';

// The scene owns its nodes; the application owns the stage and renderer.
export function createScene(stage, { initialPuzzleId, reducedMotion = () => false } = {}) {
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let deviceResolution = 1;
  let disposed = false;
  const session = createSession({ ...(initialPuzzleId ? { initialPuzzleId } : {}) });
  const resolution = createResolutionPlayer();
  let placementFeedback = null;
  const level = session.getLevel();
  const state = session.getState();
  let interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null };
  let layout = createBoardLayout(width, height, deviceResolution);
  const root = new Container();
  const backdrop = new Graphics();
  root.addChild(backdrop);
  const board = createBoardRenderer(root);
  stage.addChild(root);

  function draw() {
    if (disposed) return;
    backdrop.clear().rect(0, 0, width, height).fill({ color: 0xfffaf2 });
    layout = createBoardLayout(width, height, deviceResolution);
    const currentLevel = session.getLevel();
    const currentState = session.getState();
    if (currentLevel && currentState) {
      const animation = resolution.snapshot();
      board.render(currentLevel, currentState, layout, { ...interaction, animation, placementFeedback });
    }
  }

  return {
    update(dt) {
      if (disposed) return false;
      elapsed += dt;
      session.advanceActiveTime(dt);
      const previousPhase = session.snapshot().phase;
      const animation = resolution.snapshot();
      if (animation.active) resolution.update(dt);
      if (placementFeedback) {
        placementFeedback = { ...placementFeedback, progress: Math.min(1, placementFeedback.progress + dt / placementFeedback.duration) };
        if (placementFeedback.progress >= 1) placementFeedback = null;
      }
      if (!resolution.snapshot().active && !placementFeedback && session.snapshot().phase === 'resolving') session.finishResolution();
      if (animation.active || placementFeedback) draw();
      return session.snapshot().phase !== previousPhase;
    },
    resize(nextWidth, nextHeight, nextResolution = 1) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      deviceResolution = nextResolution;
      draw();
    },
    render(renderer) { if (!disposed) renderer.render(); },
    reset() { elapsed = 0; resolution.cancel(); placementFeedback = null; session.reset(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    retry() { elapsed = 0; resolution.cancel(); placementFeedback = null; session.retry(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    nextPuzzle() { elapsed = 0; resolution.cancel(); placementFeedback = null; session.nextPuzzle(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    submitAction(action) {
      const before = session.getState();
      const result = session.dispatch(action);
      if (result.accepted) {
        resolution.start(before, result.events, { reducedMotion: Boolean(reducedMotion()) });
        placementFeedback = { type: 'placed-magnet', cell: { ...action.cell }, color: action.color, progress: 0, duration: 0.16 };
        draw();
      }
      return result;
    },
    loadTestLevel(testLevel) { elapsed = 0; resolution.cancel(); placementFeedback = null; session.loadTestLevel(testLevel); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    setInteraction(next) {
      interaction = {
        selectedColor: next.selectedColor ?? null,
        previewCell: next.previewCell ? { ...next.previewCell } : null,
        pointerPoint: next.pointerPoint ? { ...next.pointerPoint } : null,
        dragging: Boolean(next.dragging),
        action: next.action ? { ...next.action, cell: { ...next.action.cell } } : null,
      };
      draw();
    },
    getLevel() { return session.getLevel() ?? level; },
    getState() { return session.getState() ?? state; },
    getSession() { return session.snapshot(); },
    getLayout() { return layout; },
    snapshot() {
      return {
        elapsed,
        board: { rows: level.geometry.rows, cols: level.geometry.cols, renderedCells: 49, tokens: session.getState()?.tokens.length ?? 0, blockers: session.getLevel()?.blockedCells.length ?? 0 },
        session: session.snapshot(),
        layout: { width: layout.width, height: layout.height, radius: layout.radius, originX: layout.originX, originY: layout.originY },
        interaction: {
          selectedColor: interaction.selectedColor,
          previewCell: interaction.previewCell ? { ...interaction.previewCell } : null,
          pointerPoint: interaction.pointerPoint ? { ...interaction.pointerPoint } : null,
          dragging: interaction.dragging,
          action: interaction.action ? { ...interaction.action, cell: { ...interaction.action.cell } } : null,
        },
        animation: resolution.snapshot(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resolution.cancel();
      placementFeedback = null;
      stage.removeChild(root);
      board.dispose();
      root.destroy({ children: true });
    },
  };
}
