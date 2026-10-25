const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {productionServer,ready,saved,put}=require('./save-v4-browser-check.cjs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const {bridge}=require('./platforms/browser-check.cjs');
const output=process.env.DAILY_OUTPUT||'artifacts/daily-v4';
const moduleAt=p=>import(pathToFileURL(path.resolve(p)).href);
const dailyButton=p=>p.getByRole('button',{name:'Daily board',exact:true});
const returnButton=p=>p.getByRole('button',{name:'Return to campaign',exact:true});
const retry=p=>p.getByRole('button',{name:'Retry daily',exact:true});
const hint=p=>p.getByRole('button',{name:'Hint',exact:true});
const CLOCK_KEY='__daily_browser_clock';
async function clock(context){await context.addInitScript(({key})=>{
 const RealDate=Date;window.__dailyNow=Number(localStorage.getItem(key))||RealDate.parse('2026-10-25T23:59:59.000Z');
 window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__dailyNow]));}static now(){return window.__dailyNow;}};
},{key:CLOCK_KEY});}
async function advance(p,instant){await p.evaluate(({key,instant})=>{window.__dailyNow=Date.parse(instant);localStorage.setItem(key,String(window.__dailyNow));},{key:CLOCK_KEY,instant});}
async function visibleAction(button,viewport){await button.scrollIntoViewIfNeeded();await button.page().waitForTimeout(300);const r=await button.boundingBox();assert(r&&r.width>=44&&r.height>=44,'44px action '+JSON.stringify(r));assert(r.y>=0&&r.y+r.height<=viewport.height+1,'action fits viewport '+JSON.stringify(r));}
async function check(base,combined=false){
 fs.mkdirSync(output,{recursive:true});
 const daily=await moduleAt('src/prototype/daily-v4.js'),{PROGRESS_V4_KEY,createAttempt,emptyProgress,replayAttempt}=await moduleAt('src/prototype/progress-v4.js');
 const {AUDIO_STORAGE_KEY}=await moduleAt('src/prototype/audio-settings.js');
 const fixtures=JSON.parse(fs.readFileSync('tools/fixtures/daily-v4-witnesses.json','utf8')).entries;
 const campaignWitness=JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json','utf8')).find(w=>w.number===4);
 const {DAILY_V4_KEY,getDaily,createDailyAttempt,replayDailyAttempt,DAILY_RULES}=daily;
 const date='2026-10-25',descriptor=getDaily(date),w=fixtures.find(w=>w.index===descriptor.index);
 assert(w&&w.actions.length>2);
 const browser=await chromium.launch({headless:true}),rows=[];
 try{for(const [target,viewport]of [['web',{width:390,height:844}],['telegram',{width:844,height:390}]]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,reducedMotion:'reduce',timezoneId:target==='web'?'America/New_York':'Asia/Tokyo'});await clock(context);
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});if(target==='telegram')await bridge(p);
  const url=base+(combined?(target==='web'?'':'telegram/'):target+'/');
  const rawCampaign=()=>p.evaluate(key=>localStorage.getItem(key),PROGRESS_V4_KEY);
  const rawDaily=()=>p.evaluate(key=>localStorage.getItem(key),DAILY_V4_KEY);
  const savedDaily=async()=>JSON.parse(await rawDaily());
  const putDaily=value=>p.evaluate(({key,value})=>localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value)),{key:DAILY_V4_KEY,value});
  const audio=()=>p.evaluate(key=>localStorage.getItem(key),AUDIO_STORAGE_KEY);
  const load=async()=>{await p.reload();await ready(p);if(!await p.locator('.result-card').count()&&!await p.getByRole('dialog',{name:'Daily unavailable',exact:true}).count())await readyTools(p);};
  await p.goto(url);await ready(p);await readyTools(p);
  const initial=emptyProgress({...createAttempt('magnet-v4-04',campaignWitness.seed),actions:campaignWitness.actions.slice(0,2)});
  await put(p,initial);await p.evaluate(key=>localStorage.setItem(key,JSON.stringify({musicEnabled:false,sfxEnabled:true,musicVolume:.2,sfxVolume:.5})),AUDIO_STORAGE_KEY);await load();
  const campaignBefore=await saved(p),stateBefore=replayAttempt(campaignBefore.activeAttempt).state,audioBefore=await audio();
  const selection=stateBefore.magnets.at(-1);await p.locator(`[data-magnet-color="${selection}"]`).tap();
  await p.getByRole('button',{name:'Pause',exact:true}).tap();await visibleAction(dailyButton(p),viewport);await dailyButton(p).tap();await readyTools(p);
  assert.equal(await p.locator('.daily-badge').getAttribute('aria-label'),'Daily board '+date);
  const frozenCampaign=await rawCampaign();assert.deepEqual((await saved(p)).activeAttempt,campaignBefore.activeAttempt);
  let progress=await savedDaily(),attempt=progress.activeAttempt;
  assert.equal(progress.activeView,'daily');assert.equal(progress.campaignSelection,selection);assert.equal(attempt.seed,descriptor.seed);assert.equal(attempt.index,descriptor.index);
  assert.equal(replayDailyAttempt(attempt).state.goal,30+10*replayDailyAttempt(attempt).state.levelNumber);
  assert.equal(await p.locator('[role=progressbar][aria-label="Pieces collected"]').getAttribute('aria-valuemax'),String(30+10*replayDailyAttempt(attempt).state.levelNumber));
  await hint(p).tap();assert.equal((await savedDaily()).activeAttempt.assisted,true);assert.equal((await savedDaily()).activeAttempt.actions.length,0);
  // A separate touch on the suggested tile applies the move; Hint itself did not.
  const h=await p.locator('.hint-marker').boundingBox();await p.touchscreen.tap(h.x+h.width/2,h.y+h.height/2);await readyTools(p);
  progress=await savedDaily();assert.equal(progress.activeAttempt.actions.length,1);assert.equal(await rawCampaign(),frozenCampaign);
  await p.getByRole('button',{name:'Undo last move',exact:true}).tap();assert.equal((await savedDaily()).activeAttempt.actions.length,0);assert.equal((await savedDaily()).activeAttempt.assisted,true);
  await load();assert.equal((await savedDaily()).activeView,'daily');assert.equal((await savedDaily()).activeAttempt.assisted,true);assert.equal(await rawCampaign(),frozenCampaign);assert.equal(await audio(),audioBefore);
  // Midnight changes today's availability, but never replaces the active board.
  await advance(p,'2026-10-26T00:00:01.000Z');await p.getByRole('button',{name:'Pause',exact:true}).tap();
  assert.equal(await p.locator('.daily-badge').getAttribute('aria-label'),'Daily board '+date);await visibleAction(retry(p),viewport);await retry(p).tap();await readyTools(p);
  assert.equal((await savedDaily()).activeAttempt.date,date);assert.equal((await savedDaily()).activeAttempt.assisted,false);assert.equal((await savedDaily()).activeAttempt.actions.length,0);
  await load();assert.equal((await savedDaily()).activeAttempt.date,date);assert.equal(await rawCampaign(),frozenCampaign);
  // Complete a valid known replay through the final real UI action in each category.
  for(const assisted of [true,false,false]){
   progress=await savedDaily();const previous=progress.results[date]?.bestUnassisted;
   progress.activeView='daily';progress.activeAttempt={...createDailyAttempt(date),actions:w.actions.slice(0,-1),assisted};
   await putDaily(progress);await load();const last=w.actions.at(-1);await p.locator(`[data-magnet-color="${last.color}"]`).tap();await keyboardPlace(p,last.cell);
   await p.locator('.result-card').waitFor();await visibleAction(returnButton(p),viewport);await visibleAction(retry(p),viewport);
   progress=await savedDaily();const best=progress.results[date][assisted?'bestAssisted':'bestUnassisted'];assert.equal(best.outcome,'won');assert.equal(best.moves,w.moves);
   if(previous&&!assisted)assert.deepEqual(best,previous,'equal score retains the earlier result');
   assert.equal(await p.getByRole('button',{name:'Next level',exact:true}).count(),0);assert.equal(await p.locator('.daily-calendar [data-date]').count(),7);
   assert.equal(await p.locator(`.daily-calendar [data-date="${date}"][data-completed="true"]`).count(),1);
   assert.match(await p.locator('.daily-panel').textContent(),/Local best/);assert.equal(Object.keys(progress.results).length,1);
   assert.equal(await rawCampaign(),frozenCampaign);assert.equal(await audio(),audioBefore);
  }
  await p.screenshot({path:`${output}/${target}-daily-result.png`,fullPage:true});
  await returnButton(p).tap();await readyTools(p);assert.equal(await p.locator('.daily-badge').count(),0);assert.equal(await rawCampaign(),frozenCampaign);
  assert.deepEqual(replayAttempt((await saved(p)).activeAttempt).state,stateBefore);
  assert.equal(await p.locator(`[data-magnet-color="${selection}"]`).getAttribute('aria-pressed'),'true','return restores campaign selection');
  assert.equal(await p.locator('.moves-panel strong').textContent(),String(stateBefore.movesUsed));assert.equal(await p.getByRole('button',{name:'Undo last move',exact:true}).isEnabled(),true);
  await p.screenshot({path:`${output}/${target}-campaign-restored.png`,fullPage:true});
  await p.getByRole('button',{name:'Undo last move',exact:true}).tap();assert.deepEqual((await saved(p)).activeAttempt.actions,campaignWitness.actions.slice(0,1));assert.equal(await audio(),audioBefore);
  // A fresh voluntary entry after returning selects the new UTC day.
  await p.getByRole('button',{name:'Pause',exact:true}).tap();await dailyButton(p).tap();await readyTools(p);
  assert.equal((await savedDaily()).activeAttempt.date,'2026-10-26');assert.equal((await savedDaily()).activeAttempt.index,getDaily('2026-10-26').index);
  await p.getByRole('button',{name:'Pause',exact:true}).tap();assert.equal(await p.locator('.daily-calendar [data-date]').count(),7);await returnButton(p).tap();await readyTools(p);
  // Unknown versions and corrupt daily storage preserve the exact original bytes.
  const baseline=await rawCampaign();
  for(const invalid of ['{broken-daily',JSON.stringify({...progress,catalogVersion:'future-catalog'})]){
   await putDaily(invalid);await load();
   assert.deepEqual((await saved(p)).activeAttempt,JSON.parse(baseline).activeAttempt);
   const afterReload=await rawCampaign();
   // A malformed envelope has no recoverable activeView; normal campaign
   // entry is allowed, while voluntary Daily displays the preserved issue.
   if(!await p.getByRole('dialog',{name:'Daily unavailable',exact:true}).count()){
    await p.getByRole('button',{name:'Pause',exact:true}).tap();await dailyButton(p).tap();
   }
   await p.getByRole('dialog',{name:'Daily unavailable',exact:true}).waitFor();
   assert.equal(await rawDaily(),invalid);await visibleAction(returnButton(p),viewport);await visibleAction(p.getByRole('button',{name:'Update game',exact:true}),viewport);
   await returnButton(p).tap();await readyTools(p);assert.equal(await rawDaily(),invalid);assert.equal(await rawCampaign(),afterReload);
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  rows.push({target,viewport,date,index:descriptor.index,seed:descriptor.seed,preset:descriptor.presetId,timezone:target==='web'?'America/New_York':'Asia/Tokyo',campaignIsolated:true,midnightPinned:true,bestCategories:true});await context.close();
 }}finally{await browser.close();}
 fs.writeFileSync(`${output}/production.json`,JSON.stringify(rows,null,2));
 console.log('PASS Daily production web/Telegram mock: shared UTC board, campaign isolation/selection/history/audio, Hint/Undo/reload, pinned midnight/retry, separate local bests/ties/calendar, Return/new day, corruption/version and 44px controls.');
}
async function lifecycle(base){
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});await clock(context);const p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base);await p.waitForFunction(()=>window.gameDebug&&!document.body.dataset.startup&&!window.gameDebug.snapshot().loading);await readyTools(p);
  const snapshot=()=>p.evaluate(()=>window.gameDebug.snapshot()),initial=await snapshot();let warmed;
  for(let i=0;i<8;i++){
   await p.getByRole('button',{name:'Pause',exact:true}).tap();await dailyButton(p).tap();await readyTools(p);
   const before=await snapshot();assert.equal(before.mode,'daily');assert.deepEqual(before.campaign,initial.campaign);
   await hint(p).tap();const h=(await snapshot()).hint,at=await p.evaluate(cell=>window.gameDebug.screenPosition(cell),h.cell);await p.touchscreen.tap(at.x,at.y);
   assert.equal((await snapshot()).phase,'resolving');assert.equal(await hint(p).isDisabled(),true);
   await p.getByRole('button',{name:'Pause',exact:true}).tap();assert((await snapshot()).paused);await p.getByRole('button',{name:'Resume',exact:true}).tap();
   await p.evaluate(()=>window.gameDebug.finishTestPresentation());await readyTools(p);await p.getByRole('button',{name:'Undo last move',exact:true}).tap();
   await p.getByRole('button',{name:'Pause',exact:true}).tap();await returnButton(p).tap();await readyTools(p);
   const after=await snapshot();assert.equal(after.mode,'campaign');assert.deepEqual(after.state,initial.state);assert.deepEqual(after.campaign,initial.campaign);assert.equal(after.timeline,null);assert.deepEqual(after.collection,[]);assert.equal(after.drag,null);
   if(i===2)warmed=after;if(i>2){assert.equal(after.renderer.geometries,warmed.renderer.geometries);assert.equal(after.renderer.textures,warmed.renderer.textures);}
  }
  await p.setViewportSize({width:844,height:390});await p.getByRole('button',{name:'Pause',exact:true}).tap();await dailyButton(p).tap();await readyTools(p);
  await p.evaluate(()=>window.gameDebug.setReducedMotion(true));await p.getByRole('button',{name:'Pause',exact:true}).tap();await visibleAction(returnButton(p),{width:844,height:390});
  await p.screenshot({path:`${output}/dev-landscape-pause.png`,fullPage:true});await returnButton(p).tap();await readyTools(p);
  assert.deepEqual(errors,[]);await p.evaluate(()=>window.gameDebug.dispose());assert.equal(await p.locator('canvas').count(),0);await context.close();
  fs.writeFileSync(`${output}/lifecycle.json`,JSON.stringify({warmupCycles:3,measuredCycles:5,geometries:warmed.renderer.geometries,textures:warmed.renderer.textures,realTouch:true,phone:false},null,2));
  console.log('PASS Daily DEV: normal-motion touch, resolving/pause, 8 mode round trips with restored campaign and stable warmed resources, resize/reduced and dispose.');
 }finally{await browser.close();}
}
async function main(){fs.mkdirSync(output,{recursive:true});let server;try{
 const base=process.env.GAME_BASE_URL||(server=await productionServer()).base;await check(base,process.env.PUBLICATION_LAYOUT==='combined');
 if(process.env.DAILY_DEV_URL)await lifecycle(process.env.DAILY_DEV_URL);
}finally{await server?.close();}}
module.exports={check,lifecycle};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
