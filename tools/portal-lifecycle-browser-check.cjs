// Real gameplay with a platform lifecycle spy; no game state/save modification.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {route,readyTools,keyboardPlace}=require('./v4-browser-check.cjs');
(async()=>{
  const plan=await route(),browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5189/')+'?seed='+plan.seed);
    await page.waitForFunction(()=>!document.body.dataset.startup);
    await readyTools(page);
    await page.evaluate(async()=>{
      window.__growthLifecycle=[];
      // Reuse the actual HMR-versioned module; a different URL creates a second runtime.
      const actual=performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>new URL(name).pathname==='/src/prototype/runtime.js').at(-1);
      if(!actual)throw Error('Runtime module URL was not observed');
      const runtime=await import(actual);
      await runtime.configureGrowth({id:'web',gameplay:value=>window.__growthLifecycle.push(value)});
    });
    for(const action of plan.actions){
      await readyTools(page);await page.locator('[data-magnet-color="'+action.color+'"]').click();await keyboardPlace(page,action.cell);
    }
    await page.getByRole('region',{name:'Result',exact:true}).waitFor();
    const lifecycle=await page.evaluate(()=>window.__growthLifecycle);
    assert.equal(lifecycle.includes(true),true);assert.equal(lifecycle.at(-1),false);
    await page.waitForTimeout(250);assert.equal((await page.evaluate(()=>window.__growthLifecycle)).at(-1),false);
    console.log('Real seeded victory stops portal gameplay before parking on Result: PASS');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
