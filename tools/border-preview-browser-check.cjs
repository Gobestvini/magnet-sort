const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});fs.mkdirSync('artifacts/border-preview',{recursive:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5183/')+'?seed=2');await p.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
 const choice=await p.evaluate(async()=>{const {previewBorderRings}=await import('/src/prototype/border-preview.js');const s=window.gameDebug.snapshot().state;const color=s.magnets[0];for(const cell of s.cells){const plan=previewBorderRings(s,cell,color);if(plan&&plan.rings.flat().length>=16)return {cell,color,rings:plan.rings};}});assert.ok(choice);
 const begin=await p.evaluate(()=>window.gameDebug.snapshot().state);
 const tool=await p.locator('[data-magnet-color="'+choice.color+'"]').boundingBox(),target=await p.evaluate(c=>window.gameDebug.screenPosition(c),choice.cell);
 await p.mouse.move(target.x,target.y);await p.waitForFunction(()=>window.gameDebug.snapshot().renderer.influence.particles>0);
 assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).gesture,false);
 await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(target.x,target.y,{steps:8});
 await p.waitForFunction(()=>window.gameDebug.snapshot().renderer.influence.particles>0);
 const before=await p.evaluate(()=>window.gameDebug.snapshot().renderer.influence);
 await p.waitForTimeout(180);const after=await p.evaluate(()=>window.gameDebug.snapshot());
 assert.deepEqual(after.renderer.influence.cells,[]);assert.equal(after.renderer.influence.particles,choice.rings.flat().length*3);assert.equal(after.renderer.influence.waves,0);
 assert.ok(after.renderer.influence.arcs.some((a,i)=>a.progress!==before.arcs[i].progress));assert.equal(after.rafScheduled,true);
 await p.screenshot({path:'artifacts/border-preview/held-mobile.png'});
 await p.getByRole('button',{name:'Pause',exact:true}).dispatchEvent('click');assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).renderer.influence.particles,0);
 await p.mouse.up();await p.getByRole('button',{name:'Resume',exact:true}).click();assert.deepEqual(await p.evaluate(()=>window.gameDebug.snapshot().state),begin);
 // Stationary keyboard candidate uses the same runtime clock.
 await p.locator('canvas').focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowRight');
 for(let n=3;n<choice.cell.col;n++)await p.keyboard.press('ArrowRight');for(let n=3;n>choice.cell.col;n--)await p.keyboard.press('ArrowLeft');for(let n=3;n<choice.cell.row;n++)await p.keyboard.press('ArrowDown');for(let n=3;n>choice.cell.row;n--)await p.keyboard.press('ArrowUp');
 await p.waitForFunction(()=>window.gameDebug.snapshot().renderer.influence.particles>0);assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).drag,null);
 await p.evaluate(()=>window.gameDebug.setReducedMotion(true));await p.waitForTimeout(80);
 const reduced=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(reduced.renderer.influence.particles,0);assert.deepEqual(reduced.renderer.influence.cells,[]);assert.equal(reduced.rafScheduled,false);
 await p.screenshot({path:'artifacts/border-preview/reduced-keyboard.png'});
 await p.evaluate(()=>window.gameDebug.reset());
 for(const color of ['violet','blue','coral','gold','lime','teal','pink']){
  const inspection=await p.evaluate(({choice,color})=>{const s=window.gameDebug.snapshot().state;s.magnets=[color];window.gameDebug.inspectInfluence(s,choice.cell,color,0);return window.gameDebug.inspectInfluence(s,choice.cell,color,.6);},{choice,color});
  assert.equal(inspection.influence.particles,choice.rings.flat().length*3);assert.ok(inspection.influence.arcs.every(a=>a.color===color));assert.deepEqual(inspection.influence.cells,[]);
 }
 await p.evaluate(()=>window.gameDebug.setReducedMotion(false));
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  await p.setViewportSize(viewport);
  for(const t of [0,.4,.8]){
   const view=await p.evaluate(({choice,t})=>{const s=window.gameDebug.snapshot().state;window.gameDebug.inspectInfluence(s,choice.cell,choice.color,0);return window.gameDebug.inspectInfluence(s,choice.cell,choice.color,t);},{choice,t});
   assert.deepEqual(view.influence.cells,[]);assert.ok(view.influence.arcs.some(a=>a.position.y>(a.from.y+a.to.y)/2+.8));
   await p.screenshot({path:'artifacts/border-preview/phase-'+viewport.width+'-'+t+'.png'});
  }
 }
 const memory=await p.evaluate(()=>{const r=window.gameDebug.snapshot().renderer;return {geometries:r.geometries,textures:r.textures};});
 for(let i=0;i<20;i++)await p.evaluate(({choice})=>{const s=window.gameDebug.snapshot().state;window.gameDebug.inspectInfluence(s,choice.cell,choice.color,0);window.gameDebug.inspectInfluence(s,choice.cell,choice.color,.4);window.gameDebug.reset();},{choice});
 assert.deepEqual(await p.evaluate(()=>{const r=window.gameDebug.snapshot().renderer;return {geometries:r.geometries,textures:r.textures};}),memory);
 const invalid=await p.evaluate(()=>{const s=window.gameDebug.snapshot().state;return [...s.blockers,...s.stacks.map(x=>x.cell),{col:20,row:20}].map(cell=>window.gameDebug.inspectInfluence(s,cell,s.magnets[0],.5).influence);});
 assert.ok(invalid.every(f=>f.particles===0&&f.cells.length===0));
 await p.evaluate(()=>window.gameDebug.finishInspection());await p.setViewportSize({width:844,height:390});assert.equal((await p.evaluate(()=>window.gameDebug.snapshot())).renderer.influence.particles,0);
 assert.deepEqual(errors,[]);console.log('High inward particles: all cells x3, stationary drag/keyboard RAF, no source highlights, reduced/pause, seven colors, three viewports, invalid targets and 20 resource reuse cycles passed.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
