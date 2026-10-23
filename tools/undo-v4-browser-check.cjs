const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {productionServer,ready,saved,put}=require('./save-v4-browser-check.cjs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const {bridge}=require('./platforms/browser-check.cjs');
const output=process.env.UNDO_OUTPUT||'artifacts/undo-v4';
const moduleAt=p=>import(pathToFileURL(path.resolve(p)).href);
const undo=p=>p.getByRole('button',{name:'Undo last move',exact:true});
async function layout(p){
 await p.waitForTimeout(250); // Finish tray relocation before measuring pixels.
 const rects=await p.evaluate(()=>Object.fromEntries(['.hud','.magnet-tray','.action-row','.game-status'].map(s=>{
  const r=document.querySelector(s).getBoundingClientRect();return [s,{left:r.left,right:r.right,top:r.top,bottom:r.bottom}];
 })));
 for(const [a,b]of [['.hud','.magnet-tray'],['.hud','.action-row'],['.magnet-tray','.action-row'],['.game-status','.magnet-tray'],['.game-status','.action-row']]){
  const x=rects[a],y=rects[b];assert(Math.min(x.right,y.right)-Math.max(x.left,y.left)<=1||Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)<=1,`${a} overlaps ${b}: ${JSON.stringify(rects)}`);
 }
}

