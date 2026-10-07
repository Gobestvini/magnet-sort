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
      if (touch) await page.addInitScript(() => { if (!localStorage.getItem('magnet-sort.progress')) localStorage.setItem('magnet-sort.progress', '{'); });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) errors.push(`HTTP ${response.status()}`); });
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.gameDebug?.snapshot().rendererReady);
      assert.equal(await page.getByRole('region', { name: 'Главное меню' }).count(), 1);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).screen, 'home');
      assert.equal(await page.locator('[aria-label="Ежедневное поле скоро появится"]').isDisabled(), true);
      assert.equal(await page.locator('[aria-label="Испытание с другом скоро появится"]').isDisabled(), true);
      if (!touch) {
        await page.getByLabel('Уменьшить движение').check();
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot().progress)).settings.reducedMotion, true);
      } else {
        assert.equal((await page.evaluate(() => window.gameDebug.snapshot().progress)).unlockedCampaignLevel, 1);
      }
      await page.getByRole('button', { name: 'Играть' }).click();
      await page.waitForFunction(() => window.gameDebug.snapshot().elapsed > 0);
      const firstLaunch = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(firstLaunch.tutorial.active, true);
      assert.equal(firstLaunch.puzzleId, 'ftue-01-place');
      assert.equal(await page.locator('.tutorial-panel h2').innerText(), 'Поставь магнит');
      assert.equal(firstLaunch.moves, 0);
      const lessonTarget = await page.evaluate(() => {
        const canvas = document.querySelector('#game-canvas');
        const rect = canvas.getBoundingClientRect();
        const layout = window.gameDebug.snapshot().layout;
        return { x: rect.left + layout.originX + Math.sqrt(3) * layout.radius * 3.5,
          y: rect.top + layout.originY + layout.radius * 4.5 };
      });
      const lessonTray = await page.evaluate(() => {
        const canvas = document.querySelector('#game-canvas');
        const rect = canvas.getBoundingClientRect();
        const layout = window.gameDebug.snapshot().layout;
        return { x: rect.left + layout.width / 2, y: rect.top + Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.radius * 11 + layout.radius * 0.9) };
      });
      if (touch) {
        await page.touchscreen.tap(lessonTray.x, lessonTray.y);
        await page.touchscreen.tap(lessonTarget.x, lessonTarget.y);
      } else {
        await page.mouse.move(lessonTray.x, lessonTray.y); await page.mouse.down();
        await page.mouse.move(lessonTarget.x, lessonTarget.y, { steps: 4 }); await page.mouse.up();
      }
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'won');
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).tutorial.completed, false);
      const savedFtue = await page.evaluate(() => window.gameDebug.snapshot().progress);
      assert.equal(savedFtue.completedPuzzles.includes('ftue-01-place'), true);
      assert.equal(savedFtue.ftue.unlockedLesson, 2);
      if (!touch) assert.equal(savedFtue.settings.reducedMotion, true);
      await page.reload();
      await page.waitForFunction(() => window.gameDebug?.snapshot().rendererReady);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).screen, 'home');
      assert.equal(await page.getByRole('button', { name: 'Продолжить' }).count(), 1, JSON.stringify(await page.evaluate(() => ({ progress: window.gameDebug.snapshot().progress, stored: localStorage.getItem('magnet-sort.progress') }))));
      await page.getByRole('button', { name: 'Продолжить' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).puzzleId, 'ftue-02-pull');
      await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'yellow', cell: { col: 4, row: 3 } }));
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'won');
      await page.getByRole('button', { name: 'Следующий урок' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).puzzleId, 'ftue-03-merge');
      await page.getByRole('button', { name: 'Пропустить обучение' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).tutorial.skipped, true);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).puzzleId, 'campaign-06');
      const campaignSix = await page.evaluate(async () => (await import('/src/levels/campaign/campaign-06.json')).default);
      await page.evaluate((level) => window.gameDebug.playTestAction(level.solution.actions[0]), campaignSix);
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'won');
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).progress.unlockedCampaignLevel, 7);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(value) { window.__challengeUrl = value; } } });
      });
      assert.equal(await page.locator('.challenge-card-preview').count(), 1);
      await page.getByRole('button', { name: 'Поделиться вызовом' }).click();
      await page.waitForFunction(() => document.querySelector('.challenge-share-status')?.textContent === 'Ссылка скопирована.');
      const challengeUrl = await page.evaluate(() => window.__challengeUrl);
      assert.ok(challengeUrl.includes('?challenge='));
      const challengePage = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      challengePage.on('pageerror', error => errors.push(error.message));
      challengePage.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await challengePage.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(value) { window.__replyUrl = value; } } });
      });
      await challengePage.goto(challengeUrl);
      await challengePage.waitForFunction(() => window.gameDebug?.snapshot().rendererReady);
      assert.equal((await challengePage.evaluate(() => window.gameDebug.snapshot())).screen, 'challenge');
      assert.equal((await challengePage.evaluate(() => window.gameDebug.snapshot())).puzzleId, 'campaign-06');
      assert.equal((await challengePage.evaluate(() => window.gameDebug.snapshot())).tutorial.active, false);
      assert.equal(await challengePage.locator('.challenge-entry button').count(), 1);
      assert.equal(await challengePage.getByRole('button', { name: 'Домой' }).count(), 0);
      await challengePage.screenshot({ path: `artifacts/screenshots/${name}-challenge-entry.png` });
      await challengePage.getByRole('button', { name: 'Играть' }).click();
      assert.equal((await challengePage.evaluate(() => window.gameDebug.snapshot())).screen, 'game');
      assert.equal((await challengePage.evaluate(() => window.gameDebug.snapshot())).challenge, true);
      await challengePage.evaluate((level) => window.gameDebug.playTestAction(level.solution.actions[0]), campaignSix);
      await challengePage.waitForFunction(() => window.gameDebug.snapshot().phase === 'won');
      assert.match(await challengePage.locator('.challenge-result-comparison').innerText(), /побил|Ничья|выше/);
      await challengePage.screenshot({ path: `artifacts/screenshots/${name}-challenge-result.png` });
      assert.equal((await challengePage.evaluate(() => window.gameDebug.snapshot())).progress.completedPuzzles.includes('campaign-06'), false);
      await challengePage.getByRole('button', { name: 'Ответить вызовом' }).click();
      await challengePage.waitForFunction(() => document.querySelector('.challenge-share-status')?.textContent === 'Ссылка скопирована.');
      const replyLink = await challengePage.evaluate(() => window.__replyUrl);
      assert.ok(replyLink.includes('?challenge='));
      await challengePage.close();
      await page.getByRole('button', { name: 'Повторить уровень' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).puzzleId, 'campaign-06');
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).moves, 0);
      await page.evaluate((level) => window.gameDebug.playTestAction(level.solution.actions[0]), campaignSix);
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'won');
      await page.getByRole('button', { name: 'Домой' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).screen, 'home');
      await page.getByRole('button', { name: 'Продолжить' }).click();
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).puzzleId, 'campaign-07');
      const blockerLevel = await page.evaluate(async () => (await import('/src/levels/prototype/prototype-03-blocker.json')).default);
      await page.evaluate((level) => window.gameDebug.loadTestLevel(level), blockerLevel);
      await page.waitForFunction(() => window.gameDebug.snapshot().elapsed > 0);
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
        await page.screenshot({ path: `artifacts/screenshots/${name}-dragging.png` });
        await page.mouse.up();
      }
      await page.waitForFunction(() => window.gameDebug.snapshot().pointer.actionCount === 1);
      await page.waitForFunction(() => window.gameDebug.snapshot().animation?.stage === 'slide');
      const moving = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(moving.phase, 'resolving');
      assert.equal(moving.animation.active, true);
      assert.equal(moving.result, null);
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
      assert.deepEqual(won.result && {
        score: won.result.score, movesUsed: won.result.movesUsed, clearPercent: won.result.clearPercent,
        activeTimeMs: won.result.activeTimeMs, outcome: won.result.outcome,
      }, { score: 500, movesUsed: 1, clearPercent: 100, activeTimeMs: won.result.activeTimeMs, outcome: 'win' });
      assert.ok(won.result.activeTimeMs > 0);
      const resultText = await page.locator('.result-card').innerText();
      assert.match(resultText, /500 очков/);
      assert.match(resultText, /100%/);
      assert.match(resultText, /Цепочки/);
      assert.deepEqual(await page.locator('.result-actions button').allTextContents(), ['Следующий уровень', 'Повторить уровень', 'Домой']);
      await page.screenshot({ path: `artifacts/screenshots/${name}-result.png` });
      const resultViewport = await page.locator('.result-card').evaluate((card) => ({
        bottom: card.getBoundingClientRect().bottom, height: card.getBoundingClientRect().height,
        innerHeight, scrollY, shellHeight: document.querySelector('.app-shell').getBoundingClientRect().height,
      }));
      assert.ok(resultViewport.bottom <= resultViewport.innerHeight, JSON.stringify(resultViewport));
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
      assert.equal(retried.result, null);
      assert.equal(retried.activeTimeMs, 0);
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
      const stillPaused = await page.evaluate(() => window.gameDebug.snapshot());
      assert.equal(stillPaused.animation.progress, frozenAnimation.animation.progress);
      assert.equal(stillPaused.activeTimeMs, frozenAnimation.activeTimeMs);
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
      assert.equal(lost.result.outcome, 'loss');
      assert.equal(lost.result.clearPercent, 0);
      assert.match(await page.locator('.result-card').innerText(), /Цель не достигнута/);
      assert.deepEqual(await page.locator('.result-actions button').allTextContents(), ['Попробовать ещё раз', 'Следующий уровень', 'Домой']);
      await page.getByRole('button', { name: 'Попробовать ещё раз' }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().phase), 'playing');
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().puzzleId), 'browser-loss-fixture');
      await page.evaluate(() => window.gameDebug.playTestAction({ type: 'placeMagnet', color: 'red', cell: { col: 6, row: 6 } }));
      await page.waitForFunction(() => window.gameDebug.snapshot().phase === 'lost');
      await page.getByRole('button', { name: 'Следующий уровень' }).click();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().puzzleId), 'prototype-02-clear-count');

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
      await page.waitForFunction(() => window.gameDebug?.snapshot().rendererReady);
      assert.equal((await page.evaluate(() => window.gameDebug.snapshot())).screen, 'home');
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().canvasCount), 1);
      await page.screenshot({ path: `artifacts/screenshots/${name}.png` });
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Desktop/mobile layout, pause/reset, input and runtime errors: passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
