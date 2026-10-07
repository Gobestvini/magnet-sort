// Optional tool: set PLAYWRIGHT_MODULE or install Playwright separately.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async () => {
  const options = { headless: true };
  if (process.env.BROWSER_CHANNEL) options.channel = process.env.BROWSER_CHANNEL;
  const browser = await chromium.launch(options);
  try {
    fs.mkdirSync('artifacts/screenshots', { recursive: true });
    for (const [name, viewport, touch] of [
      ['desktop', { width: 1280, height: 900 }, false],
      ['mobile', { width: 390, height: 844 }, true],
    ]) {
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) errors.push(`HTTP ${response.status()}`); });
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.gameDebug?.snapshot().rendererReady && window.gameDebug.snapshot().elapsed > 0);
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().canvasCount), 1);
      assert.equal(await page.locator('#game-canvas').getAttribute('data-renderer'), 'pixi');
      assert.deepEqual(await page.evaluate(() => window.gameDebug.snapshot().board), { rows: 7, cols: 7, renderedCells: 49, tokens: 1, blockers: 5 });
      const initialLayout = await page.evaluate(() => window.gameDebug.snapshot().layout);
      assert.equal(initialLayout.width, await page.locator('#game-canvas').evaluate((canvas) => canvas.clientWidth));
      assert.equal(initialLayout.height, await page.locator('#game-canvas').evaluate((canvas) => canvas.clientHeight));
      assert.ok(initialLayout.radius > 0);
      const inputPoints = await page.evaluate(() => {
        const canvas = document.querySelector('#game-canvas');
        const rect = canvas.getBoundingClientRect();
        const layout = window.gameDebug.snapshot().layout;
        const point = (col, row) => ({
          x: rect.left + layout.originX + Math.sqrt(3) * layout.radius * (col + (row % 2) / 2),
          y: rect.top + layout.originY + layout.radius * 1.5 * row,
        });
        return {
          tray: { x: rect.left + layout.width / 2, y: rect.top + Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.radius * 11 + layout.radius * 0.9) },
          target: point(3, 0), blocked: point(2, 2), occupied: point(1, 3), outside: { x: rect.left + 2, y: rect.top + 2 },
        };
      });
      if (touch) {
        await page.touchscreen.tap(inputPoints.tray.x, inputPoints.tray.y);
        await page.touchscreen.tap(inputPoints.target.x, inputPoints.target.y);
      } else {
        await page.mouse.move(inputPoints.tray.x, inputPoints.tray.y);
        await page.mouse.down();
        await page.mouse.move(inputPoints.target.x, inputPoints.target.y, { steps: 4 });
        await page.mouse.up();
      }
      await page.waitForFunction(() => window.gameDebug.snapshot().pointer.actionCount === 1);
      assert.deepEqual(await page.evaluate(() => window.gameDebug.snapshot().pointer.action), {
        type: 'placeMagnet', color: 'red', cell: { col: 3, row: 0 },
      });
      assert.match(await page.locator('#action-preview').innerText(), /без симуляции/);
      for (const location of [inputPoints.blocked, inputPoints.occupied, inputPoints.outside]) {
        if (touch) await page.touchscreen.tap(location.x, location.y);
        else await page.mouse.click(location.x, location.y);
      }
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().pointer.actionCount), 1);
      await page.evaluate((point) => {
        const canvas = document.querySelector('#game-canvas');
        const send = (type) => canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 55, isPrimary: true, pointerType: 'touch', button: 0,
          clientX: point.x, clientY: point.y,
        }));
        send('pointerdown'); send('pointermove');
      }, inputPoints.tray);
      await page.getByRole('button', { name: 'Пауза', exact: true }).click();
      const paused = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(paused.paused, true);
      assert.equal(paused.rafScheduled, false);
      assert.equal(paused.pointer.pointerId, null);
      assert.equal(paused.pointer.selectedColor, null);
      await page.waitForTimeout(150);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).elapsed, paused.elapsed);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).tickCount, paused.tickCount);
      await page.keyboard.down('KeyW');
      assert.ok((await page.evaluate(() => window.gameDebug.snapshot().keys)).includes('KeyW'));
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.deepEqual(await page.evaluate(() => window.gameDebug.snapshot().keys), []);
      await page.keyboard.up('KeyW');
      await page.getByRole('button', { name: 'Сброс', exact: true }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().elapsed), 0);
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.waitForFunction(() => window.gameDebug.snapshot().elapsed > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#game-canvas');
        const layout = window.gameDebug?.snapshot().layout;
        return canvas?.clientWidth > 300 && layout?.width === canvas.clientWidth && layout?.height === canvas.clientHeight;
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const landscapeLayout = await page.evaluate(() => {
        const canvas = document.querySelector('#game-canvas');
        return { layout: window.gameDebug.snapshot().layout, width: canvas.clientWidth, height: canvas.clientHeight };
      });
      assert.equal(landscapeLayout.layout.width, landscapeLayout.width);
      assert.equal(landscapeLayout.layout.height, landscapeLayout.height);
      await page.setViewportSize(originalViewport);
      await page.waitForFunction(() => window.gameDebug.snapshot().rafScheduled);

      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForFunction(() => !window.gameDebug.snapshot().rafScheduled);
      const hiddenElapsed = await page.evaluate(() => window.gameDebug.snapshot().elapsed);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().elapsed), hiddenElapsed);
      await page.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForFunction(() => window.gameDebug.snapshot().rafScheduled);

      // Call the same disposer that Vite invokes for HMR, then verify a fresh mount.
      await page.evaluate(() => window.gameDebug.dispose());
      await page.waitForFunction(() => !window.gameDebug && document.querySelectorAll('#game-canvas').length === 0);
      await page.reload();
      await page.waitForFunction(() => window.gameDebug?.snapshot().rendererReady && window.gameDebug.snapshot().elapsed > 0);
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().canvasCount), 1);
      await page.screenshot({ path: `artifacts/screenshots/${name}.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Desktop/mobile layout, pause/reset, input and runtime errors: passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
