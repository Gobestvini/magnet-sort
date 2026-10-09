// Regression checks for async artwork loading and the raster UI lifecycle.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true});const out='artifacts/raster-browser';fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const delayed=new Promise(resolve=>release=resolve);
  await page.route('**/art/mockup/tile.png',async route=>{await delayed;await route.continue()});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByText('Loading artwork…',{exact:true}).waitFor();
  assert.equal(await page.locator('.game-view').evaluate(n=>n.inert),true);
  assert.equal(await page.evaluate(()=>window.gameDebug.snapshot().renderer),null);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({path:out+'/loading.png'});
  release();await page.waitForFunction(()=>window.gameDebug.snapshot().renderer);
  await page.unroute('**/art/mockup/tile.png');
  const checkArrow = async () => {
   await page.waitForFunction(() => {
    const arrow=document.querySelector('.tutorial-arrow')?.getBoundingClientRect();
    const target=window.gameDebug.screenPosition(window.gameDebug.getLevel().solution[0].cell);
    return arrow && Math.abs(arrow.left+22-target.x)<3 && Math.abs(arrow.top+5-target.y)<3;
   });
  };
  await checkArrow();
  await page.evaluate(()=>window.gameDebug.loadLevel(2));
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
  assert.equal(await page.locator('.magnet-tool').count(),3);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({path:out+'/playing.png'});
  await page.getByRole('button',{name:'Blue magnet',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Blue magnet',exact:true}).getAttribute('aria-pressed'),'true');
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({path:out+'/blue-selected.png'});
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({path:out+'/paused.png'});
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  // A UI-only asset failure is also fatal to the artwork batch and can be retried.
  await page.route('**/art/mockup/button-green.png',route=>route.abort());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('dialog',{name:'Launch error'}).waitFor();
  assert.equal(await page.evaluate(()=>window.gameDebug.snapshot().renderer),null);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({path:out+'/asset-error.png'});
  await page.unroute('**/art/mockup/button-green.png');
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForFunction(()=>window.gameDebug.snapshot().renderer);
  assert.equal(await page.locator('canvas').count(),1);
  for(const viewport of [{width:320,height:640},{width:941,height:1672}]){
   await page.setViewportSize(viewport);
   await checkArrow();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
      await page.screenshot({path:out+'/'+viewport.width+'.png'});
  }
  // A late artwork batch must not resurrect a disposed runtime.
  const late=await browser.newPage({viewport:{width:390,height:693}});
  late.on('pageerror',e=>errors.push(e.message));
  let releaseLate;const pending=new Promise(resolve=>releaseLate=resolve);
  await late.route('**/art/mockup/tile.png',async route=>{await pending;await route.continue()});
  await late.goto(base,{waitUntil:'domcontentloaded'});
  await late.waitForFunction(()=>window.gameDebug?.snapshot().loading);
  await late.evaluate(()=>window.gameDebug.dispose());
  releaseLate();await late.waitForLoadState('networkidle');
  assert.equal(await late.locator('canvas').count(),0);
  assert.equal(await late.locator('#ui-root').textContent(),'');
  await late.close();
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/report.json',JSON.stringify({ok:true,scenarios:['loading gate','tutorial target after resize','decoded UI on pause','selected color','missing UI asset','retry','dispose during loading','320px','941px'],errors},null,2));
  console.log('Raster artwork loading, failure/retry and responsive checks passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
