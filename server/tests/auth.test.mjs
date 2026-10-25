import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, parseInitData } from '../leaderboards/auth.mjs';
import { strictJson } from '../leaderboards/json.mjs';
import { productionConfig, BOT_ID } from '../leaderboards/config.mjs';
import { createLimiter } from '../leaderboards/limits.mjs';
import { keys, signedInit, baseTime } from './helpers.mjs';
const options = { now: baseTime, publicKey: keys.publicKey };
const rejects = raw => assert.throws(() => authenticate(raw, options));

test('Ed25519 binds fixed bot, signed identity, unknown fields and freshness', () => {
  const raw = signedInit({ extra: { future_field: 'preserve + decoded&value' } });
  assert.deepEqual(authenticate(raw, options), { telegramId: '101', displayName: 'Fixture' });
  rejects(raw.replace('future_field=', 'changed_field='));
  rejects(signedInit({ botId: '123' }));
  rejects(signedInit({ now: baseTime - 301000 }));
  rejects(signedInit({ now: baseTime + 31000 }));
  assert.equal(authenticate(signedInit({ now: baseTime - 300000 }), options).telegramId, '101');
  assert.throws(() => authenticate(raw), /AUTH_/); // Production factory never accepts a fixture key.
});
test('strict form and JSON reject duplicate, malformed encoding and ambiguous user', () => {
  rejects(signedInit() + '&auth_date=123'); rejects(signedInit() + '&%61uth_date=123');
  rejects(signedInit().replace('user=', 'user=%FF')); rejects(signedInit() + '&bad=%');
  rejects(signedInit() + '&no-value'); rejects(signedInit({ rawUser: '{"id":101,"id":202}' }));
  rejects(signedInit({ rawUser: '{"id":9007199254740992}' }));
  rejects(signedInit().replace(/signature=[^&]+/, 'signature=bad'));
  assert.throws(() => parseInitData('a=' + 'x'.repeat(8193)));
  for (const value of ['{"a":1,"a":2}', '{"x":{"a":1,"a":2}}', '[1,]', '1e999', '"\\ud800"']) assert.throws(() => strictJson(value));
});
test('signed display name is bounded plain text and production scope is explicit', () => {
  const value = authenticate(signedInit({ name: '\u202e\u0000' + '🙂'.repeat(100) }), options);
  assert.equal([...value.displayName].length, 64); assert(!/[\p{Cc}\p{Cf}]/u.test(value.displayName));
  assert.throws(() => productionConfig({})); assert.throws(() => productionConfig({ MAGNET_SORT_BOT_ID: '123' }));
  assert.equal(productionConfig({ MAGNET_SORT_BOT_ID: BOT_ID }).port, 8080);
  assert.throws(() => productionConfig({ MAGNET_SORT_BOT_ID: BOT_ID, ALLOWED_ORIGINS: 'https://evil.example' }));
});
test('rate limiter bounds untrusted state and cannot refill by moving clock backwards', () => {
  let now = 0; const limiter = createLimiter({ clock: () => now, maxEntries: 2 });
  limiter.consume('a', 60, 1); assert.throws(() => limiter.consume('a', 60, 1));
  now = 1000; limiter.consume('a', 60, 1); limiter.consume('b', 60, 1);
  now = 0; assert.throws(() => limiter.consume('a', 60, 1)); now = 1000; assert.throws(() => limiter.consume('a', 60, 1));
  assert.throws(() => limiter.consume('c', 60, 1)); assert.equal(limiter.size, 2);
});
