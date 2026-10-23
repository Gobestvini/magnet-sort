// Exercise the actual board renderer, not just the painter-order helpers.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {readyTools}=require('./v4-browser-check.cjs');
const key=c=>`${c.row}:${c.col}`;
const tileKey=c=>`r${c.row}c${c.col}`;
const output=process.env.DRAW_ORDER_OUTPUT||'artifacts/draw-order';

function checkLayers(view){
 const tiles=new Map(view.tiles.map(t=>[t.id,t.renderOrder]));
 const grounded=view.units.filter(u=>!u.moving);
 for(const unit of grounded){
  const tile=tiles.get(tileKey(unit.cell));
  assert(unit.renderOrder>tile,'resting chip must cover its own tile');
  const below=grounded.find(u=>key(u.cell)===key(unit.cell)&&u.index===unit.index-1);
  if(below)assert(unit.renderOrder>below.renderOrder,'upper chip must cover lower chip');
  for(const next of view.tiles.filter(t=>Number(t.id.match(/^r(\d+)c/)[1])>unit.cell.row)){
   assert(unit.renderOrder<next.renderOrder,'nearer row must cover a resting stack behind it');
  }
 }
 for(const badge of view.counts.filter(b=>b.visible)){
  const own=grounded.filter(u=>key(u.cell)===key(badge.cell));
  assert(own.length&&own.every(u=>u.renderOrder<badge.renderOrder),'badge must cover its stack');
 }
 for(const light of view.influence.lights.orders){
  const own=grounded.filter(u=>key(u.cell)===key(light.cell));
  assert(tiles.get(tileKey(light.cell))<light.back&&light.back<light.floor);
  assert(own.every(u=>light.floor<u.renderOrder&&u.renderOrder<light.front),'light must surround its source chips');
 }
 const groundMax=Math.max(...view.tiles.map(t=>t.renderOrder),...grounded.map(u=>u.renderOrder),
  ...view.counts.map(b=>b.renderOrder),...view.influence.lights.orders.map(l=>l.front));
 for(const flight of view.units.filter(u=>u.moving))assert(flight.renderOrder>groundMax,'flight must cover ground, badges and light');
 assert.equal(new Set(view.units.map(u=>u.id)).size,view.units.length);
}

