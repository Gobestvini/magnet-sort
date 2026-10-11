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
      const magnetSize = () => page.locator('[data-magnet-color="violet"]>img').first().evaluate(img => ({ width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height }));
      const assertDragSize = async expected => {
        const actual = await page.locator('.drag-magnet').evaluate(img => ({ width: parseFloat(getComputedStyle(img).width), height: parseFloat(getComputedStyle(img).height), scale: Math.hypot(new DOMMatrixReadOnly(getComputedStyle(img).transform).a, new DOMMatrixReadOnly(getComputedStyle(img).transform).b) }));
        assert.ok(Math.abs(actual.width - expected.width) < .1, 'pickup and drag preserve magnet width');
        assert.ok(Math.abs(actual.height - expected.height) < .1, 'pickup and drag preserve magnet height');
        assert.ok(Math.abs(actual.scale - 1) < .001, 'drag never enlarges the magnet');
      };
      const at = cell => page.evaluate(cell => window.gameDebug.screenPosition(cell), cell);
      const clickCell = async cell => { const pos = await at(cell); if (touch) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y); };
      const settled = () => page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'resolving', null, { timeout: 20000 });
      assert.equal((await snap()).canvasCount, 1);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.evaluate(() => /[А-Яа-яЁё]/.test(document.body.innerText)), false, 'live UI is English');
      assert.equal(await page.getByText('Preparing the board…', { exact: true }).count(), 0, 'boot message is replaced');
      assert.equal((await snap()).renderer.meshes, 12);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-initial.png`, fullPage: true });

      await clickCell({ col: 2, row: 2 });
      assert.equal((await snap()).state.turn, 0, 'occupied placement rejected');
      const initialMagnetSize = await magnetSize();
      await page.getByRole('button', { name: 'Violet magnet', exact: true }).click();
      assert.deepEqual(await magnetSize(), initialMagnetSize, 'click preserves tray magnet size');
      await clickCell({ col: 3, row: 3 });
      assert.equal((await snap()).phase, 'resolving');
      assert.equal((await snap()).state.turn, 1);
      assert.equal(await page.getByRole('region', { name: 'Result', exact: true }).count(), 0, 'result waits for last landing');
      await page.waitForFunction(() => window.gameDebug.snapshot().timeline?.activeUnits > 1);
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-transfer.png`, fullPage: true });
      assert.equal((await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'violet', cell: { col: 1, row: 1 } }))).accepted, false);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      assert.equal(await page.getByRole('dialog', { name: 'Paused', exact: true }).count(), 1);
      assert.equal(await page.locator('.game-view').evaluate(node => node.inert), true, 'pause blocks background controls');
      assert.equal((await snap()).renderer.glow.visible, false, 'pause hides the active magnetic field');
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-paused.png`, fullPage: true });
      const pausedTime = (await snap()).timeline.elapsed;
      await page.waitForTimeout(220);
      assert.equal((await snap()).timeline.elapsed, pausedTime);
      assert.equal((await snap()).rafScheduled, false);
      await page.getByRole('button', { name: 'Resume', exact: true }).last().click();
      await settled();
      assert.equal((await snap()).phase, 'won');
      assert.equal((await snap()).renderer.glow.visible, false, 'finished chain removes the magnetic field');
      assert.equal((await snap()).renderer.meshes, 0);
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-won.png`, fullPage: true });
      await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
      assert.equal((await snap()).levelIndex, 1);

      // Mouse drag from a DOM tool to a raycast tile; touch tap is covered above.
      const tool = await page.getByRole('button', { name: 'Violet magnet', exact: true }).boundingBox();
      const trayMagnetSize = await magnetSize();
      const target = await at({ col: 3, row: 3 });
      await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
      await page.mouse.down();
      await assertDragSize(trayMagnetSize);
      assert.equal(await page.locator('[data-magnet-color="violet"]>img').first().isVisible(), false, 'pickup hides the tray magnet immediately');
      await page.mouse.move(target.x - 100, target.y + 40, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.move(target.x, target.y);
      const movingDrag = (await snap()).drag;
      assert.ok(movingDrag && !movingDrag.released);
      assert.ok(Math.hypot(movingDrag.x - movingDrag.targetX, movingDrag.y - movingDrag.targetY) > 5, 'held magnet has inertia');
      assert.equal(await page.locator('.drag-magnet').isVisible(), true);
      assert.equal((await snap()).renderer.glow.visible, true, 'free tile emits light under the held magnet');
      assert.equal((await snap()).renderer.glow.particles, 9);
      await page.waitForTimeout(80);
      await assertDragSize(trayMagnetSize);
      await page.screenshot({ path: `${output}/${name}-inertial-drag.png`, fullPage: true });
      await page.mouse.up();
      await assertDragSize(trayMagnetSize);
      assert.equal((await snap()).phase, 'resolving');
      assert.equal((await snap()).drag.released, true, 'magnet springs into the chosen tile');
      assert.equal((await snap()).renderer.glow.working, true, 'release starts the magnetic field at the placed magnet');
      assert.equal((await snap()).renderer.glow.waves, 3, 'three waves converge while the magnet works');
      await page.getByRole('button', { name: 'Restart', exact: true }).click();
      assert.equal((await snap()).phase, 'playing');
      assert.equal((await snap()).timeline, null);
      assert.equal((await snap()).renderer.glow.working, false, 'restart cancels the magnetic field');
      assert.equal((await snap()).drag, null, 'reset cancels spring physics');
      assert.equal(await page.locator('[data-magnet-color="violet"]>img').first().isVisible(), true, 'reset restores the tray magnet');
      assert.equal((await snap()).state.turn, 0);
      assert.equal((await snap()).renderer.meshes, 18);
      await page.waitForTimeout(200);
      assert.equal((await snap()).state.turn, 0, 'cancelled timeline never completes into a stale result');

      // Invalid release returns to the tray without spending a move or leaving RAF alive.
      await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
      await page.mouse.down(); await page.mouse.move(5, 5, { steps: 8 }); await page.mouse.up();
      assert.equal((await snap()).state.turn, 0);
      assert.equal((await snap()).drag.released, true);
      await page.waitForFunction(() => !window.gameDebug.snapshot().drag);
      assert.equal((await snap()).rafScheduled, false);
      assert.equal(await page.locator('.drag-magnet').isVisible(), false);
      assert.equal(await page.locator('[data-magnet-color="violet"]>img').first().isVisible(), true, 'return restores the tray magnet');

      await page.evaluate(() => window.gameDebug.setReducedMotion(true));
      await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
      await page.mouse.down(); await page.mouse.move(target.x, target.y);
      assert.equal((await snap()).renderer.glow.visible, true);
      assert.equal((await snap()).renderer.glow.particles, 0, 'reduced motion keeps only a static halo');
      await page.mouse.move(5, 5);
      assert.equal((await snap()).renderer.glow.visible, false, 'no glow outside a valid tile');
      await page.mouse.up();
      await page.evaluate(() => { window.gameDebug.reset(); window.gameDebug.setReducedMotion(false); });

      if (touch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tool.x + tool.width / 2, y: tool.y + tool.height / 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x, y: target.y }] });
        assert.ok((await snap()).drag, 'touch swipe picks up the magnet');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal((await snap()).state.turn, 1, 'touch drag places exactly once');
        await page.evaluate(() => window.gameDebug.reset());
        await cdp.detach();
      }

      await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
      await page.mouse.down(); await page.mouse.move(target.x, target.y);
      await page.evaluate(() => window.gameDebug.setPaused(true));
      assert.equal((await snap()).drag, null, 'pause cancels a held magnet');
      assert.equal((await snap()).renderer.glow.visible, false, 'pause removes the light column');
      assert.equal(await page.locator('[data-magnet-color="violet"]').getAttribute('data-dragging'), null, 'pause restores the tray icon');
      assert.equal((await snap()).rafScheduled, false);
      await page.mouse.up();
      await page.evaluate(() => window.gameDebug.setPaused(false));
      assert.equal((await snap()).state.turn, 0);

      // A selected magnet can also be dragged directly across the board.
      const boardStart = await at({ col: 1, row: 1 });
      await page.mouse.move(boardStart.x, boardStart.y); await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 5 }); await page.mouse.up();
      assert.equal((await snap()).state.turn, 1);
      await page.evaluate(() => window.gameDebug.reset());

      const cancelTarget = await at({ col: 3, row: 3 });
      await page.mouse.move(cancelTarget.x, cancelTarget.y); await page.mouse.down();
      assert.equal((await snap()).gesture, true);
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 999 })));
      assert.equal((await snap()).gesture, true, 'a second pointer cannot cancel the captured primary gesture');
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.gameDebug.snapshot().pointerId })));
      await page.mouse.up();
      assert.equal((await snap()).gesture, false);
      assert.equal((await snap()).state.turn, 0, 'cancelled pointer spends no move');

      await page.getByRole('button', { name: 'Hint', exact: true }).click();
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-hint.png`, fullPage: true });
      await page.locator('canvas').focus(); await page.keyboard.press('Enter');
      assert.equal((await snap()).phase, 'resolving');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal((await snap()).paused, true);
      const blurTime = (await snap()).timeline.elapsed;
      await page.waitForTimeout(100);
      assert.equal((await snap()).timeline.elapsed, blurTime);
      await page.evaluate(() => window.gameDebug.setPaused(false));
      await settled();

      await page.getByRole('button', { name: 'Blue magnet', exact: true }).click();
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

      // Pause contains only game actions; reduced motion remains supported by the runtime.
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      assert.equal(await page.getByLabel('Reduced motion').count(), 0, 'pause has no reduced-motion setting');
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.evaluate(() => window.gameDebug.setReducedMotion(true));
      // Replay each authored puzzle, including the mixed-colour lower layers.
      for (let index = 0; index < 3; index++) {
        await page.evaluate(index => window.gameDebug.loadLevel(index), index);
        const level = await page.evaluate(() => window.gameDebug.getLevel());
        for (const command of level.solution) {
          await page.getByRole('button', { name: `${({ violet: 'Violet', blue: 'Blue', coral: 'Coral' })[command.color]} magnet`, exact: true }).click();
          await clickCell(command.cell);
          const field = (await snap()).renderer.glow;
          assert.equal(field.working, true, 'reduced motion preserves placement feedback');
          assert.equal(field.waves, 0, 'reduced motion disables field waves');
          assert.equal(field.particles, 0, 'reduced motion disables orbiting sparks');
          await settled();
        }
        assert.equal((await snap()).phase, 'won');
      }

      await page.evaluate(() => window.gameDebug.loadLevel(2));
      const baseline = (await snap()).renderer.geometries;
      const baselineTextures = (await snap()).renderer.textures;
      for (let i = 0; i < 20; i++) await page.evaluate(() => window.gameDebug.reset());
      assert.equal((await snap()).renderer.geometries, baseline, 'reset reuses GPU geometry');
      assert.equal((await snap()).renderer.textures, baselineTextures, 'reset reuses artwork textures');
      assert.equal((await snap()).canvasCount, 1);
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-mixed.png`, fullPage: true });
      if (touch) {
        await page.setViewportSize({ width: 844, height: 390 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await clickCell({ col: 3, row: 3 }); await settled();
        assert.equal((await snap()).state.turn, 1, 'raycast survives orientation resize');
        await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/landscape.png`, fullPage: true });
      }
      // Invalid/no-effect colour placements exhaust the limit without phantom victory.
      await page.evaluate(() => window.gameDebug.loadLevel(2));
      for (const cell of [{ col: 3, row: 3 }, { col: 5, row: 5 }, { col: 4, row: 5 }, { col: 5, row: 4 }, { col: 4, row: 4 }]) {
        await page.evaluate(cell => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'violet', cell }), cell);
        await settled();
      }
      assert.equal((await snap()).phase, 'lost');
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({ path: `${output}/${name}-lost.png`, fullPage: true });
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
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
