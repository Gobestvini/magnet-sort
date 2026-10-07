import { Container, Graphics } from 'pixi.js';
import { createSession } from './game/session.js';
import { createBoardRenderer } from './render/board.js';
import { createBoardLayout } from './render/layout.js';
import { createResolutionPlayer } from './render/resolution-player.js';

// The scene owns its nodes; the application owns the stage and renderer.
export function createScene(stage, { initialPuzzleId, campaignPuzzleId, challengePuzzleId, ftuePuzzleId, skipTutorial = false, reducedMotion = () => false } = {}) {
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let deviceResolution = 1;
  let disposed = false;
  const session = createSession({ ...(initialPuzzleId ? { initialPuzzleId } : {}), ...(campaignPuzzleId ? { campaignPuzzleId } : {}), ...(challengePuzzleId ? { challengePuzzleId } : {}), ...(ftuePuzzleId ? { ftuePuzzleId } : {}), skipTutorial });
  const resolution = createResolutionPlayer();
  let placementFeedback = null;
  const level = session.getLevel();
  const state = session.getState();
  let interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null };
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
        const snapshot = session.snapshot();
      const animation = resolution.snapshot();
        board.render(currentLevel, currentState, layout, { ...interaction, animation, placementFeedback, tutorialHint: snapshot.tutorial.hint });
    }
  }

  return {
    update(dt) {
      if (disposed) return false;
      elapsed += dt;
      session.advanceActiveTime(dt);
      const hintActive = session.snapshot().tutorial.hint?.active ?? false;
      const previousPhase = session.snapshot().phase;
      const animation = resolution.snapshot();
      if (animation.active) resolution.update(dt);
      if (placementFeedback) {
        placementFeedback = { ...placementFeedback, progress: Math.min(1, placementFeedback.progress + dt / placementFeedback.duration) };
        if (placementFeedback.progress >= 1) placementFeedback = null;
      }
      if (!resolution.snapshot().active && !placementFeedback && session.snapshot().phase === 'resolving') session.finishResolution();
      if (animation.active || placementFeedback || hintActive || session.snapshot().tutorial.hint?.active) draw();
      return session.snapshot().phase !== previousPhase;
    },
    resize(nextWidth, nextHeight, nextResolution = 1) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      deviceResolution = nextResolution;
      draw();
    },
    render(renderer) { if (!disposed) renderer.render(); },
    reset() { elapsed = 0; resolution.cancel(); placementFeedback = null; session.reset(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); },
    retry() { elapsed = 0; resolution.cancel(); placementFeedback = null; session.retry(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); },
    nextPuzzle() { elapsed = 0; resolution.cancel(); placementFeedback = null; const advanced = session.nextPuzzle(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); return advanced; },
    skipTutorial() { elapsed = 0; resolution.cancel(); placementFeedback = null; const skipped = session.skipTutorial(); if (skipped) { interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); } return skipped; },
    startFromProgress(target) { elapsed = 0; resolution.cancel(); placementFeedback = null; const started = session.startFromProgress(target); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); return started; },
    startChallenge(puzzleId) { elapsed = 0; resolution.cancel(); placementFeedback = null; const started = session.startChallenge(puzzleId); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); return started; },
    startDaily(dailyId, puzzleId) { elapsed = 0; resolution.cancel(); placementFeedback = null; const started = session.startDaily(dailyId, puzzleId); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); return started; },
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
    undo() {
      elapsed = 0;
      resolution.cancel();
      placementFeedback = null;
      const result = session.undo();
      if (result.accepted) {
        interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null };
        draw();
      }
      return result;
    },
    requestHint() { const hint = session.requestHint(); draw(); return hint; },
    applyHint() {
      const before = session.getState();
      const result = session.applyHint();
      if (result.accepted) {
        resolution.start(before, result.events, { reducedMotion: Boolean(reducedMotion()) });
        placementFeedback = { type: 'placed-magnet', cell: { ...result.events[0].cell }, color: result.events[0].color, progress: 0, duration: 0.16 };
        interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null };
        draw();
      }
      return result;
    },
    requestExtraMove() { const result = session.requestExtraMove(); if (result.granted) draw(); return result; },
    loadTestLevel(testLevel) { elapsed = 0; resolution.cancel(); placementFeedback = null; session.loadTestLevel(testLevel); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null, invalidReason: null }; draw(); },
    setInteraction(next) {
      interaction = {
        selectedColor: next.selectedColor ?? null,
        previewCell: next.previewCell ? { ...next.previewCell } : null,
        pointerPoint: next.pointerPoint ? { ...next.pointerPoint } : null,
        dragging: Boolean(next.dragging),
        action: next.action ? { ...next.action, cell: { ...next.action.cell } } : null,
        invalidReason: next.invalidReason ?? null,
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
          invalidReason: interaction.invalidReason,
        },
        animation: resolution.snapshot(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resolution.cancel();
      session.dispose();
      placementFeedback = null;
      stage.removeChild(root);
      board.dispose();
      root.destroy({ children: true });
    },
  };
}
