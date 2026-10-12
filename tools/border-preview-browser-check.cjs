const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});fs.mkdirSync('artifacts/border-preview',{recursive:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed=2');await p.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
 const choice=await p.evaluate(async()=>{const {previewBorderRings}=await import('/src/prototype/border-preview.js');const s=window.gameDebug.snapshot().state;const color=s.magnets[0];for(const cell of s.cells){const plan=previewBorderRings(s,cell,color);if(plan&&plan.rings.flat().length>=16)return {cell,color,rings:plan.rings};}});assert.ok(choice);
 const begin=await p.evaluate(()=>window.gameDebug.snapshot().state);
 const tool=await p.locator(`[data-magnet-color="${choice.color}"]`).boundingBox(),target=await p.evaluate(c=>window.gameDebug.screenPosition(c),choice.cell);
 const canvasRect=await p.locator('canvas').boundingBox();fs.writeFileSync('artifacts/border-preview/target.json',JSON.stringify({color:choice.color,seed:2,x:(target.x-canvasRect.x)/canvasRect.width,y:(target.y-canvasRect.y)/canvasRect.height}));
 await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(target.x,target.y,{steps:8});
 for(const [ring,name] of [[0,'inner'],[1,'outer'],[0,'repeat']]){
  await p.waitForFunction(r=>{const s=window.gameDebug.snapshot().renderer.influence.ringStrengths;return s&&s[r]>.9&&s[1-r]===0;},ring,{timeout:4000});
  await p.screenshot({path:`artifacts/border-preview/${name}.png`});const snap=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(snap.renderer.influence.particles,0);assert.equal(snap.renderer.influence.waves,0);assert.equal(snap.rafScheduled,true);
 }
 await p.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('click');assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).renderer.influence.cells.length,0);await p.mouse.up();await p.getByRole('button',{name:'Resume',exact:true}).click();
 assert.deepEqual(await p.evaluate(()=>window.gameDebug.snapshot().state),begin);
 // Keyboard preview has no drag, but the same app-owned RAF keeps the idle cycle running.
 await p.locator('canvas').focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowRight');
 // Navigate from established centre to the chosen legal tile.
 for(let n=3;n<choice.cell.col;n++)await p.keyboard.press('ArrowRight');for(let n=3;n>choice.cell.col;n--)await p.keyboard.press('ArrowLeft');for(let n=3;n<choice.cell.row;n++)await p.keyboard.press('ArrowDown');for(let n=3;n>choice.cell.row;n--)await p.keyboard.press('ArrowUp');
 await p.waitForFunction(()=>window.gameDebug.snapshot().renderer.influence.cells.length>0);assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).drag,null);assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).rafScheduled,true);
 await p.evaluate(()=>window.gameDebug.setReducedMotion(true));await p.waitForTimeout(60);const reduced=await p.evaluate(()=>window.gameDebug.snapshot());assert.deepEqual(reduced.renderer.influence.ringStrengths,[.45,.45]);assert.equal(reduced.rafScheduled,false);
 await p.screenshot({path:'artifacts/border-preview/reduced-keyboard.png'});
 await p.evaluate(()=>window.gameDebug.reset());assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).renderer.influence.cells.length,0);assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).rafScheduled,false);
 // All seven colors, edge clipping and occupied/blocker borders in isolated view inspection.
 for(const color of ['violet','blue','coral','gold','lime','teal','pink']){
  const inspection=await p.evaluate(({choice,color})=>{const state=window.gameDebug.snapshot().state;state.magnets=[color];window.gameDebug.inspectInfluence(state,choice.cell,color,0);return window.gameDebug.inspectInfluence(state,choice.cell,color,.6);},{choice,color});
  assert.ok(inspection.influence.cells.every(c=>c.color===color));assert.ok(inspection.influence.ringStrengths[0]>.99);assert.equal(inspection.influence.ringStrengths[1],0);
 }
 await p.evaluate(()=>window.gameDebug.finishInspection());await p.setViewportSize({width:844,height:390});assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).renderer.influence.cells.length,0);
 assert.deepEqual(errors,[]);console.log('Border rings: sequential inner/outer/repeat while stationary, keyboard RAF, reduced/static, all colors, pause/reset/resize passed.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
