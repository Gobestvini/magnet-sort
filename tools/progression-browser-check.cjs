const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5183/';
(async()=>{
 fs.mkdirSync('artifacts/progression-browser',{recursive:true});const browser=await chromium.launch();
 try{for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?seed=0');await page.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
  for(const number of [1,3,4,6,7,9,10,11,12]){
   await page.evaluate(n=>window.gameDebug.loadLevel(n-1,0),number);await readyTools(page);
   const expected=await page.evaluate(async()=>{
    const {levelPalette,levelGroupCounts}=await import('/src/prototype/difficulty.js');
    const {topColor}=await import('/src/prototype/model.js');
    const s=window.gameDebug.snapshot().state;
    return {state:s,palette:levelPalette(s.levelNumber),groups:levelGroupCounts(s.levelNumber),tops:s.stacks.map(topColor)};
   });
   assert.ok(expected.state.magnets.every(c=>expected.tops.includes(c)));
   assert.ok(expected.state.stacks.every(s=>s.units.every(u=>expected.palette.includes(u.color))));
   for(const s of expected.state.stacks){const groups=s.units.filter((u,i)=>!i||u.color!==s.units[i-1].color);assert.ok(expected.groups.includes(groups.length));}
   assert.deepEqual(await page.locator('.magnet-tool').evaluateAll(ns=>ns.map(n=>n.dataset.magnetColor)),expected.state.magnets);
   if([1,4,7,10,12].includes(number))await page.screenshot({path:`artifacts/progression-browser/level-${number}-${viewport.width}.png`});
  }
  // Find real generated starts with exactly 1, 2 and 3 exposed colors; no injected runtime state.
  const seeds=await page.evaluate(async()=>{const {createV4State}=await import('/src/prototype/model-v4.js');const {v4Levels}=await import('/src/prototype/levels-v4.js');const found={};for(let seed=0;seed<3000&&Object.keys(found).length<3;seed++){const s=createV4State(v4Levels[0],seed);found[s.magnets.length]??=seed;}return found;});
  for(const count of [1,2,3]){
   assert.notEqual(seeds[count],undefined);await page.evaluate(seed=>window.gameDebug.loadLevel(0,seed),seeds[count]);await readyTools(page);
   const start=await page.evaluate(()=>window.gameDebug.snapshot().state);assert.equal(await page.locator('.magnet-tool').count(),count);
   const action=await page.evaluate(async()=>{const {canPlaceMagnet}=await import('/src/prototype/model.js');const s=window.gameDebug.snapshot().state;return {color:s.magnets[0],cell:s.cells.find(c=>canPlaceMagnet(s,c))};});
   const button=page.locator(`[data-magnet-color="${action.color}"]`);await button.click();
   if(count===1)await keyboardPlace(page,action.cell);
   else{
    const target=await page.evaluate(c=>window.gameDebug.screenPosition(c),action.cell);
    if(count===2)await page.mouse.click(target.x,target.y);
    else{const rect=await button.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:12});await page.mouse.up();}
   }
   await page.waitForFunction(()=>window.gameDebug.snapshot().state.movesUsed===1);
   await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.evaluate(()=>window.gameDebug.snapshot());assert.ok(paused.paused);
   await page.getByRole('button',{name:'Resume',exact:true}).click();await page.evaluate(()=>window.gameDebug.finishTestPresentation());
   const end=await page.evaluate(()=>window.gameDebug.snapshot());assert.ok(end.state.magnets.includes(end.selected));
   await page.evaluate(()=>window.gameDebug.reset());assert.deepEqual(await page.evaluate(()=>window.gameDebug.snapshot().state),start);
  }
  // Inspect a bent path at each real edge-transfer segment using the existing view hook.
  const inspected=await page.evaluate(async()=>{
   const {createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');const {v4Levels}=await import('/src/prototype/levels-v4.js');const {makeTransferTimeline}=await import('/src/prototype/motion.js');
   const {offsetToAxial,axialToOffset,hexDistance}=await import('/src/game/hex.js');
   const target={col:3,row:3},a=offsetToAxial(target),source=axialToOffset({q:a.q+1,r:a.r+1}),s=createV4State(v4Levels[0],0);
   s.stacks=[{cell:source,units:Array.from({length:6},(_,i)=>({id:'bent'+i,color:'blue'}))}];s.magnets=['blue'];s.spawnedUnits=6;
   const r=applyV4Magnet(s,{type:'placeMagnet',color:'blue',cell:target}),timeline=makeTransferTimeline(s,r);
   const segments=timeline.segments.filter(e=>e.type==='unitMoved');
   const frames=segments.map(e=>window.gameDebug.inspectPresentation(s,r,(e.start+e.end)/2).renderer.influence);
   return {edges:segments.map(e=>hexDistance(e.from,e.to)),frames,paths:r.influence.paths};
  });
  assert.ok(inspected.paths.some(p=>p.length===3));assert.ok(inspected.edges.every(d=>d===1));assert.ok(inspected.frames.some(f=>f.waves>0));
  await page.screenshot({path:`artifacts/progression-browser/bent-${viewport.width}.png`});
  await page.evaluate(()=>window.gameDebug.finishInspection());await page.setViewportSize({width:viewport.height,height:viewport.width});await page.evaluate(()=>window.gameDebug.reset());
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Progression: palette/groups at every boundary; 1/2/3 real slots; keyboard/tap/drag; selection, pause/resume/retry; bent edge timeline and resize passed in desktop/mobile/landscape viewports.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