async function check(base,combined=false){
 const {emptyProgress,createAttempt,replayAttempt}=await moduleAt('src/prototype/progress-v4.js');
 const {applyV4Magnet}=await moduleAt('src/prototype/model-v4.js');
 const {simulate}=await moduleAt('tools/verify-v4-balance.mjs');
 const witnesses=JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json','utf8')),w=witnesses.find(w=>w.number===1);
 const record=(seed,actions=[])=>emptyProgress({...createAttempt('magnet-v4-01',seed),actions});
 let clearIndex=-1;
 for(let i=0;i<w.actions.length-1;i++){
  const before=replayAttempt(record(w.seed,w.actions.slice(0,i)).activeAttempt).state,r=applyV4Magnet(before,w.actions[i]);
  if(r.events.some(e=>e.type==='unitsCleared')&&r.events.some(e=>e.type==='stackSpawned')){clearIndex=i;break;}
 }
 assert(clearIndex>=0,'must exercise a real clear and spawn before victory');
 const browser=await chromium.launch({headless:true});const results=[];
 async function assertUi(p,state){
  assert.equal(await p.locator('.moves-panel strong').textContent(),String(state.movesUsed));
  assert.equal(await p.locator('.cleared-count').textContent(),String(state.cleared));
  const radii=await p.locator('.magnet-tool').evaluateAll(ns=>ns.map(n=>[n.dataset.magnetColor,+n.querySelector('.magnet-range').dataset.radius]));
  assert.deepEqual(radii,state.magnets.map(c=>[c,state.magnetRadii[c]]));
  assert.equal(await p.locator('.collection-hex').count(),0);
 }
 try{for(const [target,viewport]of [['web',{width:390,height:844}],['telegram',{width:844,height:390}]]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(target==='telegram')await bridge(p);
  const url=base+(combined?(target==='web'?'':'telegram/'):target+'/');
  await p.goto(url);await ready(p);await readyTools(p);
  const load=async value=>{await put(p,value);await p.reload();await ready(p);};
  const prefix=w.actions.slice(0,clearIndex),value=record(w.seed,prefix),before=replayAttempt(value.activeAttempt).state,a=w.actions[clearIndex],after=applyV4Magnet(before,a).state;
  await load(value);await readyTools(p);await assertUi(p,before);
  const forecast=await p.locator('.spawn-forecast').textContent();
  await p.locator('[data-magnet-color="'+a.color+'"]').tap();await keyboardPlace(p,a.cell);await readyTools(p);await assertUi(p,after);
  const button=undo(p),rect=await button.boundingBox();assert(rect.width>=44&&rect.height>=44,JSON.stringify({target,rect}));
  await button.tap();await assertUi(p,before);
  let current=await saved(p);assert.deepEqual(current.activeAttempt.actions,prefix);assert.equal(current.activeAttempt.assisted,true);
  assert.deepEqual(replayAttempt(current.activeAttempt).state,before);assert.equal(await p.locator('.spawn-forecast').textContent(),forecast);
  assert.equal(await p.evaluate(()=>document.activeElement?.tagName),'CANVAS');
  await layout(p);
  await p.screenshot({path:`${output}/${target}-undone.png`,fullPage:true});
  // Immediate reload after accepting a move restores its committed endpoint;
  // Undo must already be enabled when the loading shell becomes interactive.
  await p.locator('[data-magnet-color="'+a.color+'"]').tap();await keyboardPlace(p,a.cell);await p.reload();await ready(p);await readyTools(p);
  await assertUi(p,after);assert.equal(await undo(p).isEnabled(),true);
  await undo(p).focus();await p.keyboard.press('Enter');await assertUi(p,before);
  assert.equal((await saved(p)).activeAttempt.assisted,true);
  await load(record(w.seed,w.actions.slice(0,3)));await readyTools(p);
  await layout(p);
  while((await saved(p)).activeAttempt.actions.length){
   await undo(p).tap();await assertUi(p,replayAttempt((await saved(p)).activeAttempt).state);
  }
  assert.equal(await undo(p).isDisabled(),true);assert.equal((await saved(p)).activeAttempt.assisted,true);
  await p.reload();await ready(p);assert.equal(await undo(p).isDisabled(),true);assert.equal((await saved(p)).activeAttempt.assisted,true);
  await p.getByRole('button',{name:'Pause',exact:true}).tap();assert.equal(await p.locator('.undo-button').isDisabled(),true);
  await p.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).tap();await readyTools(p);
  assert.equal((await saved(p)).activeAttempt.assisted,false);assert.equal((await saved(p)).activeAttempt.seed,w.seed);
  // Resume a real accepted loss journal; keep achievements from earlier runs.
  const loss=simulate(1,3,'random');assert.equal(loss.outcome,'lost');const lost=record(3,loss.actions);lost.completedByLevel['magnet-v4-01']={bestStars:3};
  await load(lost);const dialog=p.getByRole('dialog',{name:'Board full',exact:true});await dialog.waitFor();
  const lostUndo=dialog.getByRole('button',{name:'Undo last move',exact:true});await lostUndo.scrollIntoViewIfNeeded();
  const lostRect=await lostUndo.boundingBox();assert(lostRect.width>=44&&lostRect.height>=44);
  const retryRect=await dialog.getByRole('button',{name:'Try again',exact:true}).boundingBox();
  assert(retryRect.y+retryRect.height<=viewport.height,'both lost actions must fit the visible viewport');
  await p.screenshot({path:`${output}/${target}-lost-actions.png`,fullPage:true});await lostUndo.tap();
  const prior=replayAttempt(record(3,loss.actions.slice(0,-1)).activeAttempt).state;await assertUi(p,prior);assert.equal(await dialog.count(),0);
  assert.equal((await saved(p)).completedByLevel['magnet-v4-01'].bestStars,3);assert.equal((await saved(p)).activeAttempt.assisted,true);
  await layout(p);
  await p.screenshot({path:`${output}/${target}-loss-recovered.png`,fullPage:true});
  const last=loss.actions.at(-1);await p.locator('[data-magnet-color="'+last.color+'"]').tap();await keyboardPlace(p,last.cell);await dialog.waitFor();
  await dialog.getByRole('button',{name:'Try again',exact:true}).tap();await readyTools(p);assert.equal((await saved(p)).activeAttempt.seed,3);assert.equal((await saved(p)).activeAttempt.assisted,false);
  // A completed victory is immutable, including its saved star record.
  await load(record(w.seed,w.actions.slice(0,-1)));await readyTools(p);const win=w.actions.at(-1);
  await p.locator('[data-magnet-color="'+win.color+'"]').tap();await keyboardPlace(p,win.cell);await p.getByRole('dialog',{name:'Victory',exact:true}).waitFor();
  assert.equal(await p.locator('.undo-button').isDisabled(),true);assert.equal(await p.getByRole('dialog',{name:'Victory'}).getByRole('button',{name:'Undo last move',exact:true}).count(),0);
  assert.equal((await saved(p)).completedByLevel['magnet-v4-01'].bestStars,w.stars??replayAttempt(record(w.seed,w.actions).activeAttempt).state.stars);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);results.push({target,clearIndex,lossMoves:loss.actions.length,production:true});await context.close();
 }
 }finally{await browser.close();}
 fs.writeFileSync(`${output}/production.json`,JSON.stringify(results,null,2));
 console.log('PASS Undo production: touch/keyboard, clear+spawn+queue rollback, repeat/reload, assistance, undo to zero, loss/retry, won lock, earlier records, web/Telegram mock portrait/landscape.');
}

