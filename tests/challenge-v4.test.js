import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  CONTENT_VERSION, CHALLENGE_RULES_HASH, CAMPAIGN_PRESET_ID, SHORT_PRESET_ID,
  MAX_CHALLENGE_LENGTH, encodeChallenge, parseChallenge, challengeForState,
  rulesForChallenge, compareChallengeResult
} from '../src/prototype/challenge-v4.js';
import { CHALLENGE_MANIFEST } from '../src/prototype/challenge-content-v4.js';
import { canonicalJSON, challengeManifest, challengeContentSource, CHALLENGE_SOURCE_FILES } from '../tools/generate-challenge-content.mjs';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { createV4State } from '../src/prototype/model-v4.js';

const make = overrides => ({ schema: 1, levelNumber: 1, seed: 0, presetId: CAMPAIGN_PRESET_ID,
  contentVersion: CONTENT_VERSION, rulesHash: CHALLENGE_RULES_HASH, moves: 7, assisted: false, ...overrides });
const bytes = raw => Buffer.from(raw, 'base64url');
const payload = value => Buffer.from(value).toString('base64url');
const mutate = (raw, change) => { const value = bytes(raw); change(value); return payload(value); };
const readJSON = file => JSON.parse(fs.readFileSync(new URL('../tools/fixtures/' + file, import.meta.url), 'utf8'));

