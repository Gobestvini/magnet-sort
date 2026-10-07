import test from 'node:test';
import assert from 'node:assert/strict';
import { Container } from 'pixi.js';
import { loadPrototypeLevel } from '../src/game/levels.js';
import { createBoardRenderer } from '../src/render/board.js';
import { createBoardLayout } from '../src/render/layout.js';

test('board rendering leaves the LevelDefinition and game state unchanged', () => {
  const level = loadPrototypeLevel('prototype-03-blocker');
  const state = { tokens: level.tokens.map((token) => ({ ...token, cell: { ...token.cell } })) };
  const before = JSON.stringify({ level, state });
  const root = new Container();
  const renderer = createBoardRenderer(root);
  renderer.render(level, state, createBoardLayout(390, 430, 3));
  assert.equal(JSON.stringify({ level, state }), before);
  renderer.dispose();
  root.destroy({ children: true });
});
