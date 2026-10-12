const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const {pathToFileURL}=require('node:url');const path=require('node:path');
(async()=>{const [{createV4State,applyV4Magnet},{canPlaceMagnet},{v4Levels}]=await Promise.all(['model-v4','model','levels-v4'].map(n=>import(pathToFileURL(path.resolve('src/prototype/'+n+'.js')).href)));
const seed=0;let state=createV4State(v4Levels[0],seed);const actions=[],counts=[];
while(!state.terminal&&actions.length<30){let best;
for(const color of state.magnets)for(const cell of state.cells.filter(c=>canPlaceMagnet(state,c))){const action={type:'placeMagnet',color,cell},r=applyV4Magnet(state,action);const score=r.events.filter(e=>e.type==='unitMoved').length*1000+r.state.cleared;if(!best||score<best.score)best={action,result:r,score};}
assert.ok(best);actions.push(best.action);counts.push(best.result.events.filter(e=>e.type==='stackSpawned').length);state=best.result.state;}
assert.equal(state.terminal,'lost');fs.mkdirSync('artifacts/progressive-spawn',{recursive:true});fs.writeFileSync('artifacts/progressive-spawn/loss-witness.json',JSON.stringify({seed,actions,counts,moves:state.movesUsed,cleared:state.cleared},null,2));
const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});try{for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 const p=await b.newPage({viewport,reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed='+seed);await readyTools(p);
 const initial=await p.evaluate(()=>window.gameDebug.snapshot().state);assert.equal(initial.stacks.length,5);
 for(const [i,a] of actions.entries()){await readyTools(p);await p.locator(`[data-magnet-color="${a.color}"]`).click();await keyboardPlace(p,a.cell);await p.waitForFunction(()=>window.gameDebug.snapshot().phase!=='resolving');
  const snapshot=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(snapshot.state.movesUsed,i+1);
  if([5,6,10,11].includes(i+1))await p.screenshot({path:`artifacts/progressive-spawn/move-${i+1}-${viewport.width}.png`});
 }
 await p.getByRole('dialog',{name:'Board full',exact:true}).waitFor();const end=await p.evaluate(()=>window.gameDebug.snapshot().state);assert.equal(end.terminal,'lost');assert.equal(end.stars,0);assert.equal(end.cleared,state.cleared);assert.equal(await p.locator('.magnet-tool:not(:disabled)').count(),0);
 await p.screenshot({path:`artifacts/progressive-spawn/lost-${viewport.width}.png`});await p.getByRole('button',{name:'Try again',exact:true}).click();assert.deepEqual(await p.evaluate(()=>window.gameDebug.snapshot().state),initial);assert.deepEqual(errors,[]);await p.close();
}console.log('Progressive spawn: 5 initial stacks, real counted move boundaries, full-board loss and exact retry passed; '+actions.length+' moves, counts '+counts.join(','));}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