async function lifecycle(base){
 const browser=await chromium.launch({headless:true});
 try{const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base+'?seed=0');await p.waitForFunction(()=>window.gameDebug&&!document.body.dataset.startup&&!document.querySelector('.loading-screen'));await readyTools(p);
  const snap=()=>p.evaluate(()=>window.gameDebug.snapshot()),initial=(await snap()).state;
  const w=JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json','utf8')).find(w=>w.number===1&&w.seed===0),a=w.actions[0];
  // Invalid drop/cancel never creates an accepted journal action.
  const tool=await p.locator('.magnet-tool').first().boundingBox();await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(2,2,{steps:8});await p.mouse.up();
  await p.waitForTimeout(600);assert.equal((await snap()).attempt.actions.length,0);assert.equal(await undo(p).isDisabled(),true);
  let warmed;
  for(let i=0;i<20;i++){
   await p.evaluate(()=>window.gameDebug.reset());await readyTools(p);await p.locator('[data-magnet-color="'+a.color+'"]').tap();
   const at=await p.evaluate(cell=>window.gameDebug.screenPosition(cell),a.cell);await p.touchscreen.tap(at.x,at.y);
   assert.equal((await snap()).phase,'resolving');assert.equal(await undo(p).isDisabled(),true);
   await p.getByRole('button',{name:'Pause',exact:true}).tap();const paused=await snap();assert(paused.paused);assert.equal(await p.locator('.undo-button').isDisabled(),true);
   await p.getByRole('button',{name:'Resume',exact:true}).tap();await p.evaluate(()=>window.gameDebug.finishTestPresentation());await readyTools(p);
   await undo(p).tap();const state=await snap();assert.deepEqual(state.state,initial);assert.equal(state.timeline,null);assert.equal(state.drag,null);assert.equal(state.gesture,false);assert.deepEqual(state.collection,[]);
   assert.equal(state.displayedCleared,state.state.cleared);assert(state.renderer.units.every(u=>!u.moving));
   warmed??=state;assert.equal(state.renderer.geometries,warmed.renderer.geometries);assert.equal(state.renderer.textures,warmed.renderer.textures);
  }
  // Visibility boundary handler, distinct from a real device/app background.
  await p.locator('[data-magnet-color="'+a.color+'"]').tap();await keyboardPlace(p,a.cell);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert((await snap()).paused);assert.equal(await p.locator('.undo-button').isDisabled(),true);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await p.getByRole('button',{name:'Resume',exact:true}).tap();await p.evaluate(()=>window.gameDebug.finishTestPresentation());await readyTools(p);
  await p.setViewportSize({width:844,height:390});await undo(p).tap();assert.deepEqual((await snap()).state,initial);
  await layout(p);
  await p.screenshot({path:`${output}/dev-landscape.png`,fullPage:true});assert.equal(await p.locator('canvas').count(),1);
  fs.writeFileSync(`${output}/lifecycle.json`,JSON.stringify({cycles:20,geometries:warmed.renderer.geometries,textures:warmed.renderer.textures,visibility:'synthetic handler boundary',realTouchPlacement:true},null,2));
  assert.deepEqual(errors,[]);await p.evaluate(()=>window.gameDebug.dispose());assert.equal(await p.locator('canvas').count(),0);await p.close();
  console.log('PASS Undo lifecycle: real touch placement, invalid drag, resolving/pause/visibility locks, 20 reset/move/pause/Undo cycles, stable GPU resources, resize and dispose.');
 }finally{await browser.close();}
}
async function main(){
 fs.mkdirSync(output,{recursive:true});let server;
 try{const base=process.env.GAME_BASE_URL||(server=await productionServer()).base;await check(base,process.env.PUBLICATION_LAYOUT==='combined');
  if(process.env.UNDO_DEV_URL)await lifecycle(process.env.UNDO_DEV_URL);
 }finally{await server?.close();}
}
module.exports={check,lifecycle};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
