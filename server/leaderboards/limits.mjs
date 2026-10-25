import { ApiError, LIMITS } from './config.mjs';
export function createLimiter({ clock = Date.now, maxEntries = LIMITS.limiterEntries } = {}) {
  const entries = new Map();
  let calls = 0;
  return {
    consume(key, ratePerMinute, burst) {
      const now = clock();
      if (++calls % 100 === 0) for (const [name, entry] of entries) if (now - entry.at >= LIMITS.limiterIdleMs) entries.delete(name);
      let entry = entries.get(key);
      if (!entry && entries.size >= maxEntries) throw new ApiError(429, 'LIMITER_FULL', true, 60);
      if (!entry) entry = { tokens: burst, at: now };
      entry.tokens = Math.min(burst, entry.tokens + Math.max(0, now - entry.at) * ratePerMinute / 60000); entry.at = Math.max(now, entry.at);
      entries.delete(key); entries.set(key, entry);
      if (entry.tokens < 1) throw new ApiError(429, 'RATE_LIMITED', true, Math.max(1, Math.ceil((1 - entry.tokens) * 60 / ratePerMinute)));
      entry.tokens--;
    },
    get size() { return entries.size; }
  };
}
