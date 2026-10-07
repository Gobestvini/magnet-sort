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
      const initialState = await page.evaluate(() => window.gameDebug.snapshot().state);
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
        await page.waitForFunction(() => {
          const interaction = window.gameDebug.snapshot().interaction;
          return interaction.dragging && interaction.pointerPoint && interaction.previewCell?.col === 3 && interaction.previewCell?.row === 0;
        });
        assert.equal(await page.evaluate(() => window.gameDebug.snapshot().interaction.dragging), true);
        await page.mouse.up();
      }
      await page.waitForFunction(() => window.gameDebug.snapshot().pointer.actionCount === 1);
      await page.waitForFunction(() => window.gameDebug.snapshot().animation?.stage === 'slide');
      const moving = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(moving.phase, 'resolving');
      assert.equal(moving.animation.active, true);
      assert.equal(moving.animation.tokens.length, initialState.tokens.length);
      const blockedDuringResolve = await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'red', cell: { col: 4, row: 4 } }));
      assert.equal(blockedDuringResolve.accepted, false);
      assert.equal(blockedDuringResolve.reason, 'session-resolving');
      await page.waitForTimeout(70);
      await page.screenshot({ path: `artifacts/screenshots/${name}-resolving.png` });
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'won');
      const won = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(won.puzzleId, 'prototype-03-blocker');
      assert.equal(won.state.terminal.outcome, 'win');
      assert.equal(won.moves, 1);
      assert.equal(won.state.tokens.length, 0);
      assert.match(await page.locator('#status').innerText(), /пройден/);
      for (const location of [inputPoints.blocked, inputPoints.occupied, inputPoints.outside]) {
        if (touch) await page.touchscreen.tap(location.x, location.y);
        else await page.mouse.click(location.x, location.y);
      }
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().pointer.actionCount), 1);
      await page.getByRole('button', { name: 'Повторить уровень' }).click();
      const retried = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(retried.phase, 'playing');
      assert.equal(retried.puzzleId, won.puzzleId);
      assert.deepEqual(retried.state.tokens, initialState.tokens);
      if (!touch) {
        await page.mouse.move(inputPoints.tray.x, inputPoints.tray.y);
        await page.mouse.down();
        await page.mouse.move(inputPoints.target.x, inputPoints.target.y, { steps: 4 });
        await page.waitForFunction(() => window.gameDebug.snapshot().pointer.dragging);
      }
      if (touch) await page.getByRole('button', { name: 'Пауза', exact: true }).click();
      else await page.locator('#pause').evaluate((button) => button.click());
      const paused = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(paused.paused, true);
      assert.equal(paused.rafScheduled, false);
      assert.equal(paused.pointer.pointerId, null);
      assert.equal(paused.pointer.selectedColor, null);
      if (!touch) await page.mouse.up();
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

      await page.evaluate(() => {
        window.gameDebug.setReducedMotion(true);
        window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'red', cell: { col: 3, row: 0 } });
      });
      await page.waitForFunction(() => window.gameDebug.snapshot().animation?.active === true);
      const animationBeforeReset = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(animationBeforeReset.phase, 'resolving');
      if (touch) await page.getByRole('button', { name: 'Пауза', exact: true }).click();
      else await page.locator('#pause').evaluate((button) => button.click());
      const frozenAnimation = await page.evaluate(() => window.gameDebug.snapshot());
      await page.waitForTimeout(150);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).animation.progress, frozenAnimation.animation.progress);
      if (touch) await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      else await page.locator('#pause').evaluate((button) => button.click());
      await page.getByRole('button', { name: 'Сброс', exact: true }).click();
      const animationAfterReset = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(animationAfterReset.phase, 'playing');
      assert.equal(animationAfterReset.moves, 0);
      assert.equal(animationAfterReset.animation.active, false);
      await page.evaluate(() => window.gameDebug.setReducedMotion(false));

      const lossLevel = {
        schemaVersion: 1, rulesVersion: 1, puzzleId: 'browser-loss-fixture', seed: 'browser-loss-v1', contentVersion: 1,
        geometry: { kind: 'odd-r', rows: 7, cols: 7 }, colors: ['red', 'blue', 'yellow'], blockedCells: [],
        tokens: [{ tokenId: 'small-red', color: 'red', mass: 1, cell: { col: 0, row: 0 } }],
        goal: { kind: 'clearCount', mass: 2 }, moveLimit: 1, magnetSchedule: [{ options: ['red'] }], mode: 'prototype',
      };
      await page.evaluate((level) => window.gameDebug.loadTestLevel(level), lossLevel);
      await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'red', cell: { col: 6, row: 6 } }));
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'lost');
      const lost = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(lost.state.terminal.reason, 'move-limit');
      assert.equal(lost.moves, 1);
      await page.getByRole('button', { name: 'Повторить уровень' }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().phase), 'playing');
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().puzzleId), 'browser-loss-fixture');
      await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'red', cell: { col: 6, row: 6 } }));
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'lost');
      await page.getByRole('button', { name: 'Следующий уровень' }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().puzzleId), 'prototype-01-clear-all');

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
