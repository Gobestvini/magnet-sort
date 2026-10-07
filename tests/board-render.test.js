import test from 'node:test';
import assert from 'node:assert/strict';
import { Container, Texture } from 'pixi.js';
import { loadCampaignLevel, loadPrototypeLevel } from '../src/game/levels.js';
import { createBoardRenderer } from '../src/render/board.js';
import { cellToScreen, createBoardLayout } from '../src/render/layout.js';

test('board rendering leaves the LevelDefinition and game state unchanged', () => {
  const level = loadPrototypeLevel('prototype-03-blocker');
  const state = { tokens: level.tokens.map((token) => ({ ...token, cell: { ...token.cell } })) };
  const before = JSON.stringify({ level, state });
  const root = new Container();
  const renderer = createBoardRenderer(root);
  renderer.render(level, state, createBoardLayout(390, 430, 3));
  const crateLevel = loadCampaignLevel('campaign-36');
  renderer.render(crateLevel, { tokens: crateLevel.tokens }, createBoardLayout(390, 430, 3));
  assert.equal(JSON.stringify({ level, state }), before);
  renderer.dispose();
  root.destroy({ children: true });
});

test('retained token sprites follow staggered screen positions and never own shared textures', () => {
  const level = loadPrototypeLevel('prototype-03-blocker');
  const state = { tokens: level.tokens.map(token => ({ ...token, cell: { ...token.cell } })) };
  const root = new Container();
  const renderer = createBoardRenderer(root, { get: () => Texture.WHITE });
  const layout = createBoardLayout(390, 530, 2);
  renderer.render(level, state, layout);
  const node = root.children[1].children[0];
  const fromCell = { col: 1, row: 2 }, toCell = { col: 2, row: 3 };
  renderer.render(level, state, layout, { animation: {
    active: true, effects: [], magnet: null,
    tokens: [{ ...state.tokens[0], fromCell, toCell, moveProgress: .5 }],
  } });
  assert.equal(root.children[1].children[0], node);
  const from = cellToScreen(fromCell, layout), to = cellToScreen(toCell, layout);
  assert.equal(node.x, (from.x + to.x) / 2);
  assert.equal(node.y, (from.y + to.y) / 2);
  const sharedSource = Texture.WHITE.source;
  renderer.render(level, { tokens: [] }, layout);
  assert.equal(node.destroyed, true);
  assert.equal(Texture.WHITE.source, sharedSource);
  renderer.dispose();
  renderer.dispose();
  assert.equal(root.children.length, 0);
  assert.equal(Texture.WHITE.source, sharedSource);
  root.destroy({ children: true });
});
