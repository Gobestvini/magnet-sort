import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createV4Rules, createV4State, stacksForMove } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { remainingUnits } from '../src/prototype/model.js';
import { spawnInterval } from '../src/prototype/difficulty.js';
import { V4_CONTENT_VERSION } from '../src/prototype/progress-v4.js';
import {
  DAILY_CATALOG, DAILY_CATALOG_VERSION, DAILY_PRESET_ID, DAILY_CONTENT_VERSION,
  DAILY_GOALS, DAILY_SPAWN_INTERVALS
} from '../src/prototype/daily-catalog-v1.js';
import { generateDailyCatalog } from '../tools/generate-daily-catalog.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('../tools/fixtures/daily-v4-witnesses.json', import.meta.url), 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rules = createV4Rules({ goals: DAILY_GOALS, spawnIntervals: DAILY_SPAWN_INTERVALS });

test('versioned catalog fixes thirty unique daily boards and cannot be mutated in place', () => {
  assert.equal(DAILY_CATALOG_VERSION, 'daily-30-2026-10-25.1');
  assert.equal(DAILY_PRESET_ID, 'short-b-2026-10-25.1');
  assert.equal(DAILY_CONTENT_VERSION, V4_CONTENT_VERSION, 'rules/content changes require a reviewed new daily version');
  assert.equal(DAILY_CATALOG.length, 30);
  assert.equal(new Set(DAILY_CATALOG.map(e => `${e.levelId}/${e.seed}`)).size, 30);
  assert.equal(hash(DAILY_CATALOG), '3e02ff4c6b5b8a5cc3325681215928a02462074a89aaf60f19511b94bebdf06c',
    'published ordering and entries must not change under the same catalog version');
  assert(Object.isFrozen(DAILY_CATALOG));
  for (const entry of DAILY_CATALOG) {
    assert(Object.isFrozen(entry));
    assert.equal(entry.contentVersion, DAILY_CONTENT_VERSION);
    assert.equal(entry.presetId, DAILY_PRESET_ID);
    assert(v4Levels.some(level => level.id === entry.levelId));
    assert.throws(() => { entry.seed++; }, TypeError);
  }
  assert.throws(() => DAILY_CATALOG.reverse(), TypeError);
  assert.throws(() => { DAILY_GOALS[0] = 1000; }, TypeError);
  assert.throws(() => { DAILY_SPAWN_INTERVALS[0] = 3; }, TypeError);
  for (const level of v4Levels.slice(0, 6))
    assert.equal(DAILY_CATALOG.filter(entry => entry.levelId === level.id).length, 5);
});

test('daily B changes goals while preserving campaign opening, spawn cadence and threshold behavior', () => {
  assert.deepEqual(DAILY_GOALS, [40,50,60,70,80,90,100,110,120,130,140,150]);
  assert.deepEqual(DAILY_SPAWN_INTERVALS, [1,1,1,1,1,1,2,2,2,3,3,3]);
  for (const level of v4Levels) {
    const daily = rules.createV4State(level, 0xffffffff), campaign = createV4State(level, 0xffffffff);
    assert.equal(daily.goal, 30 + 10 * level.number);
    assert.equal(campaign.goal, 50 * level.number);
    assert.deepEqual({ ...daily, goal: campaign.goal }, campaign, 'B must not consume different opening RNG or alter layouts');
    assert.equal(rules.spawnInterval(level.number), spawnInterval(level.number));
    for (let moves = 1; moves <= 10 * level.number ** 2 + 3; moves++)
      assert.equal(rules.stacksForMove(moves, level.number), stacksForMove(moves, level.number));
  }
});

test('all thirty fixed witnesses replay to their recorded win and final state without external randomness', () => {
  assert.equal(fixture.catalogVersion, DAILY_CATALOG_VERSION);
  assert.equal(fixture.presetId, DAILY_PRESET_ID);
  assert.equal(fixture.contentVersion, DAILY_CONTENT_VERSION);
  assert.equal(fixture.entries.length, 30);
  const previousRandom = Math.random;
  Math.random = () => { throw Error('Daily replay must own its RNG'); };
  try {
    for (const [index, witness] of fixture.entries.entries()) {
      const entry = DAILY_CATALOG[index], level = v4Levels.find(level => level.id === entry.levelId);
      assert.equal(witness.index, index);
      assert.deepEqual({ levelId: witness.levelId, seed: witness.seed, contentVersion: witness.contentVersion, presetId: witness.presetId }, entry);
      assert.equal(witness.actions.length, witness.moves);
      assert(witness.moves > 0 && witness.moves <= fixture.cutoff);
      let state = rules.createV4State(level, entry.seed);
      for (const action of witness.actions) {
        const before = structuredClone(state), result = rules.applyV4Magnet(state, action);
        assert(result.accepted, `entry ${index} has a rejected action`);
        assert.deepEqual(state, before, 'replay must not mutate its input state');
        state = result.state;
        assert.equal(state.spawnedUnits, remainingUnits(state) + state.cleared);
        assert(state.stacks.every(stack => stack.units.length < state.clearSize));
      }
      assert.equal(state.terminal, 'won', `entry ${index} is not a winning witness`);
      assert.equal(state.movesUsed, witness.moves);
      assert.equal(state.cleared, witness.cleared);
      assert.equal(state.stars, witness.stars);
      assert.equal(hash(state), witness.finalStateSha256);
    }
  } finally { Math.random = previousRandom; }
});

test('bounded authoring reproduces the fixed first-five-wins mapping and witness evidence', () => {
  const generated = generateDailyCatalog();
  assert.deepEqual(generated, fixture);
  assert.deepEqual(generated.seedRange, [0, 99]);
  assert.equal(generated.cutoff, 320);
  assert.equal(generated.counts.won, 30);
  assert.equal(Object.values(generated.counts).reduce((sum, n) => sum + n, 0), 30);
});
