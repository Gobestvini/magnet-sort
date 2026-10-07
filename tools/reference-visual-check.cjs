const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const baseUrl = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const levels = fs.readdirSync('src/levels/campaign').map(name => JSON.parse(fs.readFileSync('src/levels/campaign/' + name, 'utf8')));
    const level = levels.sort((a, b) => b.tokens.length - a.tokens.length)[0];
    fs.mkdirSync('artifacts/screenshots', { recursive: true });
    for (const [name, viewport] of [['reference-mobile', { width: 390, height: 844 }], ['reference-desktop', { width: 1280, height: 900 }]]) {
      const touch = name === 'reference-mobile';
      const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.gameDebug?.snapshot().rendererReady);
      await page.screenshot({ path: 'artifacts/screenshots/' + name + '-home.png' });
      await page.getByRole('button', { name: 'Играть', exact: true }).click();
      await page.evaluate(level => { window.gameDebug.setReducedMotion(false); window.gameDebug.loadTestLevel(level); }, level);
      await page.waitForTimeout(150);
      await page.screenshot({ path: 'artifacts/screenshots/' + name + '-board.png' });
      const action = level.solution.actions[0];
      await page.locator('.magnet-choice-' + action.color).click();
      const points = await page.evaluate(action => {
        const rect = document.querySelector('#game-canvas').getBoundingClientRect();
        const tool = document.querySelector('.magnet-choice-' + action.color).getBoundingClientRect();
        const l = window.gameDebug.snapshot().layout;
        return {
          tray: { x: tool.left + tool.width / 2, y: tool.top + tool.height / 2 },
          cell: { x: rect.left + l.originX + l.radius * 1.5 * action.cell.row, y: rect.top + l.originY + Math.sqrt(3) * l.radius * (action.cell.col + action.cell.row % 2 / 2) },
        };
      }, action);
      const cdp = touch ? await page.context().newCDPSession(page) : null;
      if (touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points.tray] });
        for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
          x: points.tray.x + (points.cell.x - points.tray.x) * step / 10,
          y: points.tray.y + (points.cell.y - points.tray.y) * step / 10,
        }] });
      } else {
        await page.mouse.move(points.tray.x, points.tray.y);
        await page.mouse.down();
        await page.mouse.move(points.cell.x, points.cell.y, { steps: 10 });
      }
      await page.waitForFunction(() => window.gameDebug.snapshot().interaction.dragging);
      await page.screenshot({ path: 'artifacts/screenshots/' + name + '-drag.png' });
      if (touch) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); }
      else await page.mouse.up();
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().pointer.actionCount), 1);
      await page.waitForTimeout(80);
      await page.screenshot({ path: 'artifacts/screenshots/' + name + '-pull.png' });
      await page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'resolving');
      for (const action of level.solution.actions.slice(1)) {
        await page.evaluate(action => window.gameDebug.playTestAction(action), action);
        await page.waitForFunction(() => window.gameDebug.snapshot().phase !== 'resolving');
      }
      await page.screenshot({ path: 'artifacts/screenshots/' + name + '-result.png' });
      assert.equal(await page.evaluate(() => window.gameDebug.snapshot().phase), 'won');
      console.log(JSON.stringify({ name, puzzle: level.puzzleId, tokens: level.tokens.length, phase: await page.evaluate(() => window.gameDebug.snapshot().phase), errors }));
      if (errors.length) throw new Error(errors.join('\n'));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
