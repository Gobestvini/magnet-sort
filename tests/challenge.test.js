import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCampaignLevel } from '../src/game/levels.js';
import { applyAction, createInitialState } from '../src/game/simulator.js';
import { createRunResult } from '../src/game/scoring.js';
import { compareRunResults } from '../src/game/scoring.js';
import { createSession } from '../src/game/session.js';
import {
  CHALLENGE_ASSISTED_POLICY, CHALLENGE_SCHEMA_VERSION, challengeCardDataUrl,
  createChallengeCardSvg, createChallengePayload, createChallengeUrl, decodeChallengePayload,
  encodeChallengePayload, parseChallengeUrl, shareChallenge,
} from '../src/social/challenge.js';

function fixture() {
  const level = loadCampaignLevel('campaign-36');
  let state = createInitialState(level);
  for (const action of level.solution.actions) state = applyAction(state, action).state;
  return { level, result: createRunResult(state, 3200) };
}

test('challenge URLs round-trip a frozen level and untrusted challenger target', () => {
  const { level, result } = fixture();
  const url = createChallengeUrl(level, result, 'https://example.test/game/?session=private#old');
  const parsed = parseChallengeUrl(url);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.challenge.schemaVersion, CHALLENGE_SCHEMA_VERSION);
  assert.equal(parsed.challenge.puzzleId, level.puzzleId);
  assert.equal(parsed.challenge.seed, level.seed);
  assert.equal(parsed.challenge.contentVersion, level.contentVersion);
  assert.equal(parsed.challenge.rulesVersion, level.rulesVersion);
  assert.equal(parsed.challenge.assistedPolicy, CHALLENGE_ASSISTED_POLICY);
  assert.equal(parsed.challenge.verification, 'client-unverified');
  assert.equal(new URL(url).searchParams.has('session'), false);
  assert.equal(new URL(url).hash, '');
  const loaded = loadCampaignLevel(parsed.challenge.puzzleId);
  assert.deepEqual(loaded, level);
});

test('challenge session opens the exact frozen board without FTUE or campaign advancement', () => {
  const { level } = fixture();
  const session = createSession({ challengePuzzleId: level.puzzleId });
  assert.equal(session.snapshot().puzzleId, level.puzzleId);
  assert.equal(session.snapshot().challenge, true);
  assert.equal(session.snapshot().tutorial.active, false);
  assert.deepEqual(session.getLevel(), level);
  for (const action of level.solution.actions) {
    assert.equal(session.dispatch(action).accepted, true);
    session.finishResolution();
  }
  assert.equal(session.snapshot().phase, 'won');
  assert.equal(session.nextPuzzle(), false);
});

test('payload rejects malformed, oversized, unsupported and unknown puzzle data', () => {
  assert.equal(decodeChallengePayload('%</script>').reason, 'malformed-payload');
  assert.equal(decodeChallengePayload('A'.repeat(4097)).reason, 'malformed-payload');
  const { level, result } = fixture();
  const valid = createChallengePayload(level, result);
  const encodeRaw = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.equal(decodeChallengePayload(encodeRaw({ ...valid, schemaVersion: 99 })).reason, 'unsupported-version');
  assert.equal(decodeChallengePayload(encodeRaw({ ...valid, puzzleId: 'unknown-<img src=x>' })).reason, 'unknown-puzzle');
  assert.equal(decodeChallengePayload(encodeRaw({ ...valid, seed: 'injected' })).ok, false);
  assert.equal(parseChallengeUrl('https://example.test/?challenge=a&challenge=b').ok, false);
  assert.throws(() => createChallengeUrl(level, result, 'javascript:alert(1)'), /HTTP or HTTPS/);
});

test('challenge link and result use one shared ranking comparator', () => {
  const { level, result } = fixture();
  const payload = createChallengePayload(level, result);
  const challenger = payload.challengerResult;
  assert.equal(compareRunResults({ ...challenger, score: challenger.score + 1 }, challenger), 1);
  assert.equal(compareRunResults(challenger, challenger), 0);
  assert.equal(compareRunResults({ ...challenger, outcome: 'loss' }, challenger), -1);
  assert.equal(encodeChallengePayload(payload).length < 4096, true);
});

test('local result card is a self-contained board thumbnail with score, moves and CTA', () => {
  const { level, result } = fixture();
  const svg = createChallengeCardSvg(level, result);
  assert.match(svg, /width="1200" height="630"/);
  assert.match(svg, /ОЧКОВ/);
  assert.match(svg, /Ходы:/);
  assert.match(svg, /Открой вызов и сыграй/);
  assert.equal((svg.match(/<polygon /g) ?? []).length, 98);
  assert.match(challengeCardDataUrl(svg), /^data:image\/svg\+xml;charset=utf-8,/);
});

test('share is user-triggered by caller, handles native cancellation and clipboard fallback errors', async () => {
  const copied = [];
  const fallback = await shareChallenge({ url: 'https://example.test/?challenge=abc', cardSvg: '<svg/>' }, {
    navigator: {}, clipboard: { async writeText(value) { copied.push(value); } },
  });
  assert.deepEqual(fallback, { status: 'copied' });
  assert.deepEqual(copied, ['https://example.test/?challenge=abc']);
  const cancelled = await shareChallenge({ url: 'https://example.test/' }, {
    navigator: { async share() { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); }, clipboard: { async writeText() { throw new Error('should not copy'); } } },
  });
  assert.deepEqual(cancelled, { status: 'cancelled' });
  const failed = await shareChallenge({ url: 'https://example.test/' }, { navigator: {}, clipboard: { async writeText() { throw new Error('denied'); } } });
  assert.deepEqual(failed, { status: 'failed', reason: 'clipboard-denied' });
});
