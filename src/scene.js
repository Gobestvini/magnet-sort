import { Container, Graphics } from 'pixi.js';
import { createSession } from './game/session.js';
import { createBoardRenderer } from './render/board.js';
import { createBoardLayout } from './render/layout.js';

// The scene owns its nodes; the application owns the stage and renderer.
export function createScene(stage, { initialPuzzleId } = {}) {
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let resolution = 1;
  let disposed = false;
  const session = createSession({ ...(initialPuzzleId ? { initialPuzzleId } : {}) });
  const level = session.getLevel();
  const state = session.getState();
  let interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null };
  let layout = createBoardLayout(width, height, resolution);
  const root = new Container();
  const backdrop = new Graphics();
  root.addChild(backdrop);
  const board = createBoardRenderer(root);
  stage.addChild(root);

  function draw() {
    if (disposed) return;
    backdrop.clear().rect(0, 0, width, height).fill({ color: 0xfffaf2 });
    layout = createBoardLayout(width, height, resolution);
    const currentLevel = session.getLevel();
    const currentState = session.getState();
    if (currentLevel && currentState) board.render(currentLevel, currentState, layout, interaction);
  }

  return {
    update(dt) {
      if (disposed) return false;
      elapsed += dt;
      const previousPhase = session.snapshot().phase;
      session.update(dt);
      return session.snapshot().phase !== previousPhase;
    },
    resize(nextWidth, nextHeight, nextResolution = 1) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      resolution = nextResolution;
      draw();
    },
    render(renderer) { if (!disposed) renderer.render(); },
    reset() { elapsed = 0; session.reset(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    retry() { elapsed = 0; session.retry(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    nextPuzzle() { elapsed = 0; session.nextPuzzle(); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
    submitAction(action) {
      const result = session.dispatch(action);
      if (result.accepted) draw();
      return result;
    },
    loadTestLevel(testLevel) { elapsed = 0; session.loadTestLevel(testLevel); interaction = { selectedColor: null, previewCell: null, pointerPoint: null, dragging: false, action: null }; draw(); },
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
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stage.removeChild(root);
      board.dispose();
      root.destroy({ children: true });
    },
  };
}
