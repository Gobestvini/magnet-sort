import { Container, Graphics } from 'pixi.js';
import { loadPrototypeLevel } from './game/levels.js';
import { createBoardRenderer } from './render/board.js';
import { createBoardLayout } from './render/layout.js';

// The scene owns its nodes; the application owns the stage and renderer.
export function createScene(stage) {
  let elapsed = 0;
  let width = 1;
  let height = 1;
  let resolution = 1;
  let disposed = false;
  const level = loadPrototypeLevel('prototype-03-blocker');
  let state = initialState();
  let interaction = { selectedColor: null, previewCell: null, action: null };
  let layout = createBoardLayout(width, height, resolution);
  const root = new Container();
  const backdrop = new Graphics();
  root.addChild(backdrop);
  const board = createBoardRenderer(root);
  stage.addChild(root);

  function initialState() {
    return { tokens: level.tokens.map((token) => ({ ...token, cell: { ...token.cell } })) };
  }

  function draw() {
    if (disposed) return;
    backdrop.clear().rect(0, 0, width, height).fill({ color: 0xfffaf2 });
    layout = createBoardLayout(width, height, resolution);
    board.render(level, state, layout, interaction);
  }

  return {
    update(dt) { if (!disposed) elapsed += dt; },
    resize(nextWidth, nextHeight, nextResolution = 1) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      resolution = nextResolution;
      draw();
    },
    render(renderer) { if (!disposed) renderer.render(); },
    reset() { elapsed = 0; state = initialState(); interaction = { selectedColor: null, previewCell: null, action: null }; draw(); },
    setInteraction(next) {
      interaction = {
        selectedColor: next.selectedColor ?? null,
        previewCell: next.previewCell ? { ...next.previewCell } : null,
        action: next.action ? { ...next.action, cell: { ...next.action.cell } } : null,
      };
      draw();
    },
    getLevel() { return level; },
    getState() { return state; },
    getLayout() { return layout; },
    snapshot() {
      return {
        elapsed,
        board: { rows: level.geometry.rows, cols: level.geometry.cols, renderedCells: 49, tokens: state.tokens.length, blockers: level.blockedCells.length },
        layout: { width: layout.width, height: layout.height, radius: layout.radius, originX: layout.originX, originY: layout.originY },
        interaction: {
          selectedColor: interaction.selectedColor,
          previewCell: interaction.previewCell ? { ...interaction.previewCell } : null,
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
