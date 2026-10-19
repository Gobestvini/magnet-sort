const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{keyboardPlace}=require('../v4-browser-check.cjs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5188/';
async function main(){
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1120,height:1080}}),rows=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/telegram-pace',{recursive:true});
 try{
 await page.goto(base+'tools/experiments/telegram-pace.html');
 let run=0;
 for(const id of ['A','B','C']){
  await page.locator('#profile').selectOption(id);await page.locator('#level').fill('10');await page.locator('#seed').fill('0');
  await page.getByRole('button',{name:'Начать попытку',exact:true}).click();
  await page.waitForFunction(expected=>{const w=document.querySelector('iframe').contentWindow;return new URLSearchParams(w.location.search).get('paceRun')===String(expected)&&w.gameDebug?.snapshot().state.levelNumber===10;},++run);
  const frame=page.frames().find(f=>f.url().includes('paceRun='));assert.ok(frame);
  await frame.waitForFunction(()=>!window.gameDebug.snapshot().loading&&!document.body.dataset.startup);
  const initial=await frame.evaluate(()=>window.gameDebug.snapshot());assert.equal(initial.state.goal,id==='A'?500:130);assert.equal(initial.saveStatus.reason,'transient');assert.equal(initial.state.movesUsed,0);
  assert.match(await frame.locator('.spawn-forecast').textContent(),id==='C'?/in 2 moves/:/in 3 moves/);
  for(let turn=0;turn<3;turn++){
   if(await frame.getByRole('dialog',{name:'Paused',exact:true}).count())await frame.getByRole('button',{name:'Resume',exact:true}).click();
   const snapshot=await frame.evaluate(()=>window.gameDebug.snapshot());
   const {chooseGreedy}=await import('../../tools/verify-v4-balance.mjs'),a=chooseGreedy(snapshot.state);
   await frame.locator('[data-magnet-color="'+a.color+'"]').click();
   const start=Date.now();await keyboardPlace({locator:s=>frame.locator(s),keyboard:page.keyboard},a.cell);
   const during=await frame.evaluate(()=>window.gameDebug.snapshot());
   assert.equal(during.phase,'resolving');
   await frame.waitForFunction(()=>window.gameDebug.snapshot().phase!=='resolving',{timeout:30000});
   const wallSeconds=(Date.now()-start)/1000;
   rows.push({profile:id,level:10,seed:0,turn:turn+1,timelineSeconds:during.timeline.duration,wallSeconds});
   assert.ok(wallSeconds>=during.timeline.duration-.2);
  }
  await page.screenshot({path:'artifacts/telegram-pace/preview-'+id+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('artifacts/telegram-pace/browser-timing.json',JSON.stringify({date:'2026-10-19',browser:browser.version(),viewport:{width:1120,height:1080},device:'Local Windows headless Chromium; one machine, sequential; not a phone or human playtest',rows},null,2));
 console.log('PASS local A/B/C preview, shared real renderer/session/input, no campaign writes, nine normal-motion wall/timeline measurements.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