test('content fingerprint covers the exact shipped rules, both profiles and all twelve layouts', () => {
  assert.deepEqual(CHALLENGE_MANIFEST, challengeManifest());
  assert.equal(CHALLENGE_RULES_HASH, createHash('sha256').update(canonicalJSON(CHALLENGE_MANIFEST)).digest('hex'));
  assert.equal(CHALLENGE_MANIFEST.contentVersion, CONTENT_VERSION);
  assert.equal(CHALLENGE_MANIFEST.levels.length, 12);
  assert.deepEqual(CHALLENGE_MANIFEST.profiles.map(p => p.id), [CAMPAIGN_PRESET_ID, SHORT_PRESET_ID]);
  assert.deepEqual(CHALLENGE_MANIFEST.profiles[0].goals, [50,100,150,200,250,300,350,400,450,500,550,600]);
  assert.deepEqual(CHALLENGE_MANIFEST.profiles[1].goals, [40,50,60,70,80,90,100,110,120,130,140,150]);
  assert.deepEqual(CHALLENGE_MANIFEST.profiles[0].spawnIntervals, CHALLENGE_MANIFEST.profiles[1].spawnIntervals);
  assert(CHALLENGE_SOURCE_FILES.includes('src/prototype/model-v4.js'));
  assert(CHALLENGE_SOURCE_FILES.includes('src/prototype/daily-rules.js'));
  assert(!CHALLENGE_SOURCE_FILES.some(p => /runtime|App|platform|challenge-v4/.test(p)));
  for (const source of CHALLENGE_SOURCE_FILES) {
    const normalized = fs.readFileSync(new URL('../' + source, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
    assert.equal(CHALLENGE_MANIFEST.sourceSha256[source], createHash('sha256').update(normalized).digest('hex'));
  }
  const current = fs.readFileSync(new URL('../src/prototype/challenge-content-v4.js', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
  assert.equal(current, challengeContentSource(), 'regenerate content constants explicitly after a reviewed rules change');
  assert.equal(canonicalJSON({ z: 1, a: { b: 2, a: 1 } }), canonicalJSON({ a: { a: 1, b: 2 }, z: 1 }));
  assert.throws(() => { CHALLENGE_MANIFEST.levels[0].blockers[0].col++; }, TypeError);
});

test('both supported profiles roundtrip zero/max uint32 seeds and claimed score boundaries below cap160', () => {
  for (const presetId of [CAMPAIGN_PRESET_ID, SHORT_PRESET_ID])
    for (const seed of [0, 0xffffffff]) for (const moves of [1, 65535]) for (const assisted of [false, true]) {
      const descriptor = make({ presetId, seed, moves, assisted, levelNumber: 12 }), raw = encodeChallenge(descriptor);
      assert(/^[A-Za-z0-9_-]+$/.test(raw));
      assert(raw.length <= MAX_CHALLENGE_LENGTH && raw.length <= 160);
      assert.deepEqual(parseChallenge(raw), { ok: true, descriptor });
      assert.equal(encodeChallenge(parseChallenge(raw).descriptor), raw);
    }
});

test('encoder rejects invalid, extended or incompatible descriptors rather than dropping fields', () => {
  for (const descriptor of [null, [], {}, make({ stacks: [] }), make({ seed: -1 }), make({ seed: -0 }),
    make({ seed: 0x100000000 }), make({ seed: 1.5 }), make({ seed: '0' }), make({ levelNumber: 0 }),
    make({ levelNumber: 13 }), make({ moves: 0 }), make({ moves: 65536 }), make({ moves: 2.5 }),
    make({ assisted: 0 }), make({ rulesHash: CHALLENGE_RULES_HASH.toUpperCase() }),
    make({ schema: 2 }), make({ contentVersion: 'future' }), make({ presetId: 'future' }),
    make({ rulesHash: '0'.repeat(64) })]) assert.throws(() => encodeChallenge(descriptor), TypeError);
  const inherited = Object.create(make());
  assert.throws(() => encodeChallenge(inherited), TypeError);
});

test('unknown schema, content, profile and changed hash are unsupported, never substituted', () => {
  const raw = encodeChallenge(make());
  const unknown = [
    mutate(raw, b => { b[0] = 2; }),
    mutate(raw, b => { b[10] = 'x'.charCodeAt(0); }),
    mutate(raw, b => { b[11 + b[9]] = 'x'.charCodeAt(0); }),
    mutate(raw, b => { b[b.length - 1] ^= 1; })
  ];
  for (const value of unknown) assert.deepEqual(parseChallenge(value), { ok: false, error: 'unsupported' });
  assert.throws(() => rulesForChallenge(make({ rulesHash: '0'.repeat(64) })), TypeError);
});

test('parser rejects malformed UTF8, extra/truncated fields, invalid flags and noncanonical base64url', () => {
  const raw = encodeChallenge(make()), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const invalid = [null, undefined, {}, 0, '', 'A', raw + '=', raw + '\n', '+' + raw.slice(1), '/' + raw.slice(1),
    '_'.repeat(161), raw.slice(0, -2), payload(Buffer.concat([bytes(raw), Buffer.from([0])])),
    mutate(raw, b => { b[1] = 0; }), mutate(raw, b => { b[1] = 13; }),
    mutate(raw, b => { b[2] = 2; }), mutate(raw, b => { b[7] = 0; b[8] = 0; }),
    mutate(raw, b => { b[9] = 0; }), mutate(raw, b => { b[9] = 33; }),
    mutate(raw, b => { b[10] = 0x80; }), // lone continuation
    mutate(raw, b => { b[10] = 0xc0; b[11] = 0xaf; }), // overlong encoding
    mutate(raw, b => { b[10] = 0xed; b[11] = 0xa0; b[12] = 0x80; }), // surrogate
    mutate(raw, b => { b[10] = 0; }),
    raw.slice(0, -1) + alphabet[alphabet.indexOf(raw.at(-1)) + 1]
  ];
  for (const value of invalid) assert.deepEqual(parseChallenge(value), { ok: false, error: 'invalid' }, String(value));
  let rng = 1;
  for (let length = 1; length <= 120; length++) {
    const arbitrary = Buffer.alloc(length);
    for (let i = 0; i < length; i++) { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; arbitrary[i] = rng >>> 24; }
    assert.doesNotThrow(() => parseChallenge(payload(arbitrary)));
    assert.equal(parseChallenge(payload(arbitrary)).ok, false);
  }
});

test('a winner shares its initial seeded board, never its final state or claimed completion', () => {
  const campaign = readJSON('v4-progression-witnesses.json').find(w => w.number === 1);
  const short = readJSON('daily-v4-witnesses.json').entries.find(w => w.index === 0);
  for (const [witness, presetId] of [[campaign, CAMPAIGN_PRESET_ID], [short, SHORT_PRESET_ID]]) {
    const initialDescriptor = make({ seed: witness.seed, presetId }), rules = rulesForChallenge(initialDescriptor);
    let state = rules.createV4State(v4Levels[0], witness.seed);
    const initial = structuredClone(state), attempt = { levelId: v4Levels[0].id, seed: witness.seed, actions: [], assisted: false };
    assert.equal(challengeForState(state, attempt, presetId), null);
    for (const action of witness.actions) {
      const result = rules.applyV4Magnet(state, action); assert(result.accepted); state = result.state; attempt.actions.push(action);
    }
    assert.equal(state.terminal, 'won');
    const descriptor = challengeForState(state, attempt, presetId), received = parseChallenge(encodeChallenge(descriptor));
    assert(received.ok);
    const recipient = rulesForChallenge(received.descriptor).createV4State(v4Levels[0], received.descriptor.seed);
    assert.deepEqual(recipient, initial);
    assert.equal(recipient.terminal, null); assert.equal(recipient.movesUsed, 0); assert.equal(recipient.cleared, 0);
    const altered = parseChallenge(encodeChallenge({ ...descriptor, moves: 65535, assisted: true })).descriptor;
    assert.deepEqual(rulesForChallenge(altered).createV4State(v4Levels[0], altered.seed), initial,
      'unverified claimed score metadata must never be applied to gameplay state');
    assert.equal(compareChallengeResult(altered, recipient, attempt).comparable, false);
    assert.equal(compareChallengeResult(altered, recipient, attempt).verified, false);
  }
  const defaultInitial = createV4State(v4Levels[0], 0);
  assert.equal(defaultInitial.goal, 50, 'campaign rules remain unchanged');
});

test('local comparison requires a win on the same board/profile and assistance category, and stays unverified', () => {
  const descriptor = make({ moves: 10 }), state = { terminal: 'won', levelNumber: 1, puzzleId: v4Levels[0].id,
    seed: 0, goal: 50, movesUsed: 8 }, attempt = { levelId: v4Levels[0].id, seed: 0, assisted: false };
  assert.deepEqual(compareChallengeResult(descriptor, state, attempt),
    { comparable: true, outcome: 'better', claimedMoves: 10, moves: 8, verified: false });
  assert.equal(compareChallengeResult(descriptor, { ...state, movesUsed: 10 }, attempt).outcome, 'equal');
  assert.equal(compareChallengeResult(descriptor, { ...state, movesUsed: 11 }, attempt).outcome, 'worse');
  for (const [nextState, nextAttempt, nextDescriptor] of [
    [{ ...state, terminal: 'lost' }, attempt, descriptor],
    [{ ...state, seed: 1 }, attempt, descriptor],
    [state, { ...attempt, assisted: true }, descriptor],
    [{ ...state, goal: 40 }, attempt, descriptor],
    [state, attempt, { ...descriptor, rulesHash: '0'.repeat(64) }]
  ]) assert.equal(compareChallengeResult(nextDescriptor, nextState, nextAttempt).comparable, false);
});
