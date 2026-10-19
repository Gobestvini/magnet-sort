import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function setupTelegram({ token, username, url, mode = 'check', request = fetch, timeoutMs = 8000 }) {
  if (!token || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token)) throw Error('Set TELEGRAM_GAME_BOT_TOKEN securely before running setup.');
  const expected = (username || '').replace(/^@/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(expected)) throw Error('Provide the expected game bot username.');
  let location;
  try { location = new URL(url); } catch { throw Error('Provide the published HTTPS Mini App URL.'); }
  if (location.protocol !== 'https:' || location.username || location.password || location.search || location.hash) throw Error('Mini App URL must be HTTPS without credentials or launch parameters.');
  if (!['check','apply'].includes(mode)) throw Error('Mode must be check or apply.');
  async function call(method, parameters = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const endpoint = new URL(`https://api.telegram.org/bot${token}/${method}`);
      for (const [key, value] of Object.entries(parameters)) endpoint.searchParams.set(key, String(value));
      // Bot API supports query-string parameters on POST. Keep structured
      // menu_button explicitly serialized instead of relying on body decoding.
      const response = await request(endpoint.href, { method: 'POST', signal: controller.signal });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!data?.ok || data.result === undefined) throw Error();
      return data.result;
    } catch { throw Error(`Telegram ${method} failed or timed out; details withheld to protect credentials.`); }
    finally { clearTimeout(timer); }
  }
  const bot = await call('getMe');
  if (bot.is_bot !== true || typeof bot.username !== 'string' || bot.username.toLowerCase() !== expected.toLowerCase()) throw Error('Game bot username mismatch; no settings were changed.');
  const desired = { type: 'web_app', text: 'Play', web_app: { url: location.href } };
  const matches = button => button?.type === desired.type && button.text === desired.text && button.web_app?.url === desired.web_app.url;
  let button = await call('getChatMenuButton'), changed = false;
  if (mode === 'apply' && !matches(button)) {
    if (await call('setChatMenuButton', { menu_button: JSON.stringify(desired) }) !== true) throw Error('Telegram menu update was not acknowledged.');
    changed = true; button = await call('getChatMenuButton');
    if (!matches(button)) throw Error('Telegram menu read-back did not match; inspect the bot settings.');
  }
  return { username: bot.username, url: location.href, mode, changed, menuMatches: matches(button) };
}
export function parseSetupArgs(args) {
  const options = { mode: 'check' };
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--mode':'mode', '--username':'username', '--url':'url' }[args[i]];
    if (!key || !args[i+1] || args[i+1].startsWith('--')) throw Error('Usage: telegram:setup --username BOT --url HTTPS_URL [--mode check|apply]');
    options[key] = args[i+1];
  }
  return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await setupTelegram({ ...parseSetupArgs(process.argv.slice(2)), token: process.env.TELEGRAM_GAME_BOT_TOKEN }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
