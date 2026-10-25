// Growth UI self-check with real seeded game input. Only analytics HTTP is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { route: gameRoute, keyboardPlace, readyTools } = require('./v4-browser-check.cjs');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:5189/';
const output = process.env.GROWTH_BROWSER_OUTPUT || 'artifacts/growth-browser';
const META_KEY = 'magnet-sort.meta.v1';
const title = name => ({ name, exact: true });
const dialog = (page, name) => page.getByRole('dialog', title(name));
const pause = page => dialog(page, 'Paused');
async function waitUntil(test, label, ms = 15_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await test()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out: ' + label);
}
async function checkLayout(page, target) {
  const metrics = await target.evaluate(node => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    width: node.getBoundingClientRect().width, left: node.getBoundingClientRect().left,
    right: node.getBoundingClientRect().right,
    controls: [...node.querySelectorAll('button:not(:disabled)')].map(button => {
      const rect = button.getBoundingClientRect(); return { label: button.getAttribute('aria-label') || button.textContent, w: rect.width, h: rect.height };
    }),
  }));
  assert.ok(metrics.document <= metrics.viewport + 1, 'page has horizontal overflow: ' + JSON.stringify(metrics));
  assert.ok(metrics.left >= -1 && metrics.right <= metrics.viewport + 1, 'dialog exceeds viewport');
  for (const control of metrics.controls) assert.ok(control.w >= 43.5 && control.h >= 43.5,
    'touch target below 44px: ' + JSON.stringify(control));
  return metrics;
}
async function focusTrap(page, panel) {
  const available = panel.locator('button:not(:disabled),a[href]');
  const first = available.first(), last = available.last();
  await last.focus(); await page.keyboard.press('Tab');
  assert.equal(await first.evaluate(node => node === document.activeElement), true, 'Tab wraps to first dialog control');
  await first.focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await last.evaluate(node => node === document.activeElement), true, 'Shift+Tab wraps to last dialog control');
}
async function play(page, planned) {
  for (const action of planned.actions) {
    await readyTools(page);
    await page.locator(`[data-magnet-color="${action.color}"]`).click();
    await keyboardPlace(page, action.cell);
  }
  await page.getByRole('region', title('Result')).waitFor({ timeout: 30_000 });
  assert.equal(await page.locator('.moves-panel strong').textContent(), String(planned.actions.length));
}
async function readMeta(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), META_KEY); }
async function main() {
  const planned = await gameRoute();
  const { validateTelemetryEvent } = await import(pathToFileURL(path.resolve('src/telemetry/schema.js')).href);
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const results = [];
  try {
    for (const [name, viewport, touch] of [
      ['desktop', { width: 1280, height: 900 }, false],
      ['portrait', { width: 390, height: 844 }, true],
      ['landscape', { width: 844, height: 390 }, true],
    ]) {
      const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], events = [], requests = [];
      let posts = 0, deletions = 0;
      page.on('pageerror', error => errors.push(error.message));
      await context.route(url => /\/magnet-sort-growth\/v1\/analytics\//.test(url.pathname), async interception => {
        const request = interception.request(), method = request.method();
        requests.push({ method, path: new URL(request.url()).pathname });
        const headers = { 'Access-Control-Allow-Origin': new URL(base).origin,
          'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
        if (method === 'OPTIONS') return interception.fulfill({ status: 204, headers });
        if (method === 'POST') {
          posts++;
          const payload = request.postDataJSON();
          assert.ok(Array.isArray(payload.events) && payload.events.length > 0, 'actual telemetry batch payload');
          for (const event of payload.events) {
            assert.equal(validateTelemetryEvent(event), true, 'only allowlisted valid events are sent');
            assert.equal(event.properties.environment, 'qa');
            assert.equal(event.properties.platform, 'web');
            events.push(event);
          }
        } else if (method === 'DELETE') deletions++;
        return interception.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: true }) });
      });
      const url = base + (base.includes('?') ? '&' : '?') + 'seed=' + planned.seed;
      await page.goto(url);
      await page.waitForFunction(() => !document.body.dataset.startup && !document.querySelector('.loading-screen'));
      await readyTools(page);
      assert.equal(requests.length, 0, 'no analytics HTTP before explicit consent');
      await page.getByRole('button', title('Pause')).click();
      await pause(page).getByRole('button', title('Quests & collection')).click();
      const progress = dialog(page, 'Progress and rewards');
      await progress.waitFor();
      assert.equal(await progress.locator('.growth-quest').count(), 3);
      assert.equal(await progress.locator('.growth-emblem').count(), 6);
      assert.equal(await progress.locator('.growth-frame-choice').count(), 3);
      assert.equal(await progress.locator('.growth-emblem:not(:disabled)').count(), 0);
      assert.equal(await progress.locator('.growth-frame-choice:not(:disabled)').count(), 1);
      await focusTrap(page, progress);
      const beforeLayout = await checkLayout(page, progress);
      await page.screenshot({ path: `${output}/${name}-progress.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await pause(page).waitFor();
      await pause(page).getByRole('button', title('Privacy & analytics')).click();
      const privacy = dialog(page, 'Privacy'); await privacy.waitFor();
      await focusTrap(page, privacy);
      await checkLayout(page, privacy);
      assert.equal(posts, 0, 'merely opening privacy never opts in');
      await privacy.getByRole('button', title('Allow analytics')).click();
      await waitUntil(() => posts > 0, 'opt-in analytics batch');
      assert.ok(events.some(event => event.name === 'ms_game_ready'));
      await page.screenshot({ path: `${output}/${name}-privacy.png`, fullPage: true });
      await privacy.getByRole('button', title('Disable and delete usage data')).click();
      await waitUntil(() => deletions === 1, 'server deletion request');
      await privacy.getByText('Analytics off. Previous usage data deleted.', { exact: true }).waitFor();
      const postsAfterRevoke = posts;
      await page.keyboard.press('Escape'); await pause(page).waitFor();
      await pause(page).getByRole('button', title('Resume')).click();
      await play(page, planned);
      assert.equal(posts, postsAfterRevoke, 'gameplay after revocation sends no analytics');
      await page.screenshot({ path: `${output}/${name}-win.png`, fullPage: true });
      await page.getByRole('button', title('Quests & collection')).click();
      await progress.waitFor();
      assert.equal(await progress.locator('.growth-quest .growth-count').nth(0).textContent(), '1 / 3');
      assert.equal(await progress.locator('.growth-quest .growth-count').nth(1).textContent(), `${Math.min(planned.state.cleared, 100)} / 100`);
      assert.equal(await progress.locator('.growth-emblem:not(:disabled)').count(), 1, 'one real win unlocks first emblem');
      await progress.getByRole('button', title('Violet Magnet, unlocked')).click();
      await progress.getByRole('button', title('Violet Magnet, selected')).waitFor();
      await focusTrap(page, progress); await checkLayout(page, progress);
      const saved = await readMeta(page);
      assert.equal(saved.selectedEmblem, 'violet'); assert.equal(saved.wins.length, 1);
      await page.screenshot({ path: `${output}/${name}-collection.png`, fullPage: true });
      await page.reload();
      await page.waitForFunction(() => !document.body.dataset.startup && !document.querySelector('.loading-screen'));
      await readyTools(page);
      assert.equal(await page.getByLabel('Selected collection emblem', { exact: true }).count(), 1, 'selection is visibly equipped after reload');
      const emblemBox=await page.locator('.growth-equipped-emblem').boundingBox(),brandBox=await page.locator('.brand').boundingBox();
      assert.ok(emblemBox.y<brandBox.y+brandBox.height&&emblemBox.y+emblemBox.height>brandBox.y,'equipped emblem sits by the logo');
      assert.equal(posts, postsAfterRevoke, 'reload does not re-enable revoked analytics');
      await play(page, planned);
      const repeated = await readMeta(page);
      assert.equal(repeated.wins.length, saved.wins.length, 'same board replay cannot unlock another unique win');
      assert.equal(repeated.stamps, saved.stamps, 'same board replay cannot issue another stamp');
      assert.equal(repeated.weeks[0].boards[0].bestCleared, saved.weeks[0].boards[0].bestCleared);
      assert.equal(posts, postsAfterRevoke);
      assert.deepEqual(errors, []);
      results.push({ name, viewport, movesPerWin: planned.actions.length, winsPlayed: 2, analyticsPosts: posts,
        deletionRequests: deletions, eventNames: [...new Set(events.map(event => event.name))],
        uniqueWins: repeated.wins.length, stamps: repeated.stamps, horizontalOverflow: beforeLayout.document > beforeLayout.viewport });
      await context.close();
      console.log(`Growth ${name}: PASS (two real ${planned.actions.length}-move wins, consent/delete, quests/collection, focus and layout)`);
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ at: new Date().toISOString(), base,
    mocked: 'Only analytics HTTP ingestion/deletion; no injected game state or modified saves', results }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
