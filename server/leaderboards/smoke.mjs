const base = (process.env.LEADERBOARDS_API_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8080}/v1`).replace(/\/$/, '');
async function read(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(5000), credentials: 'omit' });
  if (!response.ok || response.headers.get('cache-control') !== 'no-store') throw Error('API smoke failed');
  return response.json();
}
await read('/health/live'); await read('/health/ready');
const cap = await read('/capabilities');
if (!cap.campaign || !cap.daily) throw Error('Expected both live leaderboard profiles');
const campaign = await read('/leaderboards/campaign'), daily = await read(`/leaderboards/daily?date=${new Date(cap.serverTime).toISOString().slice(0, 10)}`);
if (!Array.isArray(campaign.rows) || !Array.isArray(daily.rows)) throw Error('Ranking response invalid');
const denied = await fetch(base + '/auth/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: '' }), signal: AbortSignal.timeout(5000) });
if (denied.status !== 401 || denied.headers.get('cache-control') !== 'no-store') throw Error('Unsigned auth must fail');
console.log('Leaderboards HTTPS/health/profiles/auth-denial smoke passed; no player result submitted.');
