// Exercise the production build under the same subpath as GitHub Pages.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const prefix = '/magnet-sort/';
const dist = path.resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

(async () => {
  let server, browser;
  try {
    let base = process.env.GAME_BASE_URL;
    if (!base) {
      server = http.createServer((req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(dist, pathname.slice(prefix.length) || 'index.html');
        if (!pathname.startsWith(prefix) || !file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.writeHead(404); res.end(); return;
        }
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${server.address().port}${prefix}`;
    }
    browser = await chromium.launch({ headless: true });
    fs.mkdirSync('artifacts/pages-browser', { recursive: true });
    for (const [name, viewport, touch] of [['desktop', { width: 1280, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
      page.on('requestfailed', request => errors.push(`${request.failure().errorText}: ${request.url()}`));
      await page.goto(base);
      await page.getByRole('button', { name: 'Violet magnet', exact: true }).waitFor();
      await page.waitForFunction(() => !document.querySelector('.loading-screen'));
      assert.equal(await page.getByRole('dialog', { name: 'Launch error' }).count(), 0, errors.join('\n'));
      await page.locator('img[src]').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.equal(await page.locator('canvas').count(), 1);
      await page.screenshot({ path: `artifacts/pages-browser/${name}.png` });
      // Use the visible tutorial arrow to tap the authored first placement.
      const target = await page.locator('.tutorial-arrow').evaluate(image => {
        const host = image.parentElement.getBoundingClientRect();
        return { x: host.left + parseFloat(image.style.left) + 22, y: host.top + parseFloat(image.style.top) + 5 };
      });
      if (touch) await page.touchscreen.tap(target.x, target.y);
      else await page.mouse.click(target.x, target.y);
      await page.getByRole('region', { name: 'Result', exact: true }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'Play again', exact: true }).click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('dialog', { name: 'Paused', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Pages production launch, decoded images, first-board victory, reset and pause passed (desktop/mobile viewport).');
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
