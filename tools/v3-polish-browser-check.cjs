const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5173';
const out='artifacts/task-polish';
const evidence=JSON.parse(fs.readFileSync('docs/design/v3-level-evidence.json'));
(async()=>{
 const browser=await chromium.launch({headless:true});fs.mkdirSync(out,{recursive:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:out+'/after-video'}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=async()=>{await page.goto(base);await page.waitForFunction(()=>window.gameDebug?.snapshot().renderer);};
 const snap=()=>page.evaluate(()=>window.gameDebug.snapshot());
 const settled=()=>page.waitForFunction(()=>window.gameDebug.snapshot().phase!=='resolving',null,{timeout:40000});
 const play=async(path,normal=false)=>{
  await page.evaluate(reduced=>window.gameDebug.setReducedMotion(reduced),!normal);
  for(const action of path){const accepted=await page.evaluate(a=>window.gameDebug.playTestAction(a).accepted,action);assert.ok(accepted);await settled();}
 };
 try {
  await ready();
  // Real-time recording of lift / edge / landing and the integrated win burst.
  await play([await page.evaluate(()=>window.gameDebug.getLevel().solution[0])],true);
  assert.equal((await snap()).phase,'won');
  assert.equal(await page.locator('.victory-particle').count(),42);
  await page.waitForTimeout(320);await page.screenshot({path:out+'/after-victory-burst.png'});
  await page.waitForTimeout(1700);assert.equal(await page.locator('.victory-particle').count(),0);
  await page.evaluate(()=>window.gameDebug.setPaused(true));
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  assert.equal(await page.locator('.victory-particle').count(),0,'same victory does not emit again');

  // Every new puzzle is actually played via UI tap/click, including hints.
  for(let i=3;i<12;i++) {
   await page.evaluate(i=>{window.gameDebug.loadLevel(i);window.gameDebug.setReducedMotion(true);},i);
   const level=await page.evaluate(()=>window.gameDebug.getLevel());
   await page.getByRole('button',{name:'Hint',exact:true}).click();
   assert.ok((await snap()).selected===level.solution[0].color);
   if(i===11)await page.screenshot({path:out+'/level-12.png'});
   for(const a of level.solution){
    const label={violet:'Violet',blue:'Blue',coral:'Coral'}[a.color];
    await page.getByRole('button',{name:label+' magnet',exact:true}).click();
    const pos=await page.evaluate(c=>window.gameDebug.screenPosition(c),a.cell);
    await page.mouse.click(pos.x,pos.y);await settled();
   }
   assert.equal((await snap()).phase,'won');
   assert.equal(await page.locator('.victory-particle').count(),0,'programmatic reduced suppresses burst');
  }
  await page.getByRole('button',{name:'Play from start',exact:true}).click();assert.equal((await snap()).levelIndex,0);
  for(const i of [0,3,6]) {
   const report=evidence[i];await page.evaluate(i=>window.gameDebug.loadLevel(i+3),i);
   await play(report.witnesses[1]);assert.equal((await snap()).phase,'won');
   await page.evaluate(i=>window.gameDebug.loadLevel(i+3),i);
   await play([report.branch.bad]);
   await page.getByRole('button',{name:'Hint',exact:true}).click();
   assert.ok(await page.getByRole('status').innerText().then(s=>s.includes('No hint')));
   while(!(await snap()).state.terminal){
    const action=await page.evaluate(async()=>{const {canPlaceMagnet}=await import('/src/prototype/model.js');const s=window.gameDebug.snapshot().state;return {type:'placeMagnet',color:s.magnets[0],cell:s.cells.find(c=>canPlaceMagnet(s,c))};});
    await play([action]);
   }
   assert.equal((await snap()).phase,'lost');assert.equal(await page.locator('.victory-particle').count(),0);
   await page.getByRole('button',{name:'Try again',exact:true}).click();assert.equal((await snap()).state.turn,0);
  }

  // Entry animation survives rerender, keyboard trap, quick dismissal and reduced modes.
  await page.evaluate(()=>{window.gameDebug.loadLevel(0);window.gameDebug.setReducedMotion(false);});
  for(let i=0;i<5;i++) {
   await page.getByRole('button',{name:'Pause',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.modal-panel')?.getAnimations()[0]?.startTime!=null);
   const timing=await page.locator('.modal-panel').evaluate(n=>n.getAnimations()[0].startTime);
   await page.waitForTimeout(110);
   const opacity=await page.locator('.modal-panel').evaluate(n=>Number(getComputedStyle(n).opacity));assert.ok(opacity>0&&opacity<=1);
   await page.evaluate(()=>window.gameDebug.setReducedMotion(false));
   assert.equal(await page.locator('.modal-panel').evaluate(n=>n.getAnimations()[0].startTime),timing);
   await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('.modal-backdrop').evaluate(n=>n.contains(document.activeElement)),true);
   await page.keyboard.press('Tab');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  }
  await page.evaluate(()=>{window.gameDebug.setReducedMotion(true);window.gameDebug.setPaused(true);});
  assert.equal(await page.locator('.modal-panel').evaluate(n=>n.getAnimations()[0].effect.getTiming().duration),80);
  await page.evaluate(()=>window.gameDebug.setPaused(false));
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{window.gameDebug.setReducedMotion(false);window.gameDebug.setPaused(true);});
  assert.equal(await page.locator('.modal-panel').evaluate(n=>n.getAnimations()[0].effect.getTiming().duration),80);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/popup-landscape.png'});
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.setViewportSize({width:390,height:844});

  await page.evaluate(()=>{window.gameDebug.loadLevel(1);window.gameDebug.setReducedMotion(false);});
  const tool=await page.getByRole('button',{name:'Violet magnet',exact:true}).boundingBox();
  const target=await page.evaluate(()=>window.gameDebug.screenPosition({col:3,row:3}));
  await page.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await page.mouse.down();
  const home=(await snap()).drag.homeSize;
  await page.mouse.move(target.x,target.y);await page.waitForTimeout(240);
  let drag=(await snap()).drag;assert.ok(Math.abs(drag.size-drag.targetSize)<2 && drag.size<home);
  await page.mouse.move(5,5);await page.waitForTimeout(240);drag=(await snap()).drag;
  assert.ok(Math.abs(drag.size-home)<2,'outside restores size');
  await page.mouse.move(target.x,target.y);await page.mouse.up();
  await page.waitForFunction(()=>!window.gameDebug.snapshot().drag);
  assert.equal((await snap()).state.turn,1);
  await page.evaluate(()=>window.gameDebug.reset());

  // Component lifecycle stress: 20 successive wins, immediate next/replay,
  // hidden cancellation and reduced toggles, without waiting for animationend.
  const stress=await page.evaluate(async()=>{
   window.gameDebug.dispose();
   const {h,render}=await import('/node_modules/.vite/deps/preact.js');
   const {VictoryParticles}=await import('/src/prototype/VictoryParticles.js');
   const host=document.createElement('div');document.body.replaceChildren(host);
   const flush=()=>new Promise(r=>setTimeout(r,50));let max=0;
   for(let i=0;i<20;i++) {
    render(h(VictoryParticles,{key:i,seed:i+1}),host);await flush();
    max=Math.max(max,host.querySelectorAll('img').length);
    render(null,host);await flush();if(host.querySelectorAll('img').length)throw Error('leaked particles');
   }
   render(h(VictoryParticles,{seed:123}),host);await flush();
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));await flush();
   if(host.querySelectorAll('img').length)throw Error('hidden particles');delete document.hidden;
   document.dispatchEvent(new Event('visibilitychange'));await flush();if(host.querySelectorAll('img').length)throw Error('restarted hidden burst');
   render(null,host);return {cycles:20,max};
  });assert.equal(stress.max,42);

  const failed=await context.newPage();
  await failed.route('**/art/mockup/chip-violet.png',route=>route.abort());
  await failed.goto(base);
  await failed.getByRole('dialog',{name:'Launch error',exact:true}).waitFor();
  assert.equal(await failed.getByRole('button',{name:'Retry',exact:true}).isEnabled(),true);
  await failed.waitForTimeout(120);await failed.screenshot({path:out+'/launch-error-entry.png'});
  assert.equal(await failed.locator('.game-view').evaluate(n=>n.inert),true);
  await failed.unroute('**/art/mockup/chip-violet.png');
  await failed.getByRole('button',{name:'Retry',exact:true}).click();
  await failed.waitForFunction(()=>window.gameDebug?.snapshot().renderer);
  assert.equal(await failed.getByRole('dialog').count(),0);await failed.close();

   // Six directions and a 20-unit source, with deterministic frame captures.
  await ready();
  const directions=await page.evaluate(async()=>{
   const {createThreeBoard}=await import('/src/prototype/board.js');
   const {loadBoardTextures}=await import('/src/prototype/assets.js');
   const {neighborCells}=await import('/src/game/hex.js');
   const {createPrototypeState,applyMagnet}=await import('/src/prototype/model.js');
   const {makeTransferTimeline,sampleTransferTimeline}=await import('/src/prototype/motion.js');
   window.gameDebug.dispose();document.body.replaceChildren();const canvas=document.createElement('canvas');document.body.append(canvas);canvas.style.cssText='width:390px;height:650px';
   const board=createThreeBoard(canvas,await loadBoardTextures());board.resize(390,650);
   window.fixture={board,createPrototypeState,applyMagnet,makeTransferTimeline,sampleTransferTimeline};
   return neighborCells({col:3,row:3});
  });
  let frames=0;
  for(const [i,target] of directions.entries()) {
   const result=await page.evaluate(({target})=>{
    const f=window.fixture;
    const level={id:'flip-six',rulesVersion:3,title:'',cells:Array.from({length:25},(_,i)=>({col:i%5+1,row:Math.floor(i/5)+1})),blockers:[],moves:1,clearSize:100,magnets:['violet'],stacks:[{cell:{col:3,row:3},units:Array.from({length:20},(_,i)=>({id:'u'+i,color:'violet'}))}]};
    const before=f.createPrototypeState(level),r=f.applyMagnet(before,{type:'placeMagnet',color:'violet',cell:target}),timeline=f.makeTransferTimeline(before,r);
    f.level=level;f.state=r.state;f.timeline=timeline;
    for(let t=0;t<timeline.duration;t+=1/120) {
     const sample=f.sampleTransferTimeline(timeline,t);if(sample.units.length!==20||new Set(sample.units.map(u=>u.id)).size!==20)throw Error('identity');
     f.board.draw(level,r.state,{timeline,time:t});
    }
    return Math.ceil(timeline.duration*120);
   },{target});frames+=result;
   for(const [name,p] of [['lift',.14],['edge',.5],['land',.999]]) {
    await page.evaluate(p=>{const f=window.fixture,s=f.timeline.segments[0];f.board.draw(f.level,f.state,{timeline:f.timeline,time:s.start+(s.end-s.start)*p});},p);
    await page.screenshot({path:`${out}/flip-${i}-${name}.png`});
   }
  }
  await page.evaluate(()=>window.fixture.board.dispose());
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/polish-report.json',JSON.stringify({errors,stress,directions:directions.length,frames,levelsPlayed:9,alternateAndLosing:[4,7,10],device:'headless Chromium; desktop and mobile viewports, no physical device'},null,2));
  console.log('Polish browser scenarios passed: nine levels, routed alternatives/losses, popup entry, particles x20, six flip directions.');
 }finally {await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
