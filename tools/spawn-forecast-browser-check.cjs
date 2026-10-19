const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {productionServer,ready,saved,put}=require('./save-v4-browser-check.cjs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
async function main(){
 const server=await productionServer(),browser=await chromium.launch({headless:true}),output='artifacts/spawn-forecast';
 const load=p=>import(pathToFileURL(path.resolve(p)).href);
 const [{createAttempt,emptyProgress,replayAttempt},{forecast,forecastText},{chooseGreedy}]=await Promise.all([load('src/prototype/progress-v4.js'),load('src/prototype/spawn-forecast.js'),load('tools/verify-v4-balance.mjs')]);
 fs.mkdirSync(output,{recursive:true});
 try{
 for(const [name,viewport,number,steps] of [['small',{width:320,height:568},7,2],['portrait',{width:390,height:844},7,2],['landscape',{width:844,height:390},10,3]]){
  const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'web/');await ready(page);await put(page,emptyProgress(createAttempt('magnet-v4-'+String(number).padStart(2,'0'),0)));await page.reload();await ready(page);
  let state=replayAttempt((await saved(page)).activeAttempt).state;
  assert.equal(await page.locator('.spawn-forecast').textContent(),forecastText(forecast(state)));
  for(let i=0;i<steps;i++){
   await readyTools(page);const a=chooseGreedy(state),text=forecastText(forecast(state));
   await page.locator('[data-magnet-color="'+a.color+'"]').tap();await keyboardPlace(page,a.cell);
   assert.equal(await page.locator('.spawn-forecast').textContent(),text,'holds before during early resolution');
   if(i===0){await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.locator('.spawn-forecast').textContent();
    await page.waitForTimeout(120);assert.equal(await page.locator('.spawn-forecast').textContent(),paused);await page.getByRole('button',{name:'Resume',exact:true}).click();}
   await readyTools(page);state=replayAttempt((await saved(page)).activeAttempt).state;
   assert.equal(await page.locator('.spawn-forecast').textContent(),forecastText(forecast(state)));
  }
  const before=await saved(page),text=await page.locator('.spawn-forecast').textContent();
  await page.locator('.magnet-tool').first().tap();
  const canvas=await page.locator('canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.down();
  await page.dispatchEvent('canvas','pointercancel',{pointerId:1});await page.mouse.up();
  assert.equal(await page.locator('.spawn-forecast').textContent(),text);assert.deepEqual(await saved(page),before);
  // The selected forecast is inside the HUD and does not obscure the board/tray.
  const bounds=await page.locator('.spawn-forecast').boundingBox(),hud=await page.locator('.hud').boundingBox(),tray=await page.locator('.magnet-tray').boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1);assert.ok(bounds.y>=hud.y);
  assert.ok(bounds.y+bounds.height<=tray.y+1);
  await page.screenshot({path:output+'/'+name+'.png',fullPage:true});assert.deepEqual(errors,[]);await page.close();
 }
 // Reduced motion and a genuine winning sequence hide the forecast at result.
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const {route}=require('./v4-browser-check.cjs'),w=await route(1,0);await page.goto(server.base+'web/?seed=0');await ready(page);
 for(const a of w.actions){await readyTools(page);await page.locator('[data-magnet-color="'+a.color+'"]').tap();await keyboardPlace(page,a.cell);}
 await page.getByRole('region',{name:'Result',exact:true}).waitFor();assert.equal(await page.locator('.spawn-forecast').count(),0);await page.close();
 console.log('PASS spawn forecast: L7 two turns, L10 three turns, normal/reduced, pause/cancel, terminal and 320x568/390x844/844x390 production layouts.');
 }finally{await browser.close();await server.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
