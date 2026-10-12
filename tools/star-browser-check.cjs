const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const fixtures=require('./fixtures/earned-star-witnesses.json');
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});fs.mkdirSync('artifacts/followup-stars',{recursive:true});try{
 for(const fixture of fixtures){
  const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5181/')+'?seed='+fixture.seed);
  for(const action of fixture.actions){await readyTools(p);await p.locator(`[data-magnet-color="${action.color}"]`).click();await keyboardPlace(p,action.cell);}
  await p.getByRole('dialog',{name:'Victory',exact:true}).waitFor({timeout:30000});
  await p.getByLabel(fixture.stars+' stars earned').waitFor();
  assert.equal(await p.locator('.earned-stars .earned').count(),fixture.stars);
  assert.equal(await p.locator('.moves-panel strong').textContent(),String(fixture.actions.length));
  assert.equal(await p.locator('.cleared-count').textContent(),'54');
  assert.equal(await p.locator('.game-view').evaluate(n=>n.inert),true);
  assert.equal(await p.locator('.victory-dialog').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(25, 5, 86, 0.65)');
  for(const key of ['Tab','Shift+Tab','Tab','Tab']){await p.keyboard.press(key);assert.equal(await p.evaluate(()=>document.querySelector('.victory-dialog').contains(document.activeElement)),true);}
  await p.screenshot({path:`artifacts/followup-stars/earned-${fixture.stars}.png`});
  if(fixture.stars===2){await p.getByRole('button',{name:'Next level',exact:true}).click();assert.equal(await p.locator('[aria-label="Pieces collected"]').getAttribute('aria-valuemax'),'100');}
  else{await p.getByRole('button',{name:'Play again',exact:true}).click();assert.equal(await p.locator('.moves-panel strong').textContent(),'0');}
  assert.deepEqual(errors,[]);console.log(`Real ${fixture.stars}-star victory: seed ${fixture.seed}, ${fixture.actions.length} moves.`);await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
