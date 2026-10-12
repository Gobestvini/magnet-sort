const {chromium}=require('playwright');
const {route,keyboardPlace}=require('./v4-browser-check.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch();try{
const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed=1');
await p.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
for(const number of [2,12]){
 const planned=await route(number);await p.evaluate(({number,seed})=>window.gameDebug.loadLevel(number-1,seed),{number,seed:planned.seed});
 for(const action of planned.actions){await p.locator('[data-magnet-color="'+action.color+'"]').click();await keyboardPlace(p,action.cell);await p.evaluate(()=>window.gameDebug.finishTestPresentation());}
 await p.getByRole('region',{name:'Result',exact:true}).waitFor();
 const s=await p.evaluate(()=>window.gameDebug.snapshot());
 assert.equal(s.state.goal,50*number);assert.equal(s.state.cleared,planned.state.cleared);assert.equal(s.displayedCleared,s.state.cleared);
 assert.equal(s.state.movesUsed,planned.actions.length);
 await p.screenshot({path:'artifacts/v4-visual/level'+number+'-victory.png',fullPage:true});
 console.log('Browser level '+number+' goal reached: '+s.state.cleared+' in '+s.state.movesUsed+' real actions (presentation end sampled).');
}
await p.close();
const sheet=await b.newPage({viewport:{width:1120,height:620}});
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5175/';
const colors=['violet','blue','coral','gold','lime','teal','pink'];
await sheet.setContent('<style>body{margin:0;background:#3929bc;color:white;font:18px sans-serif}main{display:flex}section{width:160px;text-align:center}img{display:block;width:140px;height:140px;object-fit:contain;margin:10px}</style><main>'+colors.map(c=>'<section><h3>'+c+'</h3>'+['magnet-','chip-','tile-magnetic-'].map(k=>'<img src="'+new URL('art/mockup/'+k+c+'.png',base)+'">').join('')+'</section>').join('')+'</main>');
await sheet.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(i=>i.decode())));
await sheet.screenshot({path:'artifacts/v4-visual/seven-color-contact.png',fullPage:true});
await sheet.close();
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

