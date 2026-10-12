const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const witness=JSON.parse(fs.readFileSync('artifacts/progressive-spawn/loss-witness.json','utf8'));
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});fs.mkdirSync('artifacts/defeat',{recursive:true});try{
 const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed='+witness.seed);
 for(const a of witness.actions){await readyTools(p);await p.locator(`[data-magnet-color="${a.color}"]`).click();await keyboardPlace(p,a.cell);}
 const modal=p.getByRole('dialog',{name:'Board full',exact:true});await modal.waitFor();assert.equal(await modal.locator('.earned-stars').count(),0);assert.equal(await p.locator('.victory-particles').count(),0);assert.equal(await modal.locator('button').count(),1);
 assert.ok((await modal.textContent()).includes(String(witness.moves)));assert.ok((await modal.textContent()).includes(`${witness.cleared} / 50`));
 for(const viewport of [{width:320,height:720},{width:390,height:844},{width:900,height:900},{width:844,height:390}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(200);assert.equal(await modal.count(),1);
  const r=await modal.locator('.modal-panel').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=viewport.width+1);
  await modal.getByRole('button',{name:'Try again',exact:true}).scrollIntoViewIfNeeded();await p.screenshot({path:`artifacts/defeat/lost-${viewport.width}.png`,fullPage:true});
 }
 for(const key of ['Tab','Shift+Tab','Tab']){await p.keyboard.press(key);assert.equal(await p.evaluate(()=>document.querySelector('.defeat-dialog').contains(document.activeElement)),true);}
 await p.keyboard.press('Enter');await readyTools(p);assert.equal(await modal.count(),0);assert.equal(await p.locator('.moves-panel strong').textContent(),'0');
 assert.equal(await p.locator('.game-view').evaluate(n=>n.inert),false);
 await p.getByRole('button',{name:'Pause',exact:true}).click();await p.getByRole('button',{name:'Resume',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('Defeat: real loss, live stats, no earned stars/confetti, four viewports, keyboard focus/retry and pause passed.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
