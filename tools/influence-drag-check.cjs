const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',args:process.env.BROWSER_STABLE==='1'?['--js-flags=--no-opt','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});fs.mkdirSync('artifacts/followup-browser',{recursive:true});try{
const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5181/')+'?seed=2');await p.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
const start=await p.evaluate(()=>window.gameDebug.snapshot());
let warmedResources;
const choice=await p.evaluate(async()=>{
 const {previewBorderRings}=await import('/src/prototype/border-preview.js');const s=window.gameDebug.snapshot().state;
 for(const color of s.magnets)for(const cell of s.cells){const plan=previewBorderRings(s,cell,color);if(plan?.rings.flat().length)return {cell,color,ids:plan.particleCells.map(c=>`${c.row}:${c.col}`),rimIds:plan.rings.flat().map(c=>`${c.row}:${c.col}`)};}
});assert.ok(choice);
for(let i=0;i<20;i++){
 const tool=await p.locator(`[data-magnet-color="${choice.color}"]`).boundingBox();
 const target=await p.evaluate(c=>window.gameDebug.screenPosition(c),choice.cell);
 await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(target.x,target.y,{steps:8});await p.waitForTimeout(220);
 const s=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(s.renderer.influence.particles,choice.ids.length*3);assert.equal(s.renderer.influence.waves,0);
 assert.deepEqual(new Set(s.renderer.influence.cells.map(c=>`${c.cell.row}:${c.cell.col}`)),new Set(choice.rimIds));
 assert.deepEqual(new Set(s.renderer.influence.arcs.map(c=>`${c.cell.row}:${c.cell.col}`)),new Set(choice.ids));
 if(i===0){await p.screenshot({path:'artifacts/followup-browser/mobile-real-drag.png'});await p.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('click');assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).gesture,false);await p.getByRole('button',{name:'Resume',exact:true}).click();}
 await p.mouse.move(2,2,{steps:4});await p.mouse.up();await p.waitForTimeout(280);
 assert.deepEqual((await p.evaluate(()=>window.gameDebug.snapshot())).state,start.state);
 if(i===0)warmedResources=(await p.evaluate(()=>window.gameDebug.snapshot())).renderer;
}
const end=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(end.renderer.geometries,warmedResources.geometries);assert.equal(end.renderer.textures,warmedResources.textures);
await p.evaluate(()=>window.gameDebug.setReducedMotion(true));
const tool=await p.locator(`[data-magnet-color="${choice.color}"]`).boundingBox(),target=await p.evaluate(c=>window.gameDebug.screenPosition(c),choice.cell);
await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(target.x,target.y);await p.waitForTimeout(120);
const reduced=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(reduced.renderer.influence.particles,0);assert.equal(reduced.renderer.influence.cells.length,choice.rimIds.length);
await p.mouse.move(2,2);await p.mouse.up();assert.deepEqual(errors,[]);
console.log('20 real pointer drag/cancel cycles, truthful preview, pause cancellation, fixed GPU resources and reduced-motion zone passed.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
