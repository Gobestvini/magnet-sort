const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {productionServer,ready,put}=require('./save-v4-browser-check.cjs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const output=process.env.CHALLENGE_OUTPUT||'artifacts/challenge-v4';
const moduleAt=p=>import(pathToFileURL(path.resolve(p)).href);
const named=(p,name)=>p.getByRole('button',{name,exact:true});
async function setup(page,telegram=false){
 await page.addInitScript(()=>{
  window.__copies=[];window.__nativeShares=[];window.__chooserCalls=[];window.__shareMode='unsupported';window.__copyFail=false;window.__seedCalls=0;
  const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=value=>{window.__seedCalls++;return random(value);};
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(value){if(window.__copyFail)throw new DOMException('Denied','NotAllowedError');window.__copies.push(value);}}});
  Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
   window.__nativeShares.push(data);if(window.__shareMode==='cancelled')throw new DOMException('Cancelled','AbortError');
   if(window.__shareMode==='error'||window.__shareMode==='unsupported')throw Error('Share unavailable');
  }});
 });
 if(telegram){
  await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.addInitScript(()=>{
   const handlers=new Map(),query=new URLSearchParams(location.search),payload=query.get('__bridgeStart')??query.get('tgWebAppStartParam');
   window.tgTest={ready:0,expanded:0,emit(name,data){for(const fn of handlers.get(name)||[])fn(data);}};
   window.Telegram={WebApp:{initData:'auth_date=0'+(payload?'&start_param='+encodeURIComponent(payload):''),version:'8.0',isActive:true,viewportStableHeight:innerHeight,viewportHeight:innerHeight,
    safeAreaInset:{top:20,bottom:12},contentSafeAreaInset:{top:36,bottom:24},expand(){tgTest.expanded++;},ready(){tgTest.ready++;},
    openTelegramLink(url){window.__chooserCalls.push(url);if(window.__shareMode==='error')throw Error('Chooser unavailable');},
    onEvent(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},offEvent(name,fn){handlers.get(name)?.delete(fn);}}};
  });
 }
}
async function actionBounds(button,viewport){await button.scrollIntoViewIfNeeded();await button.page().waitForTimeout(350);const r=await button.boundingBox();assert(r&&r.width>=44&&r.height>=44,'44px action '+JSON.stringify(r));assert(r.y>=0&&r.y+r.height<=viewport.height+1,'visible action '+JSON.stringify(r));}
async function noAutoShare(p){assert.equal(await p.evaluate(()=>__chooserCalls.length),0);assert.equal(await p.evaluate(()=>__nativeShares.length),0);assert.equal(await p.evaluate(()=>__copies.length),0);}
async function check(base,combined=false){
 fs.mkdirSync(output,{recursive:true});
 const codec=await moduleAt('src/prototype/challenge-v4.js'),progress=await moduleAt('src/prototype/progress-v4.js'),daily=await moduleAt('src/prototype/daily-v4.js');
 const {v4Levels}=await moduleAt('src/prototype/levels-v4.js'),{AUDIO_STORAGE_KEY}=await moduleAt('src/prototype/audio-settings.js');
 const witnesses=JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json','utf8')),win=witnesses.find(w=>w.number===1),campaign=witnesses.find(w=>w.number===4);
 const dailyRow=JSON.parse(fs.readFileSync('tools/fixtures/daily-v4-witnesses.json','utf8')).entries.find(w=>w.index===daily.getDaily('2026-10-25').index);
 const record=(w,actions)=>progress.emptyProgress({...progress.createAttempt('magnet-v4-'+String(w.number).padStart(2,'0'),w.seed),actions});
 const browser=await chromium.launch({headless:true}),rows=[];
 try{for(const [target,viewport]of [['web',{width:390,height:844}],['telegram',{width:844,height:390}],...(!combined?[['embed',{width:390,height:844}]]:[])]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await setup(p,target==='telegram');
  const url=base+(combined?(target==='web'?'':'telegram/'):target+'/');
  const read=key=>p.evaluate(key=>localStorage.getItem(key),key),rawCampaign=()=>read(progress.PROGRESS_V4_KEY),rawDaily=()=>read(daily.DAILY_V4_KEY),audio=()=>read(AUDIO_STORAGE_KEY);
  const load=async()=>{await p.reload();await ready(p);if(!await p.locator('.result-card').count())await readyTools(p);};
  await p.goto(url);await ready(p);await readyTools(p);await put(p,record(win,win.actions.slice(0,-1)));await load();
  const final=win.actions.at(-1);await named(p,'Pause').tap();await named(p,'Resume').tap();await p.locator(`[data-magnet-color="${final.color}"]`).tap();await keyboardPlace(p,final.cell);await p.locator('.result-card').waitFor();await noAutoShare(p);
  const campaignWon=await rawCampaign();await actionBounds(named(p,'Challenge a friend'),viewport);await named(p,'Challenge a friend').tap();
  const share=p.getByRole('dialog',{name:'Share challenge',exact:true});await share.waitFor();assert.match(await share.textContent(),/Shared score, unverified/);
  let shortPayload=null;
  const receiverUrl=await p.locator('.challenge-link').inputValue(),parsedUrl=new URL(receiverUrl),payload=parsedUrl.searchParams.get(target==='telegram'?'startapp':'challenge');
  const parsed=codec.parseChallenge(payload);assert(parsed.ok);assert.equal(parsed.descriptor.seed,win.seed);assert.equal(parsed.descriptor.moves,win.actions.length);assert.equal(parsed.descriptor.presetId,codec.CAMPAIGN_PRESET_ID);assert.equal(parsed.descriptor.assisted,false);
  assert(payload.length<=160&&/^[A-Za-z0-9_-]+$/.test(payload));
  if(target==='telegram'){
   const calls=await p.evaluate(()=>__chooserCalls);assert.equal(calls.length,1);const chooser=new URL(calls[0]);assert.equal(chooser.origin+chooser.pathname,'https://t.me/share/url');assert.equal(chooser.searchParams.get('url'),receiverUrl);
   assert.equal(parsedUrl.hostname,'t.me');assert.equal(parsedUrl.pathname,'/MagnetSortPuzzleBot');
  }else if(target==='embed'){assert.equal(parsedUrl.origin,'https://gobestvini.github.io');assert.equal(await p.evaluate(()=>__nativeShares.length),0);}
  assert.equal(await rawCampaign(),campaignWon);await actionBounds(named(share,'Copy link'),viewport);await named(share,'Copy link').tap();await p.waitForFunction(()=>__copies.length===1);assert.equal(await p.evaluate(()=>__copies[0]),receiverUrl);
  await p.evaluate(()=>{window.__copyFail=true;});await named(share,'Copy link').tap();await p.waitForFunction(()=>document.querySelector('.challenge-status').textContent.includes('Could not copy'));
  assert.equal(await p.locator('.challenge-link').inputValue(),receiverUrl);await actionBounds(named(share,'Close'),viewport);await named(share,'Close').tap();
  // Native/Telegram chooser failures stay a visible fallback, never delivery.
  if(target!=='embed'){
   await p.evaluate(()=>{window.__shareMode='cancelled';if(window.Telegram)delete Telegram.WebApp.openTelegramLink;});await named(p,'Challenge a friend').tap();await share.waitFor();
   await p.waitForFunction(()=>/cancel|unavailable/i.test(document.querySelector('.challenge-status').textContent));await named(share,'Close').tap();
   await p.evaluate(()=>{window.__shareMode='error';if(window.Telegram)Telegram.WebApp.openTelegramLink=()=>{throw Error('Chooser failed');};});await named(p,'Challenge a friend').tap();await share.waitFor();
   await p.waitForFunction(()=>/could not|unavailable/i.test(document.querySelector('.challenge-status').textContent));await named(share,'Close').tap();
  }
  // A won daily board shares B and its assistance category, without changing campaign.
  if(target==='web'){
   const envelope={...daily.emptyDailyProgress(),activeView:'daily',activeAttempt:{...daily.createDailyAttempt('2026-10-25'),actions:dailyRow.actions.slice(0,-1),assisted:true}};
   await p.evaluate(({key,envelope})=>localStorage.setItem(key,JSON.stringify(envelope)),{key:daily.DAILY_V4_KEY,envelope});await load();
   const last=dailyRow.actions.at(-1);await p.locator(`[data-magnet-color="${last.color}"]`).tap();await keyboardPlace(p,last.cell);await p.locator('.result-card').waitFor();const dailyWon=await rawDaily();
   await named(p,'Challenge a friend').tap();await share.waitFor();const b=new URL(await p.locator('.challenge-link').inputValue()).searchParams.get('challenge'),bp=codec.parseChallenge(b);
   assert(bp.ok);shortPayload=b;assert.equal(bp.descriptor.presetId,codec.SHORT_PRESET_ID);assert.equal(bp.descriptor.assisted,true);assert.equal(bp.descriptor.seed,dailyRow.seed);assert.equal(await rawCampaign(),campaignWon);assert.equal(await rawDaily(),dailyWon);await named(share,'Close').tap();
  }
  if(target==='embed'){rows.push({target,payloadLength:payload.length,embedCopyOnly:true});assert.deepEqual(errors,[]);await context.close();continue;}
  // Establish a different receiver campaign before navigating to the invitation.
  await p.evaluate(key=>localStorage.removeItem(key),daily.DAILY_V4_KEY);await put(p,record(campaign,campaign.actions.slice(0,2)));await p.goto(url);await ready(p);await readyTools(p);
  const before=await rawCampaign(),beforeDaily=await rawDaily(),beforeAudio=await audio(),campaignState=progress.replayAttempt(JSON.parse(before).activeAttempt).state;
  const incoming=value=>{const u=new URL(url);u.searchParams.set(target==='telegram'?'tgWebAppStartParam':'challenge',value);return u.href;};
  await p.goto(incoming(payload));await ready(p);const preview=p.getByRole('dialog',{name:'Friend challenge',exact:true});await preview.waitFor();
  assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);assert.equal(await p.evaluate(()=>__seedCalls),0);await noAutoShare(p);assert.match(await preview.textContent(),/Shared score, unverified/);
  await actionBounds(named(preview,'Play challenge'),viewport);await actionBounds(named(preview,'Cancel'),viewport);await p.screenshot({path:`${output}/${target}-preview.png`,fullPage:true});await named(preview,'Cancel').tap();await readyTools(p);assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);
  await p.goto(incoming(payload));await ready(p);await preview.waitFor();await named(preview,'Play challenge').tap();await readyTools(p);assert.equal(await p.locator('.challenge-badge').count(),1);
  const initial=codec.rulesForChallenge(parsed.descriptor).createV4State(v4Levels[parsed.descriptor.levelNumber-1],parsed.descriptor.seed);
  assert.equal(await p.locator('.moves-panel strong').textContent(),'0');assert.equal(await p.locator('.cleared-count').textContent(),'0');assert.equal(await p.locator('[aria-label="Pieces collected"]').getAttribute('aria-valuemax'),String(initial.goal));
  assert.deepEqual(await p.locator('.magnet-tool').evaluateAll(ns=>ns.map(n=>n.dataset.magnetColor)),initial.magnets);
  await named(p,'Hint').tap();const marked=await p.locator('.hint-marker').boundingBox();await p.touchscreen.tap(marked.x+marked.width/2,marked.y+marked.height/2);await readyTools(p);await named(p,'Undo last move').tap();assert.equal(await p.locator('.moves-panel strong').textContent(),'0');assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);
  // Reload deliberately reopens the invitation preview; no final sender state is imported.
  await p.reload();await ready(p);await preview.waitFor();assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);await named(preview,'Play challenge').tap();await readyTools(p);
  await named(p,'Pause').tap();await actionBounds(named(p,'Retry challenge'),viewport);await named(p,'Retry challenge').tap();await readyTools(p);
  for(const action of win.actions){await p.locator(`[data-magnet-color="${action.color}"]`).tap();await keyboardPlace(p,action.cell);if(action!==win.actions.at(-1))await readyTools(p);}
  await p.locator('.result-card').waitFor();assert.match(await p.locator('.challenge-comparison').textContent(),/same number of moves/);assert.match(await p.locator('.challenge-comparison').textContent(),/Shared score, unverified/);
  assert.equal(await named(p,'Next level').count(),0);assert.equal(await p.locator('.earned-stars').count(),0);assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);await noAutoShare(p);
  await actionBounds(named(p,'Return to campaign'),viewport);await p.screenshot({path:`${output}/${target}-result.png`,fullPage:true});await named(p,'Return to campaign').tap();await readyTools(p);
  assert.equal(await p.locator('.challenge-badge').count(),0);assert.equal(await p.locator('.moves-panel strong').textContent(),String(campaignState.movesUsed));assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);assert.equal(await audio(),beforeAudio);assert.equal(await named(p,'Undo last move').isEnabled(),true);
  if(shortPayload){
   await p.goto(incoming(shortPayload));await ready(p);await preview.waitFor();await named(preview,'Play challenge').tap();await readyTools(p);
   const short=codec.parseChallenge(shortPayload).descriptor,initialShort=codec.rulesForChallenge(short).createV4State(v4Levels[short.levelNumber-1],short.seed);
   assert.equal(await p.locator('[aria-label="Pieces collected"]').getAttribute('aria-valuemax'),String(initialShort.goal));assert.equal(await p.locator('.moves-panel strong').textContent(),'0');
   assert.deepEqual(await p.locator('.magnet-tool').evaluateAll(ns=>ns.map(n=>n.dataset.magnetColor)),initialShort.magnets);assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);
   await named(p,'Pause').tap();await named(p,'Return to campaign').tap();await readyTools(p);assert.equal(await rawCampaign(),before);
  }
  const bytes=Buffer.from(payload,'base64url');bytes[bytes.length-1]^=1;const unknown=bytes.toString('base64url');
  const duplicate=new URL(incoming(payload));duplicate.searchParams.append(target==='telegram'?'tgWebAppStartParam':'challenge',payload);
  for(const invalid of [incoming('A'.repeat(161)),incoming(unknown),duplicate.href]){
   await p.goto(invalid);await ready(p);const issue=p.getByRole('dialog',{name:'Challenge unavailable',exact:true});await issue.waitFor();assert.equal(await named(p,'Play challenge').count(),0);assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);await noAutoShare(p);
   await actionBounds(named(issue,'Update game'),viewport);await actionBounds(named(issue,'Return to campaign'),viewport);await named(issue,'Return to campaign').tap();await readyTools(p);assert.equal(await rawCampaign(),before);assert.equal(await rawDaily(),beforeDaily);
  }
  assert.deepEqual(errors,[]);rows.push({target,payloadLength:payload.length,initialSeed:parsed.descriptor.seed,profile:parsed.descriptor.presetId,previewCancel:true,campaignIsolated:true,shareMockOnly:true});await context.close();
 }}finally{await browser.close();}
 fs.writeFileSync(`${output}/production.json`,JSON.stringify(rows,null,2));console.log('PASS Challenge production: A/B descriptors, explicit chooser/copy/cancel/error fallbacks, preview/Cancel, initial board, Hint/Undo/reload/Retry/win/Return, honest comparison, malformed/version/duplicate rejection, campaign/daily/audio isolation and 44px controls. Mock only, no messages sent.');
}
async function lifecycle(base){
 fs.mkdirSync(output,{recursive:true});const codec=await moduleAt('src/prototype/challenge-v4.js'),{simulate}=await moduleAt('tools/verify-v4-balance.mjs');
 const descriptor={schema:1,levelNumber:1,seed:3,presetId:codec.CAMPAIGN_PRESET_ID,contentVersion:codec.CONTENT_VERSION,rulesHash:codec.CHALLENGE_RULES_HASH,moves:10,assisted:false},payload=codec.encodeChallenge(descriptor),loss=simulate(1,3,'random');assert.equal(loss.outcome,'lost');
 const progress=await moduleAt('src/prototype/progress-v4.js');
 const browser=await chromium.launch({headless:true});try{
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'}),errors=[];await setup(p);
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto(base);await p.waitForFunction(()=>window.gameDebug&&!document.body.dataset.startup&&!window.gameDebug.snapshot().loading);await readyTools(p);
  await put(p,progress.emptyProgress(progress.createAttempt('magnet-v4-04',17)));await p.reload();await ready(p);await readyTools(p);
  const snap=()=>p.evaluate(()=>window.gameDebug.snapshot()),campaign=(await snap()).campaign;
  await p.goto(base+'?seed=42&challenge='+payload);await ready(p);await p.getByRole('dialog',{name:'Friend challenge',exact:true}).waitFor();assert.deepEqual((await snap()).campaign,campaign);await named(p,'Play challenge').tap();await readyTools(p);
  assert.equal((await snap()).mode,'challenge');assert.equal((await snap()).state.seed,3);assert.equal((await snap()).state.movesUsed,0);
  // Reach a known valid loss through real controller actions. The final action
  // and recovery controls use real keyboard/touch input; setup is explicitly DEV.
  await p.evaluate(()=>window.gameDebug.setReducedMotion(true));
  for(const action of loss.actions.slice(0,-1)){assert((await p.evaluate(a=>window.gameDebug.playTestAction(a),action)).accepted);await p.evaluate(()=>window.gameDebug.finishTestPresentation());}
  await readyTools(p);const last=loss.actions.at(-1);await p.locator(`[data-magnet-color="${last.color}"]`).tap();await keyboardPlace(p,last.cell);await p.getByRole('dialog',{name:'Board full',exact:true}).waitFor();
  await p.getByRole('dialog',{name:'Board full',exact:true}).getByRole('button',{name:'Undo last move',exact:true}).tap();await readyTools(p);assert.equal((await snap()).mode,'challenge');assert.equal((await snap()).attempt.assisted,true);assert.equal((await snap()).state.movesUsed,loss.actions.length-1);
  await named(p,'Pause').tap();await named(p,'Retry challenge').tap();await readyTools(p);const initial=(await snap()).state;let warmed;
  await p.evaluate(()=>window.gameDebug.setReducedMotion(false));
  for(let i=0;i<8;i++){
   await named(p,'Hint').tap();const h=(await snap()).hint,at=await p.evaluate(c=>window.gameDebug.screenPosition(c),h.cell);await p.touchscreen.tap(at.x,at.y);assert.equal((await snap()).phase,'resolving');assert.equal(await named(p,'Hint').isDisabled(),true);
   await named(p,'Pause').tap();await named(p,'Resume').tap();await p.evaluate(()=>window.gameDebug.finishTestPresentation());await readyTools(p);await named(p,'Undo last move').tap();
   const s=await snap();assert.deepEqual(s.state,initial);assert.deepEqual(s.campaign,campaign);assert.equal(s.timeline,null);assert.deepEqual(s.collection,[]);assert.equal(s.drag,null);if(i===2)warmed=s;if(i>2){assert.equal(s.renderer.geometries,warmed.renderer.geometries);assert.equal(s.renderer.textures,warmed.renderer.textures);}
  }
  await p.setViewportSize({width:844,height:390});await named(p,'Pause').tap();await actionBounds(named(p,'Retry challenge'),{width:844,height:390});await actionBounds(named(p,'Return to campaign'),{width:844,height:390});await p.screenshot({path:`${output}/dev-landscape.png`,fullPage:true});await named(p,'Return to campaign').tap();await readyTools(p);assert.deepEqual((await snap()).state,campaign.state);
  assert.deepEqual(errors,[]);await p.evaluate(()=>window.gameDebug.dispose());assert.equal(await p.locator('canvas').count(),0);await p.close();fs.writeFileSync(`${output}/lifecycle.json`,JSON.stringify({warmupCycles:3,measuredCycles:5,geometries:warmed.renderer.geometries,textures:warmed.renderer.textures,lossMoves:loss.actions.length,lossSetup:'DEV controller prefix, final real keyboard action',realDelivery:false},null,2));console.log('PASS Challenge DEV: valid loss/final UI/Undo, normal-motion touch, pause/resolving, 8 warmed cycles, campaign restore, resize and dispose.');
 }finally{await browser.close();}
}
async function main(){fs.mkdirSync(output,{recursive:true});let server;try{const base=process.env.GAME_BASE_URL||(server=await productionServer()).base;await check(base,process.env.PUBLICATION_LAYOUT==='combined');if(process.env.CHALLENGE_DEV_URL)await lifecycle(process.env.CHALLENGE_DEV_URL);}finally{await server?.close();}}
module.exports={check,lifecycle};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
