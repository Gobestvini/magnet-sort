import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { authenticate } from './auth.mjs';
import { strictJson } from './json.mjs';
import { ApiError, ORIGINS, LIMITS, object, keysOnly, uuid, bad } from './config.mjs';
import { createStore } from './store.mjs';
import { createReplayPool } from './pool.mjs';
import { normalizeActions, digestReplay, capabilities, validateDailyCatalog } from './profiles.mjs';
import { createLimiter } from './limits.mjs';

function readBody(req, limit, bodyMs) {
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') return Promise.reject(new ApiError(415, 'ENCODING_UNSUPPORTED'));
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) return Promise.reject(new ApiError(415, 'CONTENT_TYPE_UNSUPPORTED'));
  const declared = req.headers['content-length'];
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > limit)) return Promise.reject(new ApiError(413, 'BODY_TOO_LARGE'));
  return new Promise((resolve, reject) => {
    let bytes = 0, settled = false; const chunks = [];
    const timer = setTimeout(() => finish(new ApiError(408, 'BODY_TIMEOUT')), bodyMs);
    function finish(error, value) {
      if (settled) return; settled = true; clearTimeout(timer);
      req.removeListener('data', data); req.removeListener('end', end); req.removeListener('aborted', aborted); req.removeListener('error', aborted);
      if (error) { req.pause(); error.closeConnection = true; reject(error); } else resolve(value);
    }
    function data(chunk) { bytes += chunk.length; if (bytes > limit) finish(new ApiError(413, 'BODY_TOO_LARGE')); else chunks.push(chunk); }
    function aborted() { finish(new ApiError(400, 'REQUEST_ABORTED')); }
    function end() {
      try { finish(null, strictJson(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch (error) { finish(error instanceof ApiError ? error : bad()); }
    }
    req.on('data', data); req.on('end', end); req.on('aborted', aborted); req.on('error', aborted);
  });
}
export function createApp({ path = ':memory:', clock = Date.now, origins = ORIGINS, authOptions = {}, poolOptions = {},
  verifyDaily = true, bodyMs = LIMITS.bodyMs, limiterOptions = {}, logger = () => {} } = {}) {
  const store = createStore(path, { clock }), pool = createReplayPool(poolOptions), limiter = createLimiter({ clock, ...limiterOptions });
  let initialized = false, closing = false;
  const ready = (async () => { await pool.ready; if (verifyDaily) await validateDailyCatalog(pool); store.cleanup(); initialized = true; })();
  void ready.catch(() => {});
  const cleanupTimer = setInterval(() => { try { if (!closing) store.cleanup(); } catch { logger({ event: 'cleanup-failed' }); } }, 5 * 60000);
  cleanupTimer.unref();
  function getPlayer(req, optional = false) {
    const header = req.headers.authorization;
    if (optional && header === undefined) return null;
    const match = typeof header === 'string' && header.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!match) throw new ApiError(401, 'AUTH_REQUIRED');
    return store.session(match[1]);
  }
  const server = createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 10000, headersTimeout: 5000, keepAliveTimeout: 5000 }, async (req, res) => {
    const requestId = randomUUID(), started = performance.now(); let route = 'unknown', status = 500, errorCode;
    function send(code, value, extra = {}) {
      status = code;
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
      res.end(code === 204 ? undefined : JSON.stringify({ ...value, serverTime: clock() }));
    }
    try {
      const origin = req.headers.origin;
      if (origin !== undefined) {
        if (!origins.includes(origin)) throw new ApiError(403, 'ORIGIN_DENIED');
        res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
      }
      const url = new URL(req.url, 'http://localhost');
      // Reject encoded/ambiguous path variants rather than proxying a different API.
      const pathname = url.pathname;
      if (!pathname.startsWith('/v1/') || pathname.includes('%') || pathname.includes('//')) throw new ApiError(404, 'NOT_FOUND');
      if (req.method === 'OPTIONS') { route = 'preflight'; send(204, {}); return; }
      if (req.method === 'GET' && pathname === '/v1/health/live') { route = 'live'; send(200, { ok: true }); return; }
      if (req.method === 'GET' && pathname === '/v1/health/ready') {
        route = 'ready'; if (!initialized || closing || !pool.healthy) throw new ApiError(503, 'NOT_READY', true, 1);
        send(200, { ok: true }); return;
      }
      if (!initialized || closing) throw new ApiError(503, 'NOT_READY', true, 1);
      if (req.method === 'GET') {
        limiter.consume('global:read', 600, 100);
        const player = getPlayer(req, true); if (player) limiter.consume(`read:${player.playerId}`, 120, 30);
        if (pathname === '/v1/capabilities') { route = 'capabilities'; send(200, capabilities()); return; }
        const mode = pathname === '/v1/leaderboards/campaign' ? 'campaign' : pathname === '/v1/leaderboards/daily' ? 'daily' : null;
        if (!mode) throw new ApiError(404, 'NOT_FOUND');
        route = `leaderboards:${mode}`;
        const selectors = Object.create(null);
        for (const [key, value] of url.searchParams) {
          if (!['date', 'catalogVersion', 'contentVersion', 'presetId', 'rulesVersion'].includes(key) || Object.hasOwn(selectors, key)) throw bad('INVALID_SELECTOR');
          selectors[key] = value;
        }
        send(200, store.leaderboard(mode, selectors, player?.playerId)); return;
      }
      if (req.method === 'POST' && pathname === '/v1/auth/telegram') {
        route = 'auth'; limiter.consume('global:auth', 30, 10);
        const body = await readBody(req, LIMITS.authBody, bodyMs);
        if (!keysOnly(body, ['initData'])) throw bad();
        const identity = authenticate(body.initData, { ...authOptions, now: clock() });
        limiter.consume(`auth:${identity.telegramId}`, 10 / 60, 10);
        send(200, store.issueSession(identity)); return;
      }
      if (!['POST', 'DELETE'].includes(req.method)) throw new ApiError(404, 'NOT_FOUND');
      const player = getPlayer(req);
      if (req.method === 'DELETE' && pathname === '/v1/me') {
        route = 'delete'; limiter.consume('global:mutation', 120, 20); limiter.consume(`delete:${player.playerId}`, 1, 1);
        const body = await readBody(req, LIMITS.authBody, bodyMs);
        if (!keysOnly(body, ['confirm']) || body.confirm !== 'delete-leaderboards') throw bad('CONFIRMATION_REQUIRED');
        send(200, store.deletePlayer(player.playerId)); return;
      }
      if (req.method !== 'POST') throw new ApiError(404, 'NOT_FOUND');
      limiter.consume('global:mutation', 120, 20);
      if (pathname === '/v1/runs') {
        route = 'register'; limiter.consume(`register:${player.playerId}`, 20, 5);
        const body = await readBody(req, LIMITS.body, bodyMs);
        if (!keysOnly(body, ['clientAttemptId', 'mode', 'descriptor', 'publishConsent'])) throw bad();
        if (body.publishConsent !== true) throw new ApiError(403, 'CONSENT_REQUIRED');
        send(200, store.register(player.playerId, body.clientAttemptId, body.mode, body.descriptor)); return;
      }
      const match = pathname.match(/^\/v1\/runs\/([^/]+)\/result$/);
      if (match && uuid(match[1])) {
        route = 'result'; limiter.consume(`result:${player.playerId}`, 10, 3);
        const body = await readBody(req, LIMITS.body, bodyMs);
        if (!keysOnly(body, ['actions', 'assisted']) || typeof body.assisted !== 'boolean') throw bad();
        const actions = normalizeActions(body.actions), own = store.ownRun(player.playerId, match[1]), descriptor = JSON.parse(own.descriptor_json);
        const digest = digestReplay(own.mode, descriptor, actions), inspected = store.inspect(player.playerId, own.id, digest);
        if (inspected.accepted) { send(200, inspected.accepted); return; }
        const abort = new AbortController();
        const disconnected = () => { if (!res.writableFinished) abort.abort(); };
        res.once('close', disconnected);
        let result;
        try { result = await pool.run({ mode: own.mode, descriptor, actions }, { signal: abort.signal }); }
        finally { res.removeListener('close', disconnected); }
        if (abort.signal.aborted) throw new ApiError(499, 'REQUEST_ABORTED');
        if (result?.digest !== digest || !object(result.metrics) || !Number.isSafeInteger(result.metrics.moves) || !Number.isSafeInteger(result.metrics.stars) || !Number.isSafeInteger(result.metrics.cleared)) throw new ApiError(503, 'WORKER_RESULT_INVALID', true, 1);
        // Owner recomputes binding after worker return; DB status/expiry is checked
        // again in the short transaction, never around the replay itself.
        if (digestReplay(own.mode, descriptor, actions) !== digest) throw new ApiError(409, 'RESULT_CONFLICT');
        send(200, store.commit(player.playerId, own.id, digest, result.metrics, actions, body.assisted)); return;
      }
      throw new ApiError(404, 'NOT_FOUND');
    } catch (error) {
      let safe = error instanceof ApiError ? error : error.code === 'SQLITE_BUSY' ? new ApiError(503, 'DATABASE_BUSY', true, 1) : new ApiError(500, 'SERVICE_ERROR');
      errorCode = safe.code;
      const headers = safe.retryAfter ? { 'Retry-After': String(safe.retryAfter) } : {};
      if (error.closeConnection || !req.complete) { headers.Connection = 'close'; res.once('finish', () => req.destroy()); }
      send(safe.status, { error: { code: safe.code, requestId, retryable: safe.retryable } }, headers);
    } finally {
      logger({ requestId, route, status, durationMs: Math.round(performance.now() - started), ...(errorCode ? { errorCode } : {}), ...pool.stats });
    }
  });
  let closePromise;
  return { server, store, pool, ready,
    close() {
      closePromise ??= (async () => {
        closing = true; clearInterval(cleanupTimer);
        if (server.listening) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
        await pool.close(); store.close();
      })(); return closePromise;
    }
  };
}
