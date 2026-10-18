const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const b=await chromium.launch({headless:true});fs.mkdirSync('artifacts/v4-visual',{recursive:true});
try{
for(const [name,viewport]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
const p=await b.newPage({viewport});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed=1');
await p.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
await p.screenshot({path:'artifacts/v4-visual/'+name+'-initial.png',fullPage:true});
const fixture=await p.evaluate(async()=>{
 const {createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');
 const {neighborCells}=await import('/src/game/hex.js');
 const base=createV4State({id:'visual',number:1,blockers:[{col:1,row:1}]},1);
 const target={col:3,row:3};
 return neighborCells(target).map((cell,index)=>{
  const before=structuredClone(base);before.stacks=[{cell,units:Array.from({length:10},(_,i)=>({id:'inspect'+i,color:'blue'}))}];
  before.magnets=['blue','gold','lime'];before.spawnedUnits=10;
  return {before,resolution:applyV4Magnet(before,{type:'placeMagnet',color:'blue',cell:target}),index};
 });
});
for(const f of fixture){
 const metadata=await p.evaluate(f=>window.gameDebug.inspectPresentation(f.before,f.resolution,0),f);
 const timeline=metadata.timeline;
 for(const fraction of [0,.25,.5,.75,1]){
  const move=timeline.segments.find(s=>s.type==='unitMoved');
  const time=move.start+(move.end-move.start)*fraction;
  const view=await p.evaluate(({f,time})=>window.gameDebug.inspectPresentation(f.before,f.resolution,time),{f,time});
  assert(view.renderer.magneticCell);
  const IDs=view.frame.units.map(x=>x.id);
  assert.equal(IDs.length,new Set(IDs).size);
  const hidden=new Set(view.frame.hiddenCells);
  for(const label of view.renderer.counts)if(hidden.has(label.cell.row+':'+label.cell.col))assert.equal(label.visible,false);
  await p.screenshot({path:`artifacts/v4-visual/${name}-dir${f.index}-${fraction}.png`});
 }
 const clear=timeline.segments.find(s=>s.type==='unitsCleared');
 const pre=await p.evaluate(({f,time})=>window.gameDebug.inspectPresentation(f.before,f.resolution,time),{f,time:(clear.accentStart+clear.packStart)/2});
 assert(pre.renderer.counts.some(x=>x.visible&&x.count===10));
 const packed=await p.evaluate(({f,time})=>window.gameDebug.inspectPresentation(f.before,f.resolution,time),{f,time:(clear.packStart+clear.packEnd)/2});
 assert.equal(packed.renderer.counts.some(x=>x.visible&&x.cell.col===3&&x.cell.row===3),false);
 const end=await p.evaluate(({f,time})=>window.gameDebug.inspectPresentation(f.before,f.resolution,time),{f,time:timeline.duration});
 assert.equal(end.renderer.magneticCell,null);
 assert.equal(end.frame.collected,f.resolution.state.cleared);
 const flight=clear.flights[0],flightTime=flight.start+(flight.end-flight.start)*.95;
 await p.evaluate(({f,time})=>window.gameDebug.inspectPresentation(f.before,f.resolution,time),{f,time:flightTime});
 const endpoint=await p.evaluate(()=>{
  const image=document.querySelector('.collection-hex'),track=document.querySelector('.progress-track'),rect=track.getBoundingClientRect();
  return image?{x:+image.dataset.targetX,y:+image.dataset.targetY,left:rect.left,right:rect.right,centerY:rect.top+rect.height/2}:null;
 });
 assert(endpoint);assert.ok(endpoint.x>=endpoint.left&&endpoint.x<=endpoint.right);assert.ok(Math.abs(endpoint.y-endpoint.centerY)<.1);
}
await p.evaluate(()=>window.gameDebug.finishInspection());
for(const color of ['violet','blue','coral','gold','lime','teal','pink']){
 const result=await p.evaluate(async color=>{
  const {createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');
  const s=createV4State({id:'color-proof',number:1,blockers:[{col:1,row:1}]},0);
  s.stacks=[];s.spawnedUnits=0;s.magnets=[color,...Object.keys((await import('/src/prototype/model.js')).COLORS).filter(c=>c!==color).slice(0,2)];
  const r=applyV4Magnet(s,{type:'placeMagnet',color,cell:{col:3,row:3}});
  return window.gameDebug.inspectPresentation(s,r,.15);
 },color);
 assert.equal(result.renderer.magneticCell.color,color);
 await p.screenshot({path:'artifacts/v4-visual/'+name+'-border-'+color+'.png'});
}
await p.evaluate(()=>window.gameDebug.finishInspection());
for(const width of [320,390,900]){
 await p.setViewportSize({width,height:width===900?500:844});
 await p.screenshot({path:'artifacts/v4-visual/'+name+'-layout'+width+'.png',fullPage:true});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
await p.setViewportSize(viewport);
await p.waitForTimeout(11500);
await p.screenshot({path:'artifacts/v4-visual/'+name+'-idle-cycle.png',fullPage:true});
const snapshot=()=>p.evaluate(()=>window.gameDebug.snapshot());
const start=await snapshot();
const action=await p.evaluate(()=>{const s=window.gameDebug.snapshot().state;const c=s.cells.find(c=>!s.stacks.some(x=>x.cell.col===c.col&&x.cell.row===c.row)&&!s.blockers.some(x=>x.col===c.col&&x.row===c.row));return {type:'placeMagnet',color:s.magnets[0],cell:c};});
await p.evaluate(a=>window.gameDebug.playTestAction(a),action);
await p.getByRole('button',{name:'Pause',exact:true}).click();
const frozen=await snapshot();await p.waitForTimeout(200);assert.equal((await snapshot()).timeline.elapsed,frozen.timeline.elapsed);
await p.getByRole('button',{name:'Resume',exact:true}).click();
await p.getByRole('button',{name:'Restart',exact:true}).click();
assert.deepEqual((await snapshot()).state,start.state);
for(let i=0;i<20;i++)await p.evaluate(()=>window.gameDebug.reset());
const ending=await snapshot();assert.equal(ending.renderer.geometries,start.renderer.geometries);
const tool=await p.locator('.magnet-tool').first().boundingBox();
await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();
await p.mouse.move(5,5,{steps:8});await p.mouse.up();
await p.waitForTimeout(300);assert.deepEqual((await snapshot()).state,start.state,'invalid drop must preserve RNG, queue and moves');
assert.deepEqual(errors,[]);await p.close();
}
console.log('V4 visual: six directions x five frames x desktop/mobile, 10-unit identity, hidden/pre-clear badges, border reset, responsive layouts, pause/reset and 20 GPU reuse cycles passed.');
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

