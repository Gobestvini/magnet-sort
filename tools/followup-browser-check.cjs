const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5181/';
(async()=>{const browser=await chromium.launch();fs.mkdirSync('artifacts/followup-browser',{recursive:true});try{
 for(const [name,viewport]of [['narrow',{width:320,height:740}],['mobile',{width:390,height:844}],['desktop',{width:1280,height:900}],['landscape',{width:900,height:500}]]){
  const p=await browser.newPage({viewport});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'docs/design/victory-v2/preview.html');await p.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(n=>n.decode())));
  for(const n of ['1','2','3','12']){await p.locator('#variant').selectOption(n);await p.screenshot({path:`artifacts/followup-browser/${name}-preview-${n}.png`});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await p.goto(base+'?seed=2');await p.waitForFunction(()=>window.gameDebug&&!window.gameDebug.snapshot().loading);
  await p.screenshot({path:`artifacts/followup-browser/${name}-initial.png`});
  const result=await p.evaluate(async()=>{
   const {createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');
   const {previewMagnetInfluence}=await import('/src/prototype/magnet-influence.js');
   const s=createV4State({id:'effects',number:1,blockers:[{col:1,row:1}]},2),target={col:3,row:3};
   s.stacks=[{cell:{col:5,row:3},units:Array.from({length:6},(_,i)=>({id:'fx'+i,color:'blue'}))}];s.magnets=['blue','gold','pink'];s.spawnedUnits=6;
   const resolution=applyV4Magnet(s,{type:'placeMagnet',cell:target,color:'blue'});
   return {s,target,resolution,plan:previewMagnetInfluence(s,target,'blue')};
  });
  const inspected=await p.evaluate(({s,resolution})=>window.gameDebug.inspectPresentation(s,resolution,.45),result);
  assert.ok(inspected.renderer.influence.waves>0);assert.ok(inspected.renderer.influence.waves<=12);
  await p.screenshot({path:`artifacts/followup-browser/${name}-waves.png`});
  const preview=await p.evaluate(({s,target})=>{
    window.gameDebug.inspectInfluence(s,target,'blue',1);
    return window.gameDebug.inspectInfluence(s,target,'blue',1.2);
  },result);
  assert.equal(preview.influence.cells.length,18);assert.equal(preview.influence.particles,0);
  assert.equal(preview.influence.radialWaves.length,3);
  await p.screenshot({path:`artifacts/followup-browser/${name}-influence.png`});
  const reduced=await p.evaluate(({s,target})=>window.gameDebug.inspectInfluence(s,target,'blue',1.3,true),result);
  assert.equal(reduced.influence.particles,0);assert.equal(reduced.influence.waves,0);
  assert.equal(reduced.influence.reduced,true);assert.deepEqual(reduced.influence.radialWaves,[]);
  await p.evaluate(()=>window.gameDebug.reset());
  await p.waitForFunction(()=>!window.gameDebug.snapshot().paused);
  // Verify shared cover transforms and original sweep duration.
  const style=await p.evaluate(()=>({bg:getComputedStyle(document.body).backgroundImage,mask:getComputedStyle(document.querySelector('.idle-grid')).maskSize,duration:getComputedStyle(document.querySelector('.idle-grid-sweep')).animationDuration}));
  assert.ok(style.bg.includes('background-v2.png'));assert.equal(style.mask,'cover');assert.equal(style.duration,'11s');
  await p.waitForTimeout(11000);await p.screenshot({path:`artifacts/followup-browser/${name}-idle-cycle.png`});
  assert.deepEqual(errors,[]);await p.close();
 }
 console.log('Followup preview 1/2/3/final, 320/mobile/desktop/landscape, same-source cover mask, full 11s idle and working waves passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
