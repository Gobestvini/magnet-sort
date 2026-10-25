export const BOT_ID = '8820798959';
export const TELEGRAM_KEY = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
export const DAY = 86400000;
export const ORIGINS = Object.freeze(['https://play.plusvibegames.com', 'https://gobestvini.github.io']);
export const LIMITS = Object.freeze({ body: 256 * 1024, authBody: 16 * 1024, initData: 8 * 1024,
  actions: 2048, descriptor: 2048, bodyMs: 5000, operationMs: 5000, replayMs: 250, queue: 16, workers: 2,
  sessions: 10, openRuns: 20, tokenMs: DAY, authAgeSeconds: 300, authFutureSeconds: 30,
  limiterEntries: 10000, limiterIdleMs: 3600000 });
export class ApiError extends Error {
  constructor(status, code, retryable = false, retryAfter = undefined) {
    super(code); this.status = status; this.code = code; this.retryable = retryable; this.retryAfter = retryAfter;
  }
}
export const bad = (code = 'MALFORMED') => new ApiError(400, code);
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const keysOnly = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function productionConfig(env = process.env) {
  if (env.MAGNET_SORT_BOT_ID !== BOT_ID) throw Error('Configure the fixed Magnet Sort public bot ID');
  const origins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : [...ORIGINS];
  if (!origins.length || origins.some(origin => !ORIGINS.includes(origin))) throw Error('Invalid production origin allowlist');
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid port');
  return { path: env.LEADERBOARDS_DB ?? '/data/leaderboards.sqlite', port, origins };
}
