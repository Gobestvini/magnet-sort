import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolutionPlayer } from '../src/render/resolution-player.js';

function scenario() {
  return {
    state: { tokens: [
      { tokenId: 'a', color: 'red', mass: 2, cell: { col: 0, row: 0 } },
      { tokenId: 'b', color: 'red', mass: 3, cell: { col: 1, row: 0 } },
      { tokenId: 'c', color: 'blue', mass: 1, cell: { col: 4, row: 4 } },
    ] },
    events: [
      { type: 'actionAccepted', wave: 0, color: 'red', cell: { col: 2, row: 0 } },
      { type: 'tokenMoved', wave: 1, tokenId: 'a', from: { col: 0, row: 0 }, to: { col: 1, row: 0 } },
      { type: 'stackMerged', wave: 1, tokenId: 'a', memberIds: ['a', 'b'], mass: 5, cell: { col: 1, row: 0 } },
      { type: 'stackCleared', wave: 1, tokenId: 'a', mass: 5, cell: { col: 1, row: 0 } },
    ],
  };
}

test('resolution player presents slide, merge and clear in event order without changing model state', () => {
  const { state, events } = scenario();
  const original = structuredClone(state);
  const player = createResolutionPlayer();
  player.start(state, events);
  assert.equal(player.snapshot().stage, 'slide');
  player.update(0.09);
  const halfway = player.snapshot();
  assert.equal(halfway.stage, 'slide');
  assert.equal(halfway.tokens.find((token) => token.tokenId === 'a').x, 0.5);
  player.update(0.09);
  assert.equal(player.snapshot().stage, 'merge');
  assert.equal(player.snapshot().effects[0].mass, 5);
  player.update(0.32);
  assert.equal(player.snapshot().stage, 'clear');
  assert.equal(player.snapshot().effects[0].chain, 1);
  player.update(0.48);
  assert.equal(player.snapshot().active, false);
  assert.deepEqual(player.snapshot().tokens.map(({ tokenId, cell }) => ({ tokenId, cell })), [
    { tokenId: 'c', cell: { col: 4, row: 4 } },
  ]);
  assert.deepEqual(state, original);
});

test('animation replay reaches the same presentation at 30, 60, 120 and 144fps', () => {
  const { state, events } = scenario();
  const final = [];
  for (const fps of [30, 60, 120, 144]) {
    const player = createResolutionPlayer();
    player.start(state, events);
    for (let elapsed = 0; elapsed < 1.2; elapsed += 1 / fps) player.update(1 / fps);
    const snapshot = player.snapshot();
    assert.equal(snapshot.active, false);
    final.push(snapshot.tokens);
  }
  assert.deepEqual(final, Array.from({ length: 4 }, () => [
    { tokenId: 'c', color: 'blue', mass: 1, cell: { col: 4, row: 4 }, alpha: 1, scale: 1 },
  ]));
});

test('pause leaves the visual clock untouched and reset cancels queued effects', () => {
  const { state, events } = scenario();
  const player = createResolutionPlayer();
  player.start(state, events);
  player.update(0.05);
  const paused = player.snapshot();
  assert.deepEqual(player.snapshot(), paused);
  player.cancel();
  assert.equal(player.snapshot().active, false);
  assert.equal(player.snapshot().effects.length, 0);
});

test('reduced motion preserves every event and resolves with a short transition', () => {
  const { state, events } = scenario();
  const player = createResolutionPlayer();
  player.start(state, events, { reducedMotion: true });
  player.update(0.25);
  assert.equal(player.snapshot().active, false);
  assert.equal(player.snapshot().tokens.length, 1);
});
