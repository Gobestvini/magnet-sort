// Deterministic WebGL frames: one solid mesh per real unit, including transit/clear.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out='artifacts/chip-browser';fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.gameDebug?.snapshot().renderer);
  const report=await page.evaluate(async()=>{
   const {createThreeBoard}=await import('/src/prototype/board.js');
   const {CHIP_HEIGHT}=await import('/src/prototype/chip.js');
   const {loadBoardTextures}=await import('/src/prototype/assets.js');
   const {prototypeLevels}=await import('/src/prototype/levels.js');
   const {createPrototypeState,applyMagnet}=await import('/src/prototype/model.js');
   const {makeTransferTimeline,sampleTransferTimeline}=await import('/src/prototype/motion.js');
   const {topColorCount}=await import('/src/prototype/chip.js');
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
       check(unit.height>0&&unit.height<=CHIP_HEIGHT+1e-6,'one element must have one physical thickness');
       if(!unit.moving)check(Math.abs(unit.position[1]-(.16+(unit.index+.5)*CHIP_HEIGHT))<1e-6,'stack index differs from physical layer');
      }
      for(const placement of snapshot.placement){
       check(placement.facing>.999999,'resting wafer is tilted relative to the tile');
       const span=points=>Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
       const coverage=span(placement.footprint)/span(placement.well);
       if(placement.scale>.999)check(coverage>.97&&coverage<.98,'inset leaves a visible gap or covers the border');
       // All six base vertices must stay inside every edge of the measured
       // inner well. This catches a displaced anchor and projection mismatch.
       for(const point of placement.footprint){
        const signs=placement.well.map((a,i)=>{const b=placement.well[(i+1)%6];return (b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);});
        check(signs.every(s=>s>=-1e-8)||signs.every(s=>s<=1e-8),'base crosses a cream tile border '+JSON.stringify({time,point,placement,signs}));
       }
      }
      const sample=sampleTransferTimeline(timeline,time);const groups=new Map();
      const clearing=new Set(timeline.segments.filter(s=>s.type==='unitsCleared'&&s.start<=time&&s.end>time).flatMap(s=>s.units.map(u=>u.id)));
      for(const p of sample.units)if(!p.from&&!clearing.has(p.id)){const id=p.cell.row+':'+p.cell.col;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p);}
      check(snapshot.counts.length===groups.size,'extra/missing counter');
      for(const [id,list]of groups){list.sort((a,b)=>a.index-b.index);check(snapshot.counts.find(c=>c.cell.row+':'+c.cell.col===id)?.count===topColorCount(list),'counter does not describe exposed color');}
      frames++;flights+=moving.size;
     }
     state=resolution.state;
    }
    board.draw(level,state);memory.push(board.snapshot().geometries);
   }
   check(memory.every(count=>count===memory[0]),'geometry accumulates across level changes');
   window.chipVisual={board,prototypeLevels,createPrototypeState,applyMagnet,makeTransferTimeline};
   return {frames,flights,geometryCounts:memory};
  });
  for(const [name,fraction] of [['settled',null],['flight-quarter',.25],['flight-half',.5],['flight-three-quarters',.75]]){
   await page.evaluate(fraction=>{
    const {board,prototypeLevels,createPrototypeState,applyMagnet,makeTransferTimeline}=window.chipVisual;
    const level=prototypeLevels[2],state=createPrototypeState(level);
    if(fraction===null)board.draw(level,state);
    else{const result=applyMagnet(state,level.solution[0]),timeline=makeTransferTimeline(state,result);const first=timeline.segments[0];board.draw(level,result.state,{timeline,time:first.start+(first.end-first.start)*fraction})}
   },fraction);
   await page.screenshot({path:`${out}/${name}.png`});
  }
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(width=>{const {board,prototypeLevels,createPrototypeState}=window.chipVisual;board.resize(width,650);const level={...prototypeLevels[2],stacks:[{cell:{col:3,row:3},units:Array.from({length:20},(_,i)=>({id:'tall-'+i,color:'violet'}))}]};const state=createPrototypeState(level);board.draw(level,state);const snap=board.snapshot();if(snap.meshes!==20||snap.counts[0].count!==20)throw Error('tall mismatch');},width);
   await page.screenshot({path:out+'/tall-'+width+'.png'});
  }
  await page.evaluate(()=>{const {board,prototypeLevels}=window.chipVisual;board.dispose();board.dispose();});
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
