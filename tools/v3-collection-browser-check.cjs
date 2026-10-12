const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
const out = 'artifacts/collection-browser';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ headless: true });
 const reports = [];
 try {
  for (const [name, viewport, reduced] of [['mobile', {width:390,height:844}, false], ['desktop', {width:1280,height:900}, false], ['reduced', {width:390,height:844}, true]]) {
   const page = await browser.newPage({ viewport });
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base);await page.waitForFunction(()=>window.gameDebug?.snapshot().renderer);
   await page.evaluate(()=>document.fonts.ready);
   const clockNow=new Date();await page.clock.install({time:clockNow});await page.clock.pauseAt(new Date(clockNow.getTime()+50));
   const snap=()=>page.evaluate(()=>window.gameDebug.snapshot());
   const start=()=>page.evaluate(()=>{window.gameDebug.reset();window.gameDebug.setReducedMotion(false);return window.gameDebug.playTestAction(window.gameDebug.getLevel().solution[0]);});
   await start();
   for(let i=0;i<1000&&new Set((await snap()).renderer.units.map(unit=>unit.pack)).size<4;i++)await page.clock.runFor(16);
   const compacting=await snap();assert.ok(compacting.renderer.units.some(unit=>unit.pack>.15&&unit.pack<1),'tower compacts before departure');
   assert.ok(new Set(compacting.renderer.units.map(unit=>unit.height)).size>=4,'real meshes shrink individually, not as one tower');
   if(name==='mobile')await page.screenshot({path:`${out}/mobile-compaction.png`});
   assert.equal(compacting.collection.length,0,'nothing flies before compaction');assert.equal(compacting.displayedCleared,0);
   await page.evaluate(()=>window.gameDebug.setPaused(true));const compactFrozen=await snap();await page.clock.runFor(600);
   assert.deepEqual((await snap()).renderer.units,compactFrozen.renderer.units,'pause freezes compaction');
   await page.evaluate(()=>window.gameDebug.setPaused(false));
   // Stop at a live collection, rather than pausing neighbouring-cell transfers.
   for(let i=0;i<1000&&!((await snap()).collection.length);i++)await page.clock.runFor(16);
   assert.ok((await snap()).collection.length,'collection starts');
   await page.evaluate(()=>window.gameDebug.setPaused(true));
   const frozen=await snap(),styles=await page.locator('.collection-layer').innerHTML();
   await page.clock.runFor(1000);
   assert.deepEqual((await snap()).collection,frozen.collection,'pause freezes flight progress');
   assert.equal((await snap()).displayedCleared,frozen.displayedCleared,'pause never awards pieces');
   assert.equal(await page.locator('.collection-layer').innerHTML(),styles,'pause freezes particles and trails too');
   await page.getByRole('button',{name:'Restart',exact:true}).last().click();
   await page.clock.runFor(2000);
   assert.equal((await snap()).displayedCleared,0,'restart discards arrivals');
   assert.equal(await page.locator('.collection-hex').count(),0,'restart removes sprites');
   assert.equal(await page.locator('.collection-effects').count(),0,'restart removes trails and particles');
   assert.equal((await snap()).state.turn,0);
   await start();await page.evaluate(reduced=>window.gameDebug.setReducedMotion(reduced),reduced);
   // Restart once more so reduced motion is captured by the new timeline.
   await page.evaluate(()=>{window.gameDebug.reset();window.gameDebug.playTestAction(window.gameDebug.getLevel().solution[0]);});
   const seen=new Set(),increments=[],frames=[];let previous=0,shot=false,resized=false,checkedEndpoint=false,receiptShot=false;
   for(let i=0;i<1600;i++) {
    await page.clock.runFor(16);const s=await snap();
    assert.ok(s.displayedCleared>=previous,'displayed progress is monotonic');
    assert.equal(await page.getByRole('progressbar',{name:'Pieces cleared'}).getAttribute('aria-valuenow'),String(s.displayedCleared));
    if(s.displayedCleared>previous){increments.push(s.displayedCleared-previous);previous=s.displayedCleared;}
    const boardIds=s.renderer.units.map(unit=>unit.id),flightIds=s.collection.map(unit=>unit.id);
    assert.equal(new Set([...boardIds,...flightIds]).size,boardIds.length+flightIds.length,'sprite is not duplicated on the board');
    if(!reduced)assert.equal(boardIds.length+flightIds.length+s.displayedCleared,s.state.initialUnits,'visual units and receipts are conserved');
    for(const unit of s.collection)seen.add(unit.id);
    if(reduced)assert.equal(flightIds.length,0,'reduced motion omits cross-screen flights');
    if(reduced)assert.equal(await page.locator('.collection-effects').count(),0,'reduced motion omits particles and trails');
    if(!reduced&&s.collection.some(unit=>unit.progress>.97)){
     const endpoint=await page.evaluate(()=>{
      const target=document.querySelector('.cleared-count').getBoundingClientRect();
      const node=[...document.querySelectorAll('.collection-hex')].find(node=>Number(node.dataset.progress)>.97);
      const box=node.getBoundingClientRect();return Math.hypot(box.x+box.width/2-target.x-target.width/2,box.y+box.height/2-target.y-target.height/2);
     });
     assert.ok(endpoint<35,'late flight converges on the counter');checkedEndpoint=true;
    }
    if(!reduced&&s.collection.length>=3&&s.collection.some(unit=>unit.progress>.75)&&!shot){
     await page.screenshot({path:`${out}/${name}-flight.png`});shot=true;
    }
    if(name==='mobile'&&(s.collection.length||s.renderer.units.some(unit=>unit.pack>0))&&s.displayedCleared<6&&i%3===0){
     const file=`${out}/frame-${String(frames.length).padStart(2,'0')}.png`;await page.screenshot({path:file});frames.push(file);
    }
    if(name==='mobile'&&s.displayedCleared===6&&!receiptShot){const file=`${out}/frame-${String(frames.length).padStart(2,'0')}.png`;await page.screenshot({path:file});frames.push(file);receiptShot=true;}
    assert.ok(await page.locator('.collection-effects > *').count()<160,'bounded particles and trails');
    if(name==='desktop'&&s.collection.length>=3&&!resized){await page.setViewportSize({width:430,height:932});resized=true;}
    if(s.phase==='won')break;
   }
   const final=await snap();assert.equal(final.phase,'won');assert.equal(final.displayedCleared,12);
   assert.equal(await page.locator('.collection-effects').count(),0,'completion cleans up effects');
   assert.equal(await page.locator('.collection-hex').count(),0);assert.ok(increments.every(count=>count===1),'each receipt awards one piece: '+JSON.stringify(increments));
   if(!reduced){assert.equal(seen.size,12);assert.ok(shot&&checkedEndpoint);}
   assert.deepEqual(errors,[]);
   await page.evaluate(()=>window.gameDebug.dispose());await page.clock.runFor(1000);
   assert.equal(await page.locator('.collection-hex,.collection-layer,canvas').count(),0,'dispose removes the flight layer and renderer');
   reports.push({name,receipts:increments.length,uniqueSprites:seen.size,resized,frames:frames.length});await page.close();
  }
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
