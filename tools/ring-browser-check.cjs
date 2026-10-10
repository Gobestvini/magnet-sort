// Deterministic WebGL frames: one solid mesh per real unit, including transit/clear.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out='artifacts/ring-browser';fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.gameDebug?.snapshot().renderer);
  const report=await page.evaluate(async()=>{
   const {createThreeBoard}=await import('/src/prototype/board.js');
   const {RING_HEIGHT}=await import('/src/prototype/ring.js');
   const {loadBoardTextures}=await import('/src/prototype/assets.js');
   const {prototypeLevels}=await import('/src/prototype/levels.js');
   const {createPrototypeState,applyMagnet}=await import('/src/prototype/model.js');
   const {makeTransferTimeline}=await import('/src/prototype/motion.js');
   window.gameDebug.dispose();document.body.replaceChildren();
   const canvas=document.createElement('canvas');canvas.style.cssText='width:390px;height:650px';document.body.append(canvas);
   const board=createThreeBoard(canvas,await loadBoardTextures());board.resize(390,650);
   board.draw(prototypeLevels[2],createPrototypeState(prototypeLevels[2]));
   const check=(condition,message)=>{if(!condition)throw new Error(message)};
   let frames=0,flights=0;const memory=[];
   for(const reduced of [false,true])for(const level of prototypeLevels){
    let state=createPrototypeState(level);
    board.draw(level,state);
    for(const cell of level.cells){
     const at=board.screenPosition(cell),picked=board.pick(at.x,at.y);
     check(picked?.col===cell.col&&picked?.row===cell.row,'visible tile centre picks a different cell');
    }
    for(const action of level.solution){
     const resolution=applyMagnet(state,action),timeline=makeTransferTimeline(state,resolution,reduced);
     const initial=state.stacks.flatMap(stack=>stack.units.map(unit=>unit.id));
     const times=new Set([0,timeline.duration,...timeline.segments.flatMap(s=>[s.start,s.start+(s.end-s.start)*.25,s.start+(s.end-s.start)*.5,s.start+(s.end-s.start)*.75,s.end])]);
     for(const time of [...times].sort((a,b)=>a-b)){
      board.draw(level,resolution.state,{timeline,time});const snapshot=board.snapshot();
      const removed=new Set(timeline.segments.filter(s=>s.type==='unitsCleared'&&s.end<=time).flatMap(s=>s.units.map(u=>u.id)));
      const expected=initial.filter(id=>!removed.has(id)).sort(),actual=snapshot.units.map(u=>u.id).sort();
      check(JSON.stringify(actual)===JSON.stringify(expected),'rendered units differ from actual unremoved unit IDs');
      check(new Set(actual).size===actual.length&&snapshot.meshes===actual.length,'duplicate or phantom unit mesh');
      const moving=new Set(timeline.segments.filter(s=>s.type==='unitMoved'&&s.start<=time&&s.end>time).map(s=>s.unit.id));
      check(snapshot.units.filter(u=>u.moving).length===moving.size,'flight count differs from moving unit meshes');
      for(const unit of snapshot.units){
       check(unit.height>0&&unit.height<=RING_HEIGHT+1e-6,'one element must have one physical thickness');
       if(!unit.moving)check(Math.abs(unit.position[1]-(.16+(unit.index+.5)*RING_HEIGHT))<1e-6,'stack index differs from physical layer');
      }
      frames++;flights+=moving.size;
     }
     state=resolution.state;
    }
    board.draw(level,state);memory.push(board.snapshot().geometries);
   }
   check(memory.every(count=>count===memory[0]),'geometry accumulates across level changes');
   window.ringVisual={board,prototypeLevels,createPrototypeState,applyMagnet,makeTransferTimeline};
   return {frames,flights,geometryCounts:memory};
  });
  for(const [name,fraction] of [['settled',null],['flight-quarter',.25],['flight-half',.5],['flight-three-quarters',.75]]){
   await page.evaluate(fraction=>{
    const {board,prototypeLevels,createPrototypeState,applyMagnet,makeTransferTimeline}=window.ringVisual;
    const level=prototypeLevels[2],state=createPrototypeState(level);
    if(fraction===null)board.draw(level,state);
    else{const result=applyMagnet(state,level.solution[0]),timeline=makeTransferTimeline(state,result);const first=timeline.segments[0];board.draw(level,result.state,{timeline,time:first.start+(first.end-first.start)*fraction})}
   },fraction);
   await page.screenshot({path:`${out}/${name}.png`});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
