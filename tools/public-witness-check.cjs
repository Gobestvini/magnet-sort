// Uses recorded actions without importing a newer local rules revision.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const witnesses=JSON.parse(fs.readFileSync(process.argv[2]||'tools/fixtures/followup-witnesses.json','utf8'));
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});try{
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 const w=witnesses.find(w=>w.number===1)||witnesses[0],p=await b.newPage({viewport,reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
 await p.goto((process.env.GAME_BASE_URL||'https://gobestvini.github.io/magnet-sort/')+'?seed='+w.seed+'&verify='+Date.now());
 for(const [index,action] of w.actions.entries()){try{await readyTools(p);await p.locator(`[data-magnet-color="${action.color}"]`).click();await keyboardPlace(p,action.cell);}catch(e){fs.mkdirSync('artifacts/public-witness',{recursive:true});await p.screenshot({path:'artifacts/public-witness/failure.png'});throw new Error('Move '+index+' '+JSON.stringify(action)+' '+(await p.locator('.game-status').textContent())+' '+e.message);}}
 await p.getByRole('dialog',{name:'Victory',exact:true}).waitFor();assert.equal(await p.locator('.moves-panel strong').textContent(),String(w.actions.length));assert.equal(await p.locator('.cleared-count').textContent(),String(w.cleared||54));
 await p.getByRole('button',{name:'Play again',exact:true}).click();await p.getByRole('img',{name:'Potential stars: 3 of 3',exact:true}).waitFor();
 await p.getByRole('button',{name:'Pause',exact:true}).click();await p.getByRole('button',{name:'Resume',exact:true}).click();assert.deepEqual(errors,[]);await p.close();
}console.log('Published recorded witness: victory, HUD, retry, pause and all resources passed desktop/mobile viewport.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
