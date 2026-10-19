const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {route,keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const {bridge}=require('./platforms/browser-check.cjs');
const KEY='magnet-sort.v4.progress.v1';
async function productionServer(root='dist') {
 const dir=path.resolve(root),prefix='/magnet-sort/',mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname.slice(prefix.length));
  const file=path.resolve(dir,relative.endsWith('/')?relative+'index.html':relative||'index.html');
  if(!url.pathname.startsWith(prefix)||!file.startsWith(dir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {base:'http://127.0.0.1:'+server.address().port+prefix,close:()=>new Promise(r=>server.close(r))};
}
async function ready(page){await page.waitForFunction(()=>!document.body.dataset.startup&&!document.querySelector('.loading-screen'));await page.locator('canvas').waitFor();}
async function saved(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
async function storageValue(page){return page.evaluate(key=>localStorage.getItem(key),KEY);}
async function put(page,value){await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:KEY,value:typeof value==='string'?value:JSON.stringify(value)});}
async function check(base,output='artifacts/save-v4'){
 const planned=await route(1,0),witnesses=JSON.parse(fs.readFileSync('tools/fixtures/v4-progression-witnesses.json','utf8'));
 const {emptyProgress,createAttempt,replayAttempt}=await import(pathToFileURL(path.resolve('src/prototype/progress-v4.js')).href);
 const {simulate}=await import(pathToFileURL(path.resolve('tools/verify-v4-balance.mjs')).href);
 const makeRecord=(number,seed,actions=[])=>emptyProgress({...createAttempt('magnet-v4-'+String(number).padStart(2,'0'),seed),actions});
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
 for(const [target,viewport] of [['web',{width:390,height:844}],['telegram',{width:844,height:390}]]){
  const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));if(target==='telegram')await bridge(page);
  await page.addInitScript(()=>{crypto.getRandomValues=values=>{values.fill(0);return values;};});
  const url=base+target+'/';await page.goto(url);await ready(page);
  await page.evaluate(()=>{localStorage.setItem('magnet-sort.progress','legacy-sentinel');localStorage.setItem('unrelated-game','sentinel');});
  const a=planned.actions[0];await readyTools(page);await page.locator('[data-magnet-color="'+a.color+'"]').click();await keyboardPlace(page,a.cell);
  // A real accepted UI action, inspected before waiting for its animation.
  let record=await saved(page);assert.deepEqual(record.activeAttempt.actions,[a]);
  const expected=replayAttempt(record.activeAttempt).state;
  await page.reload();await ready(page);assert.equal(await page.locator('.moves-panel strong').textContent(),'1');
  assert.equal(await page.locator('.cleared-count').textContent(),String(expected.cleared));
  const radii=await page.locator('.magnet-tool').evaluateAll(nodes=>nodes.map(n=>[n.dataset.magnetColor,Number(n.querySelector('.magnet-range').dataset.radius)]));
  assert.deepEqual(Object.fromEntries(radii),expected.magnetRadii);
  assert.equal(await page.evaluate(()=>localStorage.getItem('magnet-sort.progress')),'legacy-sentinel');
  await page.screenshot({path:output+'/'+target+'-resumed.png',fullPage:true});
  const raw=await storageValue(page);await page.goto(url+'?seed=42');await ready(page);
  await readyTools(page);await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).click();assert.equal(await storageValue(page),raw);
  await page.goto(url);await ready(page);
  const bad='{corrupted-save';await put(page,bad);await page.reload();await ready(page);
  assert.equal(await storageValue(page),bad);await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Start fresh save',exact:true}).click();assert.notEqual(await storageValue(page),bad);
  await page.screenshot({path:output+'/'+target+'-save-status.png',fullPage:true});
  for(const n of [1,12]){
   const w=witnesses.find(w=>w.number===n);await put(page,makeRecord(n,w.seed,w.actions));await page.reload();await ready(page);
   assert.equal(await page.locator('.level-badge').textContent(),'LEVEL '+(n===12?12:2));
   if(n===12)await page.getByRole('region',{name:'Result',exact:true}).waitFor();
   const completed=(await saved(page)).completedByLevel;await page.reload();await ready(page);
   assert.deepEqual((await saved(page)).completedByLevel,completed);
  }
  const lost=simulate(1,3,'random');assert.equal(lost.outcome,'lost');await put(page,makeRecord(1,3,lost.actions));await page.reload();await ready(page);
  await page.getByRole('dialog',{name:'Board full',exact:true}).waitFor();await page.getByRole('button',{name:'Try again',exact:true}).click();
  assert.equal((await saved(page)).activeAttempt.seed,3);assert.equal((await saved(page)).activeAttempt.actions.length,0);
  // A second real tab advances the same origin's revision. The old tab stays playable in memory.
  const other=await context.newPage();if(target==='telegram')await bridge(other);await other.goto(url);await ready(other);
  const newest=await storageValue(other);await page.bringToFront();await readyTools(page);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Reload saved game',exact:true}).waitFor();
  assert.equal(await storageValue(page),newest);await other.close();assert.deepEqual(errors,[]);
  await context.close();
 }
 // Close while real non-reduced pieces are flying into the progress bar.
 {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  let page=await context.newPage();
  await context.addInitScript(()=>{crypto.getRandomValues=values=>{values.fill(0);return values;};});
  await page.goto(base+'web/');await ready(page);
  let previousCleared=0,checked=false;
  for(const a of planned.actions){
   await readyTools(page);await page.locator('[data-magnet-color="'+a.color+'"]').click();await keyboardPlace(page,a.cell);
   const record=await saved(page),expected=replayAttempt(record.activeAttempt).state;
   if(expected.cleared>previousCleared){
    await page.locator('.collection-hex').first().waitFor({state:'visible'});
    await page.close();page=await context.newPage();await page.goto(base+'web/');await ready(page);
    assert.equal(await page.locator('.cleared-count').textContent(),String(expected.cleared));
    assert.equal(await page.locator('.moves-panel strong').textContent(),String(expected.movesUsed));
    assert.deepEqual((await saved(page)).activeAttempt.actions,record.activeAttempt.actions);
    assert.equal(await page.locator('.collection-hex').count(),0);checked=true;break;
   }
   previousCleared=expected.cleared;
  }
  assert.equal(checked,true,'a real collection must be interrupted');await context.close();
 }
 // Quota and denied reads must not prevent a real move or expose a fatal startup.
 for(const failure of ['write','read']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  await page.addInitScript(({key,failure})=>{
   const method=failure==='write'?'setItem':'getItem',original=Storage.prototype[method];
   Storage.prototype[method]=function(k,...args){if(k===key)throw new DOMException('Denied','QuotaExceededError');return original.call(this,k,...args);};
   crypto.getRandomValues=values=>{values.fill(0);return values;};
  },{key:KEY,failure});
  await page.goto(base+'web/');await ready(page);await readyTools(page);
  const a=planned.actions[0];await page.locator('[data-magnet-color="'+a.color+'"]').click();await keyboardPlace(page,a.cell);await readyTools(page);
  assert.equal(await page.locator('.moves-panel strong').textContent(),'1');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  assert.match(await page.locator('.save-status').textContent(),/could not be saved/);await context.close();
 }
 }finally{await browser.close();}
 console.log('PASS save v4: production web/Telegram mock, immediate reload, radii, corruption/recovery, wins/final/loss, retry, transient seed, two tabs and denied/quota.');
}
async function main(){const server=await productionServer();try{await check(server.base);}finally{await server.close();}}
module.exports={productionServer,ready,saved,put,check};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
