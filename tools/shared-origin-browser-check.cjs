// Real-host regression: preserve a profile with an installed White Tower root SW.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve('artifacts/hosting-scope');fs.mkdirSync(output,{recursive:true});
const origin=process.env.SHARED_GAME_ORIGIN||'https://play.plusvibegames.com';
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(output,'profile'),{headless:true,viewport:{width:1280,height:900}});
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:90000});
  await page.evaluate(()=>localStorage.setItem('shared-origin-regression-marker','keep-progress'));
  if(!process.argv.includes('--seed')) await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration('/');await registration.update();});
  for(let attempt=0;attempt<20;attempt++){
   // A controllerchange may reload the old shell during this first transition.
   // Commit + document identity is stable across that handoff; module loading
   // and the actual game reveal are checked below.
   await page.goto(origin+'/magnet-sort/',{waitUntil:'commit'});
   await page.waitForFunction(()=>['Magnet Sort','White Tower'].includes(document.title));
   if(process.argv.includes('--seed')||(await page.title())==='Magnet Sort')break;
   await page.waitForTimeout(1000);
  }
  const title=await page.title();
  if(process.argv.includes('--seed')) assert.equal(title,'White Tower','must reproduce the previously installed worker intercepting another game');
  else{
   assert.equal(title,'Magnet Sort');
   await page.waitForFunction(()=>!document.body.dataset.startup);
   await page.getByRole('button',{name:'Pause',exact:true}).click();
   await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('shared-origin-regression-marker')),'keep-progress');
  }
  await page.screenshot({path:path.join(output,process.argv.includes('--seed')?'before-persistent.png':'after-persistent.png')});
  if(!process.argv.includes('--seed')){
   await context.setOffline(true);
   await page.goto(origin+'/',{waitUntil:'commit'});
   await page.waitForFunction(()=>document.title==='White Tower');
   assert.equal(await page.title(),'White Tower','own offline entry remains available');
   await context.setOffline(false);
   await page.goto(origin+'/magnet-sort/',{waitUntil:'commit'});
   await page.waitForFunction(()=>document.title==='Magnet Sort');
   assert.equal(await page.title(),'Magnet Sort');
  }
  console.log(JSON.stringify({mode:process.argv.includes('--seed')?'seed':'verify',title,worker:await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL),storagePreserved:true}));
 }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
