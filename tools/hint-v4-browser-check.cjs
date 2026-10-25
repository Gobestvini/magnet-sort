const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {productionServer,ready,saved,put}=require('./save-v4-browser-check.cjs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const {bridge}=require('./platforms/browser-check.cjs');
const output=process.env.HINT_OUTPUT||'artifacts/hint-v4';
const moduleAt=p=>import(pathToFileURL(path.resolve(p)).href);
const hint=p=>p.getByRole('button',{name:'Hint',exact:true});
async function layout(p){
 await p.waitForTimeout(250);
 const rects=await p.evaluate(()=>Object.fromEntries(['.hud','.magnet-tray','.action-row','.game-status'].map(s=>{
  const r=document.querySelector(s).getBoundingClientRect();return [s,{left:r.left,right:r.right,top:r.top,bottom:r.bottom}];
 })));
 for(const [a,b]of [['.hud','.magnet-tray'],['.hud','.action-row'],['.magnet-tray','.action-row'],['.game-status','.magnet-tray'],['.game-status','.action-row']]){
  const x=rects[a],y=rects[b];assert(Math.min(x.right,y.right)-Math.max(x.left,y.left)<=1||Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)<=1,`${a} overlaps ${b}: ${JSON.stringify(rects)}`);
 }
 const r=await hint(p).boundingBox();assert(r.width>=44&&r.height>=44,'44px Hint target');
 assert(r.y+r.height<=await p.evaluate(()=>innerHeight),'Hint fits viewport');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
async function check(base,combined=false){
 const {emptyProgress,createAttempt,replayAttempt}=await moduleAt('src/prototype/progress-v4.js');
 const {applyV4Magnet}=await moduleAt('src/prototype/model-v4.js');
 const {findV4Hint,hintText}=await moduleAt('src/prototype/hint-v4.js');
 const {forecast}=await moduleAt('src/prototype/spawn-forecast.js');
 const {simulate}=await moduleAt('tools/verify-v4-balance.mjs');
 const witnesses=JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json','utf8')),w=witnesses.find(w=>w.number===1);
 const record=(seed,actions=[])=>emptyProgress({...createAttempt('magnet-v4-01',seed),actions});
 const browser=await chromium.launch({headless:true}),rows=[];
 try{for(const [target,viewport]of [['web',{width:390,height:844}],['telegram',{width:844,height:390}]]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(target==='telegram')await bridge(p);
  await p.goto(base+(combined?(target==='web'?'':'telegram/'):target+'/'));await ready(p);await readyTools(p);
  const load=async value=>{await put(p,value);await p.reload();await ready(p);if(!await p.locator('.result-card').count())await readyTools(p);};
  await load(record(w.seed));
  const before=(await saved(p)).activeAttempt,state=replayAttempt(before).state,recommendation=findV4Hint(state);
  assert(recommendation,'seed has an effective recommendation');
  await hint(p).tap();
  let value=await saved(p);assert.equal(value.activeAttempt.assisted,true);assert.deepEqual(value.activeAttempt.actions,[]);
  assert.deepEqual(replayAttempt(value.activeAttempt).state,state,'Hint never changes model/RNG/queue');
  assert.equal(await p.locator('.game-status').textContent(),hintText(recommendation,forecast(state)));
  const marker=p.locator('.hint-marker');await marker.waitFor({state:'visible'});
  assert.equal(await marker.getAttribute('data-color'),recommendation.color);
  assert.equal(await marker.getAttribute('data-target-cell'),`${recommendation.cell.col},${recommendation.cell.row}`);
  assert.equal(await p.locator(`[data-magnet-color="${recommendation.color}"]`).getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('.tutorial-guide').count(),0,'explicit Hint owns its marker');
  await layout(p);await p.screenshot({path:`${output}/${target}-suggestion.png`,fullPage:true});
  const revision=value.revision;
  await hint(p).focus();await p.keyboard.press('Enter');assert.equal((await saved(p)).revision,revision,'repeat hint has no extra storage write');
  const other=state.magnets.find(c=>c!==recommendation.color);assert(other);
  await p.locator(`[data-magnet-color="${other}"]`).tap();assert.equal(await marker.count(),0);assert(!/Hint:/.test(await p.locator('.game-status').textContent()));
  await hint(p).tap();await p.getByRole('button',{name:'Pause',exact:true}).tap();assert.equal(await marker.count(),0);assert.equal(await hint(p).isDisabled(),true);
  await p.getByRole('button',{name:'Resume',exact:true}).tap();assert.equal(await marker.count(),0);
  await hint(p).tap();const targetRect=await marker.boundingBox();await p.touchscreen.tap(targetRect.x+targetRect.width/2,targetRect.y+targetRect.height/2);await readyTools(p);
  const action={type:'placeMagnet',color:recommendation.color,cell:recommendation.cell},expected=applyV4Magnet(state,action).state;
  value=await saved(p);assert.deepEqual(value.activeAttempt.actions,[action]);assert.deepEqual(replayAttempt(value.activeAttempt).state,expected);assert.equal(await marker.count(),0);
  await p.reload();await ready(p);await readyTools(p);assert.equal((await saved(p)).activeAttempt.assisted,true);assert.equal(await marker.count(),0);
  await hint(p).tap();await p.getByRole('button',{name:'Undo last move',exact:true}).tap();assert.equal(await marker.count(),0);assert.deepEqual(replayAttempt((await saved(p)).activeAttempt).state,state);
  await hint(p).tap();await p.getByRole('button',{name:'Pause',exact:true}).tap();
  await p.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).tap();await readyTools(p);
  assert.equal((await saved(p)).activeAttempt.assisted,false);assert.equal(await marker.count(),0);assert.equal(await p.locator('.tutorial-guide').count(),1,'first-move tutorial survives reset');
  // First Hint changes tutorial layout: its resize must retain the suggested
  // keyboard cell until the player's separate Enter confirmation.
  await hint(p).focus();await p.keyboard.press('Enter');await marker.waitFor({state:'visible'});await p.waitForTimeout(150);
  assert.equal(await p.locator('#keyboard-cell').textContent(),`Tile: row ${recommendation.cell.row}, column ${recommendation.cell.col}`);
  await p.locator('canvas').focus();await p.keyboard.press('Enter');await readyTools(p);
  assert.deepEqual((await saved(p)).activeAttempt.actions,[action]);assert.deepEqual(replayAttempt((await saved(p)).activeAttempt).state,expected);
  const loss=simulate(1,3,'random');assert.equal(loss.outcome,'lost');await load(record(3,loss.actions));assert.equal(await hint(p).isDisabled(),true);
  await load(record(w.seed,w.actions.slice(0,-1)));const final=w.actions.at(-1);await p.locator(`[data-magnet-color="${final.color}"]`).tap();await keyboardPlace(p,final.cell);
  await p.getByRole('dialog',{name:'Victory',exact:true}).waitFor();assert.equal(await hint(p).isDisabled(),true);assert.equal(await marker.count(),0);
  assert.deepEqual(errors,[]);rows.push({target,viewport,recommendation,assistanceReload:true,modelUnchanged:true});await context.close();
 }}finally{await browser.close();}
 fs.writeFileSync(`${output}/production.json`,JSON.stringify(rows,null,2));
 console.log('PASS Hint production web/Telegram mock: exact explanation, legal marker, no action/RNG, persisted assistance, keyboard/touch, selection/pause/reset/Undo cleanup, tutorial, terminal locks and layout.');
}
async function lifecycle(base){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base+'?seed=0');await p.waitForFunction(()=>window.gameDebug&&!document.body.dataset.startup&&!window.gameDebug.snapshot().loading);await readyTools(p);
  const snap=()=>p.evaluate(()=>window.gameDebug.snapshot()),initial=await snap();
  const marker=p.locator('.hint-marker');let warmed;
  // WebGL reports lazily uploaded geometry/textures only once they render.
  // Warm the same scene for three cycles, then measure ten further cycles.
  for(let i=0;i<13;i++){
   await hint(p).tap();const s=await snap(),h=s.hint;assert(h);assert.deepEqual(s.state,initial.state);assert(s.attempt.assisted);
   const rect=await marker.boundingBox(),at=await p.evaluate(cell=>window.gameDebug.screenPosition(cell),h.cell);
   assert(Math.abs(rect.x+rect.width/2-at.x)<1&&Math.abs(rect.y+rect.height/2-at.y)<1,'marker follows legal tile');
   await p.touchscreen.tap(at.x,at.y);assert.equal((await snap()).phase,'resolving');assert.equal(await hint(p).isDisabled(),true);assert.equal(await marker.count(),0);
   await p.evaluate(()=>window.gameDebug.finishTestPresentation());await readyTools(p);
   await hint(p).tap();await p.getByRole('button',{name:'Undo last move',exact:true}).tap();assert.equal(await marker.count(),0);
   const restored=await snap();assert.deepEqual(restored.state,initial.state);if(i===2)warmed=restored;
   if(i>=3){assert.equal(restored.renderer.geometries,warmed.renderer.geometries);assert.equal(restored.renderer.textures,warmed.renderer.textures);}
  }
  await hint(p).tap();const h=(await snap()).hint;
  // Invalid pointer capture/cancel leaves the game usable and does not apply Hint.
  const tool=await p.locator('.magnet-tool').first().boundingBox();await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(2,2,{steps:5});await p.mouse.up();
  await p.waitForTimeout(500);assert.deepEqual((await snap()).state,initial.state);
  await hint(p).tap();await p.setViewportSize({width:844,height:390});await p.waitForTimeout(200);
  const rect=await marker.boundingBox(),at=await p.evaluate(cell=>window.gameDebug.screenPosition(cell),h.cell);
  assert(Math.abs(rect.x+rect.width/2-at.x)<1&&Math.abs(rect.y+rect.height/2-at.y)<1);await layout(p);
  await p.evaluate(()=>window.gameDebug.setReducedMotion(true));assert.equal(await marker.evaluate(n=>n.getAnimations().length),0,'reduced marker is static');
  await p.screenshot({path:`${output}/dev-landscape.png`,fullPage:true});
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await marker.count(),0);assert.equal(await hint(p).isDisabled(),true);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await p.getByRole('button',{name:'Resume',exact:true}).tap();assert.equal(await marker.count(),0);
  // Empty visible board through the existing DEV experimental rules seam.
  // This is synthetic integration evidence, not a reachable campaign journal.
  await p.close();const zero=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  zero.on('pageerror',e=>errors.push(e.message));zero.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await zero.goto(base);await ready(zero);
  // The host is a second live game. Pause it before entering the child so its
  // blur-triggered modal cannot mount later and steal focus back from Hint.
  // Otherwise the child immediately receives blur and correctly clears Hint.
  await readyTools(zero);await zero.getByRole('button',{name:'Pause',exact:true}).tap();
  await zero.waitForFunction(()=>document.activeElement?.closest('[role="dialog"]'));
  await zero.evaluate(async()=>{
   const defaults=await import('/src/prototype/model-v4.js');
   window.__magnetPaceExperiment={rules:{...defaults,createV4State:(...args)=>({...defaults.createV4State(...args),stacks:[]})},levelIndex:0};
   const frame=document.createElement('iframe');frame.style='position:fixed;inset:0;width:100%;height:100%;z-index:100';frame.src='/?seed=0&hintZero=1';document.body.append(frame);
  });
  const frame=await (async()=>{await zero.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.gameDebug&&!document.querySelector('iframe').contentWindow.gameDebug.snapshot().loading);return zero.frames().find(f=>f.url().includes('hintZero=1'));})();
  await frame.waitForFunction(()=>!document.body.dataset.startup&&!document.querySelector('#ui-root').inert);
  if(await frame.getByRole('dialog',{name:'Paused',exact:true}).count())await frame.getByRole('button',{name:'Resume',exact:true}).tap();
  const zeroBefore=await frame.evaluate(()=>window.gameDebug.snapshot().state);
  await hint(frame).tap();assert.match(await frame.locator('.game-status').textContent(),/No pulls right now.*New stacks/);assert.equal(await frame.locator('.hint-marker').count(),0);
  const z=await frame.evaluate(()=>window.gameDebug.snapshot());assert.equal(z.attempt.assisted,false);assert.equal(z.attempt.actions.length,0);assert.deepEqual(z.state,zeroBefore);
  await zero.screenshot({path:`${output}/zero-pull.png`,fullPage:true});await frame.evaluate(()=>window.gameDebug.dispose());assert.equal(await frame.locator('canvas').count(),0);await zero.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/lifecycle.json`,JSON.stringify({warmupCycles:3,cycles:10,geometries:warmed.renderer.geometries,textures:warmed.renderer.textures,visibility:'synthetic handler boundary',zeroPull:'synthetic transient rules, no campaign claims'},null,2));
  console.log('PASS Hint DEV: normal-motion touch placement, resolving lock, 10 stable-resource cycles, cancel/resize/reduced/hidden cleanup, synthetic zero-pull without assistance and dispose.');
 }finally{await browser.close();}
}
async function main(){fs.mkdirSync(output,{recursive:true});let server;try{
 const base=process.env.GAME_BASE_URL||(server=await productionServer()).base;await check(base,process.env.PUBLICATION_LAYOUT==='combined');
 if(process.env.HINT_DEV_URL)await lifecycle(process.env.HINT_DEV_URL);
}finally{await server?.close();}}
module.exports={check,lifecycle};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