(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});const results=[];
 try{for(const [name,viewport]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  const p=await browser.newPage({viewport,hasTouch:name!=='desktop',isMobile:name!=='desktop'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed=1');
  await p.waitForFunction(()=>window.gameDebug&&!document.body.dataset.startup&&!document.querySelector('.loading-screen'));await readyTools(p);
  // The runtime's real tutorial describes its real state, not these synthetic
  // inspection fixtures. Keep that DOM overlay off the renderer evidence.
  await p.addStyleTag({content:'.tutorial-guide{visibility:hidden!important}'});
  await p.screenshot(); // Settle ResizeObserver before the frozen presentation.
  await p.clock.install({time:new Date('2026-10-23T10:00:00Z')});
  await p.clock.pauseAt(new Date('2026-10-23T10:00:01Z'));
  const idle=await p.evaluate(async()=>{
   const {createV4State}=await import('/src/prototype/model-v4.js');
   const {COLORS}=await import('/src/prototype/model.js');
   const s=createV4State(window.gameDebug.getLevel(),1),target={col:3,row:3};
   const cells=s.cells.filter(c=>!s.blockers.some(b=>b.row===c.row&&b.col===c.col)&&!(c.col===3&&c.row===3));
   s.stacks=Object.keys(COLORS).map((color,k)=>({cell:cells[k*2],units:Array.from({length:[1,6,9,8,6,9,1][k]},(_,i)=>({id:`idle-${k}-${i}`,color}))}));
   s.magnets=['blue'];s.magnetRadii={blue:2};window.orderIdle=s;
   return window.gameDebug.inspectInfluence(s,target,'blue',.8);
  });
  checkLayers(idle);
  await p.screenshot({path:`${output}/${name}-idle.png`});
  const directions=await p.evaluate(async()=>{
   const {neighborCells}=await import('/src/game/hex.js');return neighborCells({col:3,row:3});
  });
  let frames=0,movingFrames=0,clearFrames=0;
  for(const reduced of [false,true])for(let direction=0;direction<directions.length;direction++){
   const timeline=await p.evaluate(async({source,opposite,reduced})=>{
    const {createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');
    const before=createV4State(window.gameDebug.getLevel(),1);before.magnets=['blue'];before.magnetRadii={blue:2};
    before.stacks=[{cell:source,units:Array.from({length:9},(_,i)=>({id:'a'+i,color:i<3?'coral':'blue'}))},
     {cell:opposite,units:Array.from({length:7},(_,i)=>({id:'b'+i,color:i<1?'gold':'blue'}))}];
    before.spawnedUnits=16;
    const resolution=applyV4Magnet(before,{type:'placeMagnet',cell:{col:3,row:3},color:'blue'});
    if(!resolution.accepted)throw Error('fixture action rejected');
    window.orderFixture={before,resolution,reduced};
    return window.gameDebug.inspectPresentation(before,resolution,0,reduced).timeline;
   },{source:directions[direction],opposite:directions[(direction+3)%6],reduced});
   const move=timeline.segments.find(s=>s.type==='unitMoved');assert(move,'fixture must actually transfer chips');
   const clear=timeline.segments.find(s=>s.type==='unitsCleared');assert(clear,'fixture must reach a clear');
   const times=[...new Set([move.start,...[.25,.5,.75,.9999].map(f=>move.start+(move.end-move.start)*f),
    move.end,(clear.accentStart+clear.packStart)/2,(clear.packStart+clear.packEnd)/2,timeline.duration])];
   for(let frame=0;frame<times.length;frame++){
    const view=await p.evaluate(time=>{const f=window.orderFixture;return {...window.gameDebug.inspectPresentation(f.before,f.resolution,time,f.reduced),finalIds:f.resolution.state.stacks.flatMap(s=>s.units.map(u=>u.id))};},times[frame]);
    checkLayers(view.renderer);frames++;
    if(view.renderer.units.some(u=>u.moving))movingFrames++;
    for(const badge of view.renderer.counts)if(view.frame.hiddenCells.includes(key(badge.cell)))assert.equal(badge.visible,false,'transfer/packing badges stay hidden');
    if(times[frame]===times.at(-1)){
     assert.equal(view.frame.collected,10);assert.deepEqual(view.renderer.units.map(u=>u.id).sort(),view.finalIds.sort());
     assert.equal(view.renderer.magneticCell,null);assert.equal(view.renderer.influence.lights.cells.length,0);
    }
    if(times[frame]===(clear.accentStart+clear.packStart)/2){assert(view.renderer.counts.some(b=>b.visible&&b.count===10));clearFrames++;}
    if(!reduced&&[1,2,3,6].includes(frame)){
     await p.screenshot({path:`${output}/${name}-dir${direction}-frame${frame}.png`});
     assert(await p.evaluate(()=>window.gameDebug.snapshot().renderer.units.every(u=>/^[ab]\d+$/.test(u.id))),'screenshot must still show the fixture');
    }
   }
  }
  assert(movingFrames>0);assert.equal(clearFrames,12);
  const reuse=await p.evaluate(()=>{
   const f=window.orderFixture,draw=()=>window.gameDebug.inspectPresentation(f.before,f.resolution,.1,f.reduced).renderer;
   const first=draw();for(let i=0;i<20;i++)draw();return{first,last:draw()};
  });
  assert.equal(reuse.first.geometries,reuse.last.geometries);assert.equal(reuse.first.textures,reuse.last.textures);
  await p.evaluate(()=>window.gameDebug.finishInspection());await p.clock.resume();
  await p.getByRole('button',{name:'Pause',exact:true}).click();await p.getByRole('button',{name:'Resume',exact:true}).click();
  await p.evaluate(()=>window.gameDebug.reset());await readyTools(p);
  const reset=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(reset.state.movesUsed,0);checkLayers(reset.renderer);
  assert.deepEqual(errors,[]);results.push({name,frames,movingFrames,clearFrames,geometries:reuse.last.geometries,textures:reuse.last.textures});await p.close();
 }
 fs.writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
