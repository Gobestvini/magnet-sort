const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {readyTools}=require('./v4-browser-check.cjs');
(async()=>{
 const baseline=process.env.COMPACT_BASELINE==='1',output=process.env.COMPACT_OUTPUT||'artifacts/compact-stacks';
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});const results=[];
 try{for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  const page=await browser.newPage({viewport,hasTouch:name!=='desktop',isMobile:name!=='desktop'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5186/')+'?seed=1');
  await page.waitForFunction(()=>window.gameDebug&&!document.body.dataset.startup&&!document.querySelector('.loading-screen'));await readyTools(page);
  await page.screenshot(); // Flush final layout/ResizeObserver before freezing a fixture.
  await page.clock.install({time:new Date('2026-10-20T10:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-20T10:00:01Z'));
  const measurements=await page.evaluate(async()=>{
   const {COLORS,canPlaceMagnet}=await import('/src/prototype/model.js');
   const {createV4State}=await import('/src/prototype/model-v4.js');
   const s=createV4State(window.gameDebug.getLevel(),1);s.stacks=[];s.magnets=['blue'];
   const cells=s.cells.filter(c=>canPlaceMagnet(s,c)),colors=Object.keys(COLORS);
   s.stacks=colors.map((color,k)=>({cell:cells[k*3],units:Array.from({length:[1,6,8,9,8,6,9][k]},(_,i)=>({id:'fixture-'+k+'-'+i,color:i<3&&k===3?'blue':color}))}));
   window.compactFixture=s;
   const rendered=window.gameDebug.inspectInfluence(s,cells.at(-1),'invalid',0),step=[];
   for(const stack of s.stacks){
    const meshes=rendered.units.filter(u=>stack.units.some(v=>v.id===u.id));
    if(meshes.length!==stack.units.length)throw Error('missing chip');
    for(let i=1;i<meshes.length;i++)step.push(meshes[i].position[1]-meshes[i-1].position[1]);
   }
   return{step:Math.min(...step),maxStep:Math.max(...step),count:rendered.units.length,geometries:rendered.geometries};
  });
  assert(Math.abs(measurements.step-measurements.maxStep)<1e-8);if(!baseline)assert(measurements.maxStep<=.1);
  for(let attempt=0;attempt<3;attempt++){
   await page.evaluate(()=>window.gameDebug.inspectInfluence(window.compactFixture,window.compactFixture.cells.at(-1),'invalid',0));
   await page.screenshot({path:output+'/'+name+'-all-colors.png'});
   if(await page.evaluate(()=>window.gameDebug.snapshot().renderer.units.every(u=>u.id.startsWith('fixture-'))))break;
   if(attempt===2)throw Error('fixture replaced before screenshot');
  }
  if(!baseline)for(const reduced of [false,true]){
   const check=await page.evaluate(async reduced=>{
    const {createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');
    const {makeTransferTimeline}=await import('/src/prototype/motion.js');
    const target={col:3,row:3},s=createV4State(window.gameDebug.getLevel(),1);s.magnets=['blue'];s.magnetRadii={blue:2};s.cleared=0;
    s.stacks=[{cell:{col:3,row:2},units:Array.from({length:6},(_,i)=>({id:'a'+i,color:'blue'}))},
     {cell:{col:4,row:3},units:Array.from({length:8},(_,i)=>({id:'b'+i,color:'blue'}))},
     {cell:{col:1,row:5},units:Array.from({length:10},(_,i)=>({id:'hidden'+i,color:i<5?'pink':'coral'}))}];
    s.spawnedUnits=24;const r=applyV4Magnet(s,{type:'placeMagnet',cell:target,color:'blue'}),timeline=makeTransferTimeline(s,r,reduced);
    const start=window.gameDebug.inspectPresentation(s,r,0,reduced);
    for(const time of [timeline.duration/2,timeline.duration,...timeline.segments.filter(e=>e.type==='unitMoved').flatMap(e=>[e.start,e.end])]){
     const snap=window.gameDebug.inspectPresentation(s,r,time,reduced);
     const ids=snap.frame.units.map(u=>u.id);if(new Set(ids).size!==ids.length)throw Error('duplicate ID');
    }
    const warmed=window.gameDebug.inspectPresentation(s,r,timeline.duration/2,reduced).renderer;
    for(let i=0;i<20;i++)if(window.gameDebug.inspectPresentation(s,r,timeline.duration/2,reduced).renderer.geometries!==warmed.geometries)throw Error('geometry growth');
    const finish=window.gameDebug.inspectPresentation(s,r,timeline.duration,reduced);
    return{initial:start.frame.collected,final:finish.frame.collected,cleared:r.state.cleared,remaining:r.state.stacks.map(s=>s.units.length)};
   },reduced);
   assert.equal(check.initial,0);assert.equal(check.final,20);assert.equal(check.cleared,20);assert(check.remaining.every(n=>n<10));
   await page.screenshot({path:output+'/'+name+'-collected-'+reduced+'.png',fullPage:true});
  }
  await page.evaluate(()=>window.gameDebug.finishInspection());
  await page.clock.resume();
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.evaluate(()=>window.gameDebug.reset());await readyTools(page);
  const restart=await page.evaluate(()=>window.gameDebug.snapshot().state);assert.equal(restart.movesUsed,0);if(!baseline)assert(restart.stacks.every(s=>s.units.length<10));
  assert.deepEqual(errors,[]);results.push({name,...measurements});await page.close();
 }
 fs.writeFileSync(output+'/result.json',JSON.stringify(results,null,2));console.log(JSON.stringify({baseline,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
