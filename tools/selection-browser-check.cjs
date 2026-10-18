// Dev integration checks for the unselected state between completed turns.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { route, readyTools, keyboardPlace } = require('./v4-browser-check.cjs');
const output = 'artifacts/selection-browser';
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const planned = await route(), browser = await chromium.launch();
  try {
    for (const [name,viewport,touch,reducedMotion] of [
      ['desktop',{width:1280,height:900},false,'no-preference'],
      ['mobile',{width:390,height:844},true,'reduce']
    ]) {
      const page = await browser.newPage({viewport,hasTouch:touch,isMobile:touch,reducedMotion});
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5182/')+'?seed='+planned.seed);
      await page.waitForFunction(()=>!document.body.dataset.startup && window.gameDebug && !gameDebug.snapshot().loading);
      const action=planned.actions[0];
      await page.locator(`[data-magnet-color="${action.color}"]`).click();
      const target=await page.evaluate(cell=>gameDebug.screenPosition(cell),action.cell);
      if(touch)await page.touchscreen.tap(target.x,target.y);
      else await page.mouse.click(target.x,target.y);
      await readyTools(page);
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().state.turn),1);
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().selected),null);
      assert.equal(await page.locator('.magnet-tool.is-selected, .magnet-tool[aria-pressed="true"]').count(),0);
      const free=await page.evaluate(()=>{
        const legal=new Set(gameDebug.legalCells());
        const cell=gameDebug.snapshot().state.cells.find(cell=>legal.has(`r${cell.row}c${cell.col}`));
        return {cell,...gameDebug.screenPosition(cell)};
      });
      await page.mouse.move(free.x,free.y); await page.mouse.down();
      await page.mouse.move(free.x+20,free.y+20,{steps:4});
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().drag),null,'no ghost drag without selection');
      await page.mouse.up();
      await keyboardPlace(page,free.cell);
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().state.turn),1,'board input waits for a new selection');
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      await page.getByRole('button',{name:'Resume',exact:true}).click();
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().selected),null,'pause preserves cleared selection');
      await page.screenshot({path:output+'/'+name+'-unselected.png'});
      await page.locator('.magnet-tool').first().click();
      await keyboardPlace(page,free.cell);
      await readyTools(page);
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().state.turn),2,'reselection enables the next move');
      assert.equal(await page.evaluate(()=>gameDebug.snapshot().selected),null);
      await page.evaluate(()=>gameDebug.reset());
      assert.equal(await page.locator('.moves-panel strong').textContent(),'0');
      assert.ok(await page.evaluate(()=>Boolean(gameDebug.snapshot().selected)),'reset retains initial tutorial selection');
      assert.deepEqual(errors,[]);
      await page.evaluate(()=>gameDebug.dispose()); await page.close();
    }
    console.log('Selection: tap/touch and keyboard completion, no ghost drag or extra move, reselection, pause/reset; desktop normal and mobile reduced motion passed.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
