import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioFeedback } from '../src/audio/feedback.js';

function fakeAudioEnvironment() {
  const oscillators = [];
  const gains = [];
  const calls = [];
  const parameter = () => ({ setValueAtTime(...args) { calls.push(['set', ...args]); }, linearRampToValueAtTime(...args) { calls.push(['linear', ...args]); }, exponentialRampToValueAtTime(...args) { calls.push(['exponential', ...args]); } });
  class FakeAudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0.1; this.destination = {}; calls.push(['construct']); }
    createOscillator() {
      const node = { frequency: parameter(), connect() {}, disconnect() { calls.push(['osc-disconnect']); }, start(time) { calls.push(['start', time]); }, stop(time) { calls.push(['stop', time]); }, onended: null };
      oscillators.push(node);
      return node;
    }
    createGain() { const node = { gain: parameter(), connect() {}, disconnect() { calls.push(['gain-disconnect']); } }; gains.push(node); return node; }
    async resume() { this.state = 'running'; calls.push(['resume']); }
    async suspend() { this.state = 'suspended'; calls.push(['suspend']); }
    async close() { this.state = 'closed'; calls.push(['close']); }
  }
  const vibrations = [];
  const navigator = { vibrate(value) { vibrations.push(value); return true; } };
  return { AudioContext: FakeAudioContext, navigator, oscillators, gains, calls, vibrations };
}

const events = [
  { turn: 1, seq: 1, type: 'actionAccepted' },
  { turn: 1, seq: 2, type: 'tokenMoved' },
  { turn: 1, seq: 3, type: 'tokenMoved' },
  { turn: 1, seq: 4, type: 'stackMerged' },
  { turn: 1, seq: 5, type: 'stackCleared' },
];

test('audio unlock is gesture-triggered, ordered cues are bounded and duplicate event callbacks are ignored', async () => {
  const env = fakeAudioEnvironment();
  const feedback = createAudioFeedback(env);
  assert.equal(feedback.snapshot().contextCreated, false);
  assert.equal((await feedback.activateFromGesture()), true);
  assert.deepEqual(env.calls.filter(([name]) => name === 'construct').length, 1);
  const first = feedback.playEvents(events);
  assert.equal(first.played, 4);
  assert.equal(first.vibrated, true);
  assert.deepEqual(env.vibrations.at(-1), [18, 22, 32]);
  assert.equal(feedback.playEvents(events).played, 0);
  assert.equal(env.oscillators.length, 4);
  assert.deepEqual(env.calls.filter(([name]) => name === 'start').map(([, at]) => Math.round(at * 1000)), [104, 171, 273, 370]);
  await feedback.suspend();
  assert.equal(feedback.snapshot().contextState, 'suspended');
  assert.equal(feedback.snapshot().activeVoices, 0);
  assert.equal(env.vibrations.at(-1), 0);
  await feedback.activateFromGesture();
  feedback.beginRun();
  assert.equal(feedback.playEvents(events).played, 4);
  assert.equal(env.oscillators.length, 8);
  for (let run = 0; run < 20; run++) {
    feedback.beginRun();
    assert.equal(feedback.playEvents(events).played, 4);
    assert.equal(feedback.snapshot().activeVoices, 4);
  }
  assert.equal(env.oscillators.length, 88);
  feedback.dispose();
  assert.equal(feedback.snapshot().contextState, 'closed');
  assert.equal(feedback.snapshot().activeVoices, 0);
});

test('mute persists in the manager and unsupported audio/haptics fail softly', async () => {
  const env = fakeAudioEnvironment();
  const feedback = createAudioFeedback(env);
  feedback.setSettings({ soundEnabled: false });
  assert.equal(await feedback.activateFromGesture(), false);
  assert.equal(feedback.snapshot().contextCreated, false);
  assert.equal(feedback.playEvents(events).played, 0);
  feedback.setSettings({ hapticsEnabled: false });
  const hapticCount = env.vibrations.filter((value) => value !== 0).length;
  feedback.setSettings({ soundEnabled: true });
  await feedback.activateFromGesture();
  feedback.beginRun();
  assert.equal(feedback.playEvents(events).played, 4);
  assert.equal(env.vibrations.filter((value) => value !== 0).length, hapticCount);
  feedback.dispose();

  const unsupported = createAudioFeedback({ AudioContext: undefined, navigator: {} });
  assert.equal(await unsupported.activateFromGesture(), false);
  assert.deepEqual(unsupported.playEvents(events), { played: 0, vibrated: false });
  unsupported.dispose();

  class BrokenAudioContext { constructor() { throw new Error('unavailable'); } }
  const broken = createAudioFeedback({ AudioContext: BrokenAudioContext, navigator: { vibrate() { throw new Error('unsupported'); } } });
  assert.equal(await broken.activateFromGesture(), false);
  assert.deepEqual(broken.playEvents(events), { played: 0, vibrated: false });
  broken.dispose();
});
