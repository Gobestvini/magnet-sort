import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTelemetryService } from './telemetry.mjs';
import { createCommerceService } from './commerce.mjs';

const equal = (a, b) => {
  if(typeof a !== 'string' || typeof b !== 'string' || !a || !b)return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
};
const fail = (status, code) => Object.assign(new Error(code), { status, code });
export function createGrowthServer({ telemetry, commerce, adminToken = '', webhookSecret = '',
  origins = ['https://play.plusvibegames.com', 'https://gobestvini.github.io'],
  now = Date.now, maxRequestsPerMinute = 600 } = {}) {
  let minute = Math.floor(now() / 60_000), requests = Object.create(null), closed = false;
  const allowed = new Set(origins);
  async function readBody(request) {
    const type = request.headers['content-type']?.split(';')[0];
    if (type !== 'application/json') throw fail(415, 'json-required');
    const declared = Number(request.headers['content-length']);
    if (declared > 65_536) throw fail(413, 'body-too-large');
    let size = 0; const chunks = [];
    for await (const chunk of request) {
      size += chunk.length; if (size > 65_536) throw fail(413, 'body-too-large'); chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'invalid-json'); }
  }
  const server = createServer(async (request, response) => {
    const requestId = randomUUID();
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(data));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Vary', 'Origin');
    const origin = request.headers.origin;
    if (origin && !allowed.has(origin)) { send(403, { error: { code:'origin-denied', requestId } }); return; }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (closed) { send(503, { error:{code:'service-closing',requestId} }); return; }
    try {
      const url = new URL(request.url, 'http://growth.internal');
      const bearer = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : '';
      const admin = () => { if (!equal(bearer, adminToken)) throw fail(401, 'admin-auth-required'); };
      const method = request.method, path = url.pathname;
      // Public telemetry must never consume the budget of signed payment updates.
      const webhook = method === 'POST' && path === '/v1/telegram/webhook';
      if (webhook && !equal(request.headers['x-telegram-bot-api-secret-token'], webhookSecret)) throw fail(401, 'webhook-auth-required');
      if (path.startsWith('/v1/admin/') ) admin();
      const privateCommerce=['/v1/commerce/entitlements','/v1/commerce/invoice'].includes(path);
      if(privateCommerce)commerce.entitlements(bearer);
      const scope = webhook ? 'webhook' : path.startsWith('/v1/admin/') ? 'admin' :
        path === '/v1/analytics/visitor' ? 'deletion' : path === '/v1/commerce/auth' ? 'auth' :
        privateCommerce ? 'commerce' : 'public';
      const currentMinute = Math.floor(now() / 60_000);
      if (currentMinute !== minute) { minute = currentMinute; requests = Object.create(null); }
      requests[scope] = (requests[scope] ?? 0) + 1;
      if (scope !== 'webhook' && requests[scope] > maxRequestsPerMinute) {
        response.setHeader('Retry-After', '60'); send(429, { error:{code:'rate-limited',requestId} }); return;
      }
      if (method === 'GET' && path === '/v1/health') {
        send(200, { ok:true, service:'magnet-sort-growth', analytics:true, purchases:commerce.available(), serverTime:now() }); return;
      }
      if (method === 'GET' && path === '/v1/config') {
        send(200, { analytics:true, purchases:commerce.available(), telemetryRetentionDays:35 }); return;
      }
      if (method === 'POST' && path === '/v1/analytics/events') { send(200, telemetry.ingest(await readBody(request))); return; }
      if (method === 'DELETE' && path === '/v1/analytics/visitor') {
        const body = await readBody(request);
        send(200, telemetry.deleteVisitor(body?.visitorId, bearer)); return;
      }
      if (method === 'GET' && path === '/v1/admin/analytics') {
        admin(); const query = Object.fromEntries(url.searchParams);
        send(200, telemetry.summary(query)); return;
      }
      if (method === 'GET' && path === '/v1/admin') {
        response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8',
          'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
        response.end(readFileSync(new URL('./dashboard.html', import.meta.url), 'utf8')); return;
      }
      if (method === 'GET' && path === '/v1/commerce/catalog') { send(200, commerce.catalog()); return; }
      if (method === 'POST' && path === '/v1/commerce/auth') {
        const body = await readBody(request); send(200, commerce.authenticate(body?.initData)); return;
      }
      if (method === 'GET' && path === '/v1/commerce/entitlements') { send(200, commerce.entitlements(bearer)); return; }
      if (method === 'POST' && path === '/v1/commerce/invoice') {
        const body = await readBody(request);
        send(200, await commerce.createInvoice(bearer, body?.productId, body?.idempotencyKey)); return;
      }
      if (method === 'POST' && path === '/v1/telegram/webhook') {
        // The secret is validated before reading a potentially large payload.
        if (!equal(request.headers['x-telegram-bot-api-secret-token'], webhookSecret)) throw fail(401, 'webhook-auth-required');
        send(200, await commerce.webhook(await readBody(request), request.headers['x-telegram-bot-api-secret-token'])); return;
      }
      if (method === 'POST' && path === '/v1/admin/refund') {
        admin(); const body = await readBody(request); send(200, await commerce.refund(body?.chargeId)); return;
      }
      if (method === 'GET' && path === '/v1/admin/reconciliation') { admin(); send(200,{receipts:commerce.reconciliation()}); return; }
      if (method === 'POST' && path === '/v1/admin/reconcile') { admin(); await readBody(request); send(200,await commerce.reconcile()); return; }
      send(404, { error:{code:'not-found',requestId} });
    } catch (error) {
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      const code = typeof error.code === 'string' && /^[a-z0-9_-]{1,64}$/.test(error.code) ? error.code : 'service-error';
      send(status, { error:{code,requestId,retryable:status>=500},serverTime:now() });
    }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5_000; server.maxHeadersCount = 40;
  return { server, close() { closed = true; return new Promise(done => server.close(() => {telemetry.close();commerce.close();done();})); } };
}

export function startFromEnvironment(env = process.env) {
  const data = env.GROWTH_DATA_DIR || '/data'; mkdirSync(data, {recursive:true});
  const telemetry = createTelemetryService({storagePath:join(data,'telemetry.sqlite')});
  const commerce = createCommerceService({dbPath:join(data,'commerce.sqlite'),botToken:env.MAGNET_SORT_BOT_TOKEN,
    webhookSecret:env.MAGNET_SORT_WEBHOOK_SECRET, supportContact:env.SUPPORT_CONTACT || 'support@plusvibegames.com'});
  const app = createGrowthServer({telemetry,commerce,adminToken:env.GROWTH_ADMIN_TOKEN,
    webhookSecret:env.MAGNET_SORT_WEBHOOK_SECRET,
    ...(env.GROWTH_ALLOWED_ORIGINS ? {origins:env.GROWTH_ALLOWED_ORIGINS.split(',')} : {})});
  const port = Number(env.PORT || 8080);
  const reconciliationTimer=setInterval(()=>{if(commerce.available())void commerce.reconcile().catch(()=>{});},60_000);
  reconciliationTimer.unref();
  app.server.listen(port, '0.0.0.0', () => console.log('Magnet Sort growth service ready on port ' + port));
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => { clearInterval(reconciliationTimer);void app.close().then(()=>process.exit(0)); });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startFromEnvironment();
