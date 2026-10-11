const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true});const out='artifacts/background-browser';fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.gameDebug?.snapshot().renderer);
  const layer=page.locator('.idle-grid'),sweep=page.locator('.idle-grid-sweep');
  assert.equal(await layer.count(),1);assert.equal(await layer.getAttribute('aria-hidden'),'true');
  assert.equal(await layer.getAttribute('data-active'),'true');
  assert.equal(await sweep.evaluate(n=>getComputedStyle(n).animationPlayState),'running');
  const freeze=async time=>{
   await layer.evaluate(n=>{n.style.transition='none';n.style.opacity='.55'});
   await sweep.evaluate((n,time)=>{const a=n.getAnimations()[0];a.pause();a.currentTime=time},time);
  };
  await freeze(0);await page.screenshot({path:out+'/rest.png'});
  await freeze(6000);await page.screenshot({path:out+'/shine.png'});
  for(const viewport of [{width:540,height:960},{width:950,height:540}]){
   await page.setViewportSize(viewport);await page.screenshot({path:out+`/shine-${viewport.width}.png`});
   const extent=await layer.boundingBox();assert.equal(Math.round(extent.width),viewport.width);assert.equal(Math.round(extent.height),viewport.height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await layer.evaluate(n=>{n.style.opacity='';n.style.transition=''});
  await page.evaluate(()=>window.gameDebug.setPaused(true));assert.equal(await layer.getAttribute('data-active'),'false');
  assert.equal(await sweep.evaluate(n=>getComputedStyle(n).animationPlayState),'paused');
  await page.evaluate(()=>{window.gameDebug.setPaused(false);window.gameDebug.setReducedMotion(true)});
  assert.equal(await layer.getAttribute('data-active'),'false');
  await page.evaluate(()=>window.gameDebug.setReducedMotion(false));
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await layer.evaluate(n=>getComputedStyle(n).display),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(await layer.getAttribute('data-active'),'false');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));window.gameDebug.setPaused(false)});
  assert.equal(await layer.getAttribute('data-active'),'true');
  await page.evaluate(()=>{const a=window.gameDebug.getLevel().solution[0];window.gameDebug.playTestAction(a)});
  assert.equal(await layer.getAttribute('data-active'),'false');
  await page.evaluate(()=>window.gameDebug.reset());assert.equal(await layer.getAttribute('data-active'),'true');
  await page.evaluate(()=>window.gameDebug.dispose());assert.equal(await layer.count(),0);assert.deepEqual(errors,[]);
  console.log('Background shine: resize/alignment, pause, reduced motion, hidden, resolving, reset and disposal passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
