const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
async function modules(){
 return Promise.all(['src/prototype/model-v4.js','src/prototype/model.js','src/prototype/levels-v4.js'].map(p=>import(pathToFileURL(path.resolve(p)).href)));
}
async function route(number=1,seed){
 const [v4,v3,{v4Levels}]=await modules();
 const witness=require('./fixtures/followup-witnesses.json').find(r=>r.number===number&&(seed===undefined||seed===r.seed));
 if(witness){
  let state=v4.createV4State(v4Levels[number-1],witness.seed);
  for(const action of witness.actions){const r=v4.applyV4Magnet(state,action);assert.equal(r.accepted,true);state=r.state;}
  assert.equal(state.terminal,'won');assert.equal(state.cleared,witness.cleared);
  return {seed:witness.seed,actions:witness.actions,state};
 }
 seed??=1;
 let state=v4.createV4State(v4Levels[number-1],seed),actions=[];
 for(let turn=0;turn<1200&&!state.terminal;turn++){
  let best=null;
  for(const color of state.magnets)for(const cell of state.cells.filter(c=>v3.canPlaceMagnet(state,c))){
   const action={type:'placeMagnet',color,cell},r=v4.applyV4Magnet(state,action);
   const score=(r.state.cleared-state.cleared)*1000+r.events.filter(e=>e.type==='unitMoved').length*2
    +r.state.cells.filter(c=>v3.canPlaceMagnet(r.state,c)).length*5-Math.max(0,...r.state.stacks.map(s=>s.units.length))*.1;
   if(!best||score>best.score)best={score,action,state:r.state};
  }
  if(!best)break;actions.push(best.action);state=best.state;
 }
 assert.equal(state.terminal,'won', 'seed route must reach goal');
 return {actions,state};
}
async function keyboardPlace(page,cell){
 await page.locator('canvas').focus();
 // Every submitted turn clears keyboardCell, so establish a stable centre.
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');
 for(let i=3;i<cell.col;i++)await page.keyboard.press('ArrowRight');
 for(let i=3;i>cell.col;i--)await page.keyboard.press('ArrowLeft');
 for(let i=3;i<cell.row;i++)await page.keyboard.press('ArrowDown');
 for(let i=3;i>cell.row;i--)await page.keyboard.press('ArrowUp');
 await page.keyboard.press('Enter');
}
async function readyTools(page){
 await page.bringToFront();
 const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  // Desktop automation may temporarily lose native focus. Resume through the
  // same visible button a player uses; never bypass the game's blur policy.
  if(await page.getByRole('dialog',{name:'Paused',exact:true}).count()){
   await page.getByRole('button',{name:'Resume',exact:true}).click();
  }
  if(await page.locator('.magnet-tool:not(:disabled)').count()===3)return;
  await page.waitForTimeout(100);
 }
 throw new Error('Three available magnets did not return after resolution');
}
async function smoke(base,output='artifacts/v4-browser'){
 const planned=await route();fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 try{
 for(const [name,viewport,touch] of [['desktop',{width:1280,height:900},false],['mobile',{width:390,height:844},true]]){
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await page.goto(base+(base.includes('?')?'&':'?')+'seed='+planned.seed);
  await page.waitForFunction(()=>!document.querySelector('.loading-screen'));
  assert.equal(await page.locator('.magnet-tool').count(),3);
  assert.equal(await page.locator('.moves-panel strong').textContent(),'0');
  assert.equal(await page.locator('[role=progressbar]').getAttribute('aria-valuemax'),'50');
  await page.locator('img[src]').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await page.screenshot({path:output+'/'+name+'-initial.png',fullPage:true});
  let turn=0;
  for(const action of planned.actions){
   await readyTools(page);
   await page.locator('[data-magnet-color="'+action.color+'"]').click();
   await keyboardPlace(page,action.cell);
   if(++turn<planned.actions.length){
    await readyTools(page);
    const triple=await page.locator('.magnet-tool').evaluateAll(nodes=>nodes.map(n=>n.dataset.magnetColor));
    assert.equal(new Set(triple).size,3);
   }
  }
  await page.getByRole('region',{name:'Result',exact:true}).waitFor({timeout:30000});
  assert.equal(await page.locator('.cleared-count').textContent(),String(planned.state.cleared));
  assert.equal(await page.locator('.moves-panel strong').textContent(),String(planned.actions.length));
  await page.getByLabel(planned.state.stars+' stars earned').waitFor();
  await page.screenshot({path:output+'/'+name+'-victory.png',fullPage:true});
  await page.getByRole('button',{name:'Play again',exact:true}).click();
  assert.equal(await page.locator('.moves-panel strong').textContent(),'0');
  assert.equal(await page.locator('.cleared-count').textContent(),'0');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor();
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  assert.deepEqual(errors,[]);await page.close();
 }
 }finally{await browser.close();}
 console.log('V4 seeded goal victory, three magnets, growing moves, earned stars, retry and pause passed (desktop/mobile viewport), '+planned.actions.length+' moves.');
}
module.exports={route,keyboardPlace,smoke};
if(require.main===module)smoke(process.env.GAME_BASE_URL||'http://127.0.0.1:5175/').catch(e=>{console.error(e);process.exitCode=1;});

