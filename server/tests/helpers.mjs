import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BOT_ID } from '../leaderboards/config.mjs';
import { CONTENT_VERSION, CAMPAIGN_PRESET, resolveDaily } from '../leaderboards/profiles.mjs';
export const keys = generateKeyPairSync('ed25519');
export const baseTime = Date.UTC(2026, 0, 1, 12);
export function signedInit({ id = 101, name = 'Fixture', now = baseTime, botId = BOT_ID, rawUser, extra = {} } = {}) {
  const data = { auth_date: String(Math.floor(now / 1000)), user: rawUser ?? JSON.stringify({ id, first_name: name }), ...extra };
  const check = Object.entries(data).filter(([key]) => !['signature', 'hash'].includes(key)).sort(([a], [b]) => a < b ? -1 : 1).map(([key, value]) => `${key}=${value}`).join('\n');
  data.signature = sign(null, Buffer.from(`${botId}:WebAppData\n${check}`), keys.privateKey).toString('base64url');
  return new URLSearchParams(data).toString();
}
export function campaign(seed = 0, level = 1) { return { rulesVersion: 4, contentVersion: CONTENT_VERSION, presetId: CAMPAIGN_PRESET, levelId: `magnet-v4-${String(level).padStart(2, '0')}`, seed }; }
export const campaignActions = [
  ['blue',4,3],['violet',5,4],['violet',4,2],['blue',1,3],['coral',1,3],['violet',3,1],['blue',4,4]
].map(([color,col,row]) => ({ type: 'placeMagnet', color, cell: { col,row } }));
export const dailyFixture = JSON.parse(readFileSync(new URL('../../tools/fixtures/daily-v4-witnesses.json', import.meta.url), 'utf8'));
export const dailyActions = dailyFixture.entries[0].actions;
export const daily = () => resolveDaily('2026-01-01');
export const attemptId = () => randomUUID();
