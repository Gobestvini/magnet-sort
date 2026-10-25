const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
const { productionServer, ready, saved, put } = require('./save-v4-browser-check.cjs');
const { keyboardPlace, readyTools } = require('./v4-browser-check.cjs');
const { bridge } = require('./platforms/browser-check.cjs');
const output = process.env.LEADERBOARDS_OUTPUT || 'artifacts/leaderboards';
const moduleAt = file => import(pathToFileURL(path.resolve(file)).href);
const openButton = page => page.getByRole('button', { name: 'Leaderboards', exact: true });
const dialog = page => page.getByRole('dialog', { name: 'Leaderboards', exact: true });
async function clickVisible(button) { await button.scrollIntoViewIfNeeded(); await button.click(); }

// This fake HTTP service belongs only to the browser test. Production bundles
// contain neither fixture identities nor a way to bypass Telegram signatures.
async function fakeService(context) {
  const { replayAttempt } = await moduleAt('src/prototype/progress-v4.js');
  const { getDaily, replayDailyAttempt } = await moduleAt('src/prototype/daily-v4.js');
  const requests = [], runs = new Map(), results = new Map(); let failFirstResult = true, failRead = false, delayCampaign = false;
  const own = mode => [...results.values()].find(result => result.mode === mode);
  await context.route('https://api.plusvibegames.com/magnet-sort/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), routePath = url.pathname.replace('/magnet-sort/v1', '');
    const headers = { 'Access-Control-Allow-Origin': request.headers().origin || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const reply = (body, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = request.postDataJSON(); requests.push({ routePath, method: request.method(), body });
    if (routePath === '/auth/telegram') return reply({ token: 'browser-test-session-only', expiresAt: Date.now() + 86400000, player: { playerId: 'fixture-self', displayName: 'You' } });
    if (routePath === '/runs') {
      const key = body.clientAttemptId; let run = runs.get(key);
      if (!run) { run = { ...body, runId: 'fixture-run-' + (runs.size + 1) }; runs.set(key, run); }
      assert.deepEqual(run.descriptor, body.descriptor, 'Retry preserves canonical attempt descriptor');
      return reply({ runId: run.runId, descriptor: run.descriptor, expiresAt: Date.now() + 86400000 });
    }
    if (routePath.endsWith('/result')) {
      const runId = routePath.split('/')[2], run = [...runs.values()].find(value => value.runId === runId); assert(run);
      const attempt = { levelId: run.descriptor.levelId, seed: run.descriptor.seed, actions: body.actions, assisted: body.assisted };
      const actual = run.mode === 'daily' ? replayDailyAttempt({ ...getDaily(run.descriptor.date), ...attempt }).state : replayAttempt(attempt).state;
      assert.equal(actual.terminal, 'won', 'HTTP submission contains a genuine winning journal');
      const previous = results.get(runId); if (previous) assert.deepEqual(previous.actions, body.actions);
      results.set(runId, { mode: run.mode, actions: body.actions, moves: actual.movesUsed, stars: actual.stars, cleared: actual.cleared });
      if (failFirstResult) { failFirstResult = false; return reply({ error: { code: 'BUSY', retryable: true } }, 503); }
      return reply({ receipt: { runId, acceptedAt: Date.now(), digest: 'fixture-digest' }, metrics: { moves: actual.movesUsed, stars: actual.stars, cleared: actual.cleared } });
    }
    if (routePath.startsWith('/leaderboards/')) {
      const mode = routePath.endsWith('daily') ? 'daily' : 'campaign';
      if (mode === 'campaign' && delayCampaign) await new Promise(resolve => setTimeout(resolve, 400));
      if (failRead) return reply({ error: { code: 'OFFLINE', retryable: true } }, 503);
      const result = own(mode), stats = mode === 'daily' ? { moves: 7 } : { completedLevels: 4, stars: 11 };
      const ownStats = mode === 'daily' ? { moves: result?.moves ?? 7 } : { completedLevels: 1, stars: result?.stars ?? 3 };
      return reply({ rows: [{ playerId: 'fixture-' + mode, displayName: mode === 'daily' ? 'Daily player' : 'Campaign player', rank: 1, ...stats }],
        ownRow: result ? { playerId: 'fixture-self', displayName: 'You', rank: 57, ...ownStats } : null, boardKey: mode + '-fixture', date: url.searchParams.get('date'), rules: { assistanceAllowed: true } });
    }
    if (routePath === '/me') { results.clear(); return reply({ deleted: true }); }
    return reply({ error: { code: 'NOT_FOUND' } }, 404);
  });
  return { requests, runs, results, failReads(value) { failRead = value; }, delayCampaign(value) { delayCampaign = value; } };
}
async function check(base, combined = false) {
  fs.mkdirSync(output, { recursive: true });
  const { createAttempt, emptyProgress, PROGRESS_V4_KEY } = await moduleAt('src/prototype/progress-v4.js');
  const { DAILY_V4_KEY, getDaily, createDailyAttempt } = await moduleAt('src/prototype/daily-v4.js');
  const witnesses = JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json', 'utf8')), campaignWitness = witnesses.find(value => value.number === 1);
  const dailyWitnesses = JSON.parse(fs.readFileSync('tools/fixtures/daily-v4-witnesses.json', 'utf8')).entries;
  const browser = await chromium.launch({ headless: true }); const report = [];
  try {
    for (const [target, viewport] of [['web', { width: 390, height: 844 }], ['telegram', { width: 844, height: 390 }]]) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
      await context.addInitScript(()=>{const original=window.fetch;window.__rankingFetchProbe={pending:0,max:0};window.fetch=async(...args)=>{const ranking=String(args[0]).includes('/magnet-sort/v1/');if(ranking){__rankingFetchProbe.pending++;__rankingFetchProbe.max=Math.max(__rankingFetchProbe.max,__rankingFetchProbe.pending);}try{return await original(...args);}finally{if(ranking)__rankingFetchProbe.pending--;}};});
      const mock = await fakeService(context), page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      if (target === 'telegram') await bridge(page);
      const url = base + (combined ? target === 'web' ? '' : 'telegram/' : target + '/');
      await page.goto(url); await ready(page); await readyTools(page);
      const currentDate = await page.evaluate(() => new Date().toISOString().slice(0, 10));
      await put(page, emptyProgress({ ...createAttempt('magnet-v4-01', campaignWitness.seed), actions: campaignWitness.actions.slice(0, -1) }));
      await page.reload(); await ready(page); await readyTools(page);
      const campaignBefore = await saved(page);
      await page.getByRole('button', { name: 'Pause', exact: true }).click(); await clickVisible(openButton(page)); await dialog(page).waitFor();
      await page.getByText('Campaign player', { exact: true }).waitFor();
      assert.match(await dialog(page).textContent(), /Hint and Undo are allowed/);
      assert.deepEqual(await saved(page), campaignBefore, 'Reading never changes game save');
      if (target === 'web') {
        assert.equal(await page.getByRole('button', { name: 'Join leaderboards', exact: true }).count(), 0);
        assert.equal(await page.getByRole('link', { name: 'Play in Telegram', exact: true }).count(), 1);
      } else {
        await clickVisible(page.getByRole('button', { name: 'Join leaderboards', exact: true }));
        await page.getByText('This attempt is registered.', { exact: false }).waitFor();
        assert.equal(mock.runs.size, 1);
      }
      mock.delayCampaign(true); await page.getByRole('tab', { name: 'Campaign', exact: true }).click(); await page.getByRole('tab', { name: 'Daily', exact: true }).click();
      await page.getByText('Daily player', { exact: true }).waitFor(); await page.waitForTimeout(450);
      assert.equal(await page.getByText('Campaign player', { exact: true }).count(), 0, 'Late campaign response cannot replace Daily'); mock.delayCampaign(false);
      mock.failReads(true); await page.getByRole('tab', { name: 'Campaign', exact: true }).click(); await page.getByRole('button', { name: 'Retry leaderboard', exact: true }).waitFor();
      mock.failReads(false); await clickVisible(page.getByRole('button', { name: 'Retry leaderboard', exact: true })); await page.getByText('Campaign player', { exact: true }).waitFor();
      await page.locator('.leaderboard-panel').evaluate(panel => { panel.scrollTop = panel.scrollHeight; });
      assert.equal(await page.getByRole('button', { name: 'Close leaderboards', exact: true }).evaluate(button => {
        const bounds = button.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight && button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      }), true, 'Touch players can close the scrolled leaderboard without scrolling back to its heading');
      await page.screenshot({ path: `${output}/${target}-ranking.png`, fullPage: true });
      await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Paused', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Resume', exact: true }).click(); await readyTools(page);
      const action = campaignWitness.actions.at(-1); await page.locator(`[data-magnet-color="${action.color}"]`).click(); await keyboardPlace(page, action.cell);
      await page.getByRole('region', { name: 'Result', exact: true }).waitFor();
      if (target === 'telegram') {
        await page.waitForFunction(() => Object.entries(localStorage).some(([key,value]) => key.startsWith('magnet-sort.leaderboards.attempts.v1:') && value.includes('"failed":true')));
        const winningJournal=(await saved(page)).activeAttempt.actions;
        await page.reload();await ready(page);await readyTools(page);assert.equal((await saved(page)).activeAttempt.levelId,'magnet-v4-02','Campaign owner advances after winning reload');
        await page.getByRole('button',{name:'Pause',exact:true}).click();await clickVisible(openButton(page)); await page.getByText('Result not sent.', { exact: false }).waitFor();
        await clickVisible(page.getByRole('button', { name: 'Retry submission', exact: true })); await page.getByText(/result submitted\./i).waitFor();
        assert.equal(mock.results.size, 1);assert.deepEqual([...mock.results.values()][0].actions,winningJournal,'Reload retry preserves the original winning journal'); await page.getByText('Your place', { exact: true }).waitFor();
        assert.equal(await page.locator('.leaderboard-own').count(), 1);
        await page.screenshot({ path: `${output}/telegram-submitted.png`, fullPage: true });
        await page.getByRole('button', { name: 'Close leaderboards', exact: true }).click(); await page.getByRole('dialog', { name: 'Paused', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Resume', exact: true }).click(); await readyTools(page);
        await page.getByRole('button', { name: 'Pause', exact: true }).click(); await clickVisible(page.getByRole('button', { name: 'Daily board', exact: true })); await readyTools(page);
        const daily = getDaily(currentDate), witness = dailyWitnesses.find(value => value.index === daily.index);
        const campaignRaw = await page.evaluate(key => localStorage.getItem(key), PROGRESS_V4_KEY);
        const dailyRecord = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), DAILY_V4_KEY);
        await page.evaluate(({ key,record,attempt }) => localStorage.setItem(key, JSON.stringify({ ...record, activeView: 'daily', activeAttempt: attempt })), { key: DAILY_V4_KEY, record: dailyRecord, attempt: { ...createDailyAttempt(currentDate), actions: witness.actions.slice(0, -1) } });
        await page.reload(); await ready(page); await readyTools(page);
        const last = witness.actions.at(-1); await page.locator(`[data-magnet-color="${last.color}"]`).click(); await keyboardPlace(page, last.cell);
        await page.getByRole('region', { name: 'Result', exact: true }).waitFor(); await clickVisible(openButton(page)); await page.getByText('Result submitted.', { exact: true }).waitFor();
        await page.getByText('Daily player', { exact: true }).waitFor(); assert.equal(mock.results.size, 2); assert.equal(await page.evaluate(key => localStorage.getItem(key), PROGRESS_V4_KEY), campaignRaw, 'Daily submission preserves campaign bytes');
        const allStored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })); assert(!allStored.includes('opaque-browser-fixture'), 'No raw launch data stored');
        await page.getByRole('button', { name: 'Close leaderboards', exact: true }).click();
      }
      const frozen = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [PROGRESS_V4_KEY, DAILY_V4_KEY]);
      // Exercise modal cleanup repeatedly, including platform pause semantics.
      for (let i = 0; i < 20; i++) { await clickVisible(openButton(page)); await dialog(page).waitFor(); await page.getByRole('button', { name: 'Close leaderboards', exact: true }).click(); }
      await page.waitForFunction(()=>__rankingFetchProbe.pending===0);assert((await page.evaluate(()=>__rankingFetchProbe.max))<=3,'Bounded network requests through modal cycles');
      assert.deepEqual(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [PROGRESS_V4_KEY, DAILY_V4_KEY]), frozen);
      await clickVisible(openButton(page)); await page.setViewportSize({ width: target === 'web' ? 844 : 390, height: target === 'web' ? 390 : 844 });
      const close = page.getByRole('button', { name: 'Close leaderboards', exact: true }); await close.scrollIntoViewIfNeeded(); const rect = await close.boundingBox(); assert(rect.width >= 44 && rect.height >= 44); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/${target}-rotated.png`, fullPage: true });
      assert.deepEqual(errors, []); report.push({ target, campaignRead: true, dailyRead: true, cycles: 20, gameUnchanged: true, submissions: mock.results.size }); await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); console.log('Leaderboards production web/Telegram-mock: both rankings, consent, genuine replay submissions, lost acknowledgment retry, own place, stale/error reads, modal cycles and responsive layout PASS.');
}
(async () => { const provided = process.env.LEADERBOARDS_BASE_URL; const server = provided ? null : await productionServer('dist'); try { await check(provided || server.base, Boolean(process.env.LEADERBOARDS_COMBINED)); } finally { await server?.close(); } })().catch(error => { console.error(error); process.exitCode = 1; });
