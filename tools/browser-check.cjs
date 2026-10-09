// Three.js v3 prototype. The previous MVP suite is legacy-browser-check.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
const output = 'artifacts/three-browser';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  fs.mkdirSync(output, { recursive: true });
  const reports = [];
  try {
    for (const [name, viewport, touch] of [['desktop', { width: 1280, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.gameDebug?.snapshot().renderer?.engine === 'Three.js');
      await page.evaluate(() => document.fonts.ready);
      const snap = () => page.evaluate(() => window.gameDebug.snapshot());
      const at = cell => page.evaluate(cell => window.gameDebug.screenPosition(cell), cell);
      const clickCell = async cell => { const pos = await at(cell); if (touch) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y); };
      const settled = () => page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'resolving', null, { timeout: 20000 });
      assert.equal((await snap()).canvasCount, 1);
      assert.equal((await snap()).renderer.meshes, 12);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/${name}-initial.png`, fullPage: true });

      await clickCell({ col: 2, row: 2 });
      assert.equal((await snap()).state.turn, 0, 'occupied placement rejected');
      await page.getByRole('button', { name: 'Фиолетовый магнит', exact: true }).click();
      await clickCell({ col: 3, row: 3 });
      assert.equal((await snap()).phase, 'resolving');
      assert.equal((await snap()).state.turn, 1);
      assert.equal(await page.getByRole('region', { name: 'Результат', exact: true }).count(), 0, 'result waits for last landing');
      await page.waitForFunction(() => window.gameDebug.snapshot().timeline?.activeUnits > 1);
      await page.screenshot({ path: `${output}/${name}-transfer.png`, fullPage: true });
      assert.equal((await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'violet', cell: { col: 1, row: 1 } }))).accepted, false);
      await page.getByRole('button', { name: 'Пауза', exact: true }).click();
      const pausedTime = (await snap()).timeline.elapsed;
      await page.waitForTimeout(220);
      assert.equal((await snap()).timeline.elapsed, pausedTime);
      assert.equal((await snap()).rafScheduled, false);
      await page.getByRole('button', { name: 'Продолжить', exact: true }).last().click();
      await settled();
      assert.equal((await snap()).phase, 'won');
      assert.equal((await snap()).renderer.meshes, 0);
      await page.screenshot({ path: `${output}/${name}-won.png`, fullPage: true });
      await page.getByRole('button', { name: 'Следующее поле →', exact: true }).click();
      assert.equal((await snap()).levelIndex, 1);

      // Mouse drag from a DOM tool to a raycast tile; touch tap is covered above.
      const tool = await page.getByRole('button', { name: 'Фиолетовый магнит', exact: true }).boundingBox();
      const target = await at({ col: 3, row: 3 });
      await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
      await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 9 }); await page.mouse.up();
      assert.equal((await snap()).phase, 'resolving');
      await page.getByRole('button', { name: '↻ Начать заново', exact: true }).click();
      assert.equal((await snap()).phase, 'playing');
      assert.equal((await snap()).timeline, null);
      assert.equal((await snap()).state.turn, 0);
      assert.equal((await snap()).renderer.meshes, 18);
      await page.waitForTimeout(200);
      assert.equal((await snap()).state.turn, 0, 'cancelled timeline never completes into a stale result');

      const cancelTarget = await at({ col: 3, row: 3 });
      await page.mouse.move(cancelTarget.x, cancelTarget.y); await page.mouse.down();
      assert.equal((await snap()).gesture, true);
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 999 })));
      assert.equal((await snap()).gesture, true, 'a second pointer cannot cancel the captured primary gesture');
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.gameDebug.snapshot().pointerId })));
      await page.mouse.up();
      assert.equal((await snap()).gesture, false);
      assert.equal((await snap()).state.turn, 0, 'cancelled pointer spends no move');

      await page.getByRole('button', { name: '✧ Подсказка', exact: true }).click();
      await page.locator('canvas').focus(); await page.keyboard.press('Enter');
      assert.equal((await snap()).phase, 'resolving');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal((await snap()).paused, true);
      const blurTime = (await snap()).timeline.elapsed;
      await page.waitForTimeout(100);
      assert.equal((await snap()).timeline.elapsed, blurTime);
      await page.evaluate(() => window.gameDebug.setPaused(false));
      await settled();

      await page.getByRole('button', { name: 'Голубой магнит', exact: true }).click();
      await clickCell({ col: 3, row: 3 });
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const hiddenTime = (await snap()).timeline.elapsed;
      await page.waitForTimeout(100);
      assert.equal((await snap()).paused, true);
      assert.equal((await snap()).timeline.elapsed, hiddenTime);
      await page.evaluate(() => { delete document.hidden; window.gameDebug.setPaused(false); });
      await settled();

      await page.getByLabel('Меньше движения').check();
      // Replay each authored puzzle, including the mixed-colour lower layers.
      for (let index = 0; index < 3; index++) {
        await page.evaluate(index => window.gameDebug.loadLevel(index), index);
        const level = await page.evaluate(() => window.gameDebug.getLevel());
        for (const command of level.solution) {
          await page.getByRole('button', { name: `${({ violet: 'Фиолетовый', blue: 'Голубой', coral: 'Коралловый' })[command.color]} магнит`, exact: true }).click();
          await clickCell(command.cell); await settled();
        }
        assert.equal((await snap()).phase, 'won');
      }

      await page.evaluate(() => window.gameDebug.loadLevel(2));
      const baseline = (await snap()).renderer.geometries;
      const baselineTextures = (await snap()).renderer.textures;
      for (let i = 0; i < 20; i++) await page.evaluate(() => window.gameDebug.reset());
      assert.equal((await snap()).renderer.geometries, baseline, 'reset reuses GPU geometry');
      assert.equal((await snap()).renderer.textures, baselineTextures, 'reset reuses shadow targets');
      assert.equal((await snap()).canvasCount, 1);
      await page.screenshot({ path: `${output}/${name}-mixed.png`, fullPage: true });
      if (touch) {
        await page.setViewportSize({ width: 844, height: 390 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await clickCell({ col: 3, row: 3 }); await settled();
        assert.equal((await snap()).state.turn, 1, 'raycast survives orientation resize');
        await page.screenshot({ path: `${output}/landscape.png`, fullPage: true });
      }
      // Invalid/no-effect colour placements exhaust the limit without phantom victory.
      await page.evaluate(() => window.gameDebug.loadLevel(2));
      for (const cell of [{ col: 3, row: 3 }, { col: 5, row: 5 }, { col: 4, row: 5 }, { col: 5, row: 4 }, { col: 4, row: 4 }]) {
        await page.evaluate(cell => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'violet', cell }), cell);
        await settled();
      }
      assert.equal((await snap()).phase, 'lost');
      await page.getByRole('button', { name: 'Попробовать ещё раз', exact: true }).click();
      assert.equal((await snap()).phase, 'playing');
      // Surrogate hidden event exercises lifecycle handling without claiming a real device/tab test.
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal((await snap()).paused, true);
      assert.equal((await snap()).rafScheduled, false);
      await page.evaluate(() => { delete document.hidden; window.gameDebug.dispose(); });
      assert.equal(await page.locator('canvas').count(), 0);
      assert.equal(await page.evaluate(() => typeof window.gameDebug), 'undefined');
      assert.deepEqual(errors, []);
      reports.push({ name, errors, geometryStableAfterResets: baseline, scenarios: 'tap, drag, invalid, lock, pause/resume, reset-mid-transfer, pointercancel, blur, synthetic hidden, keyboard, authored solutions, reduced motion, loss/retry, resize, dispose' });
      await page.close();
    }
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(reports, null, 2));
    console.log('Three.js desktop and mobile viewport browser checks passed; real-device performance not measured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
