const{chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {readyTools,keyboardPlace}=require('./v4-browser-check.cjs');
(async()=>{
 fs.mkdirSync('artifacts/range-light',{recursive:true});const b=await chromium.launch({headless:true});
 try{for(const[name,viewport]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
 const p=await b.newPage({viewport,hasTouch:name==='mobile',isMobile:name==='mobile'}),errors=[];
 p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
 await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed=1');await p.waitForFunction(()=>window.gameDebug&&!document.querySelector('.loading-screen'));await readyTools(p);
 const badges=await p.locator('.magnet-tool').evaluateAll(ns=>ns.map(n=>({label:n.getAttribute('aria-label'),src:n.querySelector('.magnet-range img').getAttribute('src')})));
 assert(badges.some(b=>b.src.includes('range-map-1.png')));assert(badges.some(b=>b.src.includes('range-map-2.png')));assert(badges.every(b=>/hex rings?/.test(b.label)));assert.equal(await p.locator('.range-label,.floating-range').count(),0);assert.equal(await p.getByText(/^[12] RINGS?$/).count(),0);
 const centers=await p.locator('.magnet-tool').evaluateAll(ns=>ns.map(n=>{const a=n.getBoundingClientRect(),img=n.querySelector(':scope>img:not(.tutorial-hand)').getBoundingClientRect();return {dx:img.x+img.width/2-a.x-a.width/2,dy:img.y+img.height/2-a.y-a.height/2};}));assert(centers.every(c=>Math.abs(c.dx)<1&&Math.abs(c.dy)<1),JSON.stringify(centers));
 const setup=await p.evaluate(async()=>{
  const{createV4State,applyV4Magnet}=await import('/src/prototype/model-v4.js');const{resolveMagnetInfluence}=await import('/src/prototype/magnet-influence.js');
  const{makeTransferTimeline}=await import('/src/prototype/motion.js');const before=createV4State(window.gameDebug.getLevel(),1);before.magnets=['blue'];before.magnetRadii={blue:2};
  before.stacks=[[{col:3,row:2},6,'blue'],[{col:4,row:3},4,'blue'],[{col:5,row:3},5,'blue'],[{col:2,row:3},3,'coral']].map(([cell,n,color],c)=>({cell,units:Array.from({length:n},(_,i)=>({id:'s'+c+'u'+i,color}))}));
  before.spawnedUnits=18;const action={type:'placeMagnet',cell:{col:3,row:3},color:'blue'},resolution=applyV4Magnet(before,action),timeline=makeTransferTimeline(before,resolution);
  window.rangeFixture={before,resolution};
  return{sourceCount:resolution.influence.sources.length,arrivals:timeline.sourceArrivals,finish:timeline.deactivateStart,duration:timeline.duration,moves:timeline.segments.filter(s=>s.type==='unitMoved').length};
 });assert.equal(setup.sourceCount,3);assert.equal(setup.moves,15);
 let preview=await p.evaluate(()=>window.gameDebug.inspectInfluence(window.rangeFixture.before,{col:3,row:3},'blue',.8));
 assert.equal(preview.influence.lights.cells.length,3);assert.equal(preview.influence.particles,0);assert.equal(preview.influence.cells.length,18);
 assert.equal(preview.influence.lights.layers,3);assert.equal(preview.influence.lights.footprint.length,6);
 for(const order of preview.influence.lights.orders){
  const own=preview.units.filter(u=>u.cell?.row===order.cell.row&&u.cell?.col===order.cell.col);
  assert(own.length);assert(order.back<Math.min(...own.map(u=>u.renderOrder)));assert(order.front>Math.max(...own.map(u=>u.renderOrder)));
 }
 const idleA=preview.influence.lights.idle;
 const idleB=await p.evaluate(()=>window.gameDebug.inspectInfluence(window.rangeFixture.before,{col:3,row:3},'blue',1.3).influence.lights.idle);
 assert.notDeepEqual(idleA,idleB);
 await p.screenshot({path:'artifacts/range-light/'+name+'-preview.png',fullPage:true});
 for(const arrival of setup.arrivals){
 for(const[t,expected]of [[arrival.end,1],[arrival.end+.275,.5],[arrival.end+.56,0]]){
 const view=await p.evaluate(t=>{const{before,resolution}=window.rangeFixture;return window.gameDebug.inspectPresentation(before,resolution,t);},t);
 const lights=view.renderer.influence.lights,source=lights.sources.find(s=>s.cell.row===arrival.cell.row&&s.cell.col===arrival.cell.col);
 assert(Math.abs(source.strength-expected)<1e-8);assert.equal(lights.cells.some(c=>c.row===arrival.cell.row&&c.col===arrival.cell.col),expected>0);assert.equal(view.renderer.influence.particles,0);
 assert.equal(await p.locator('.collection-effects circle,.victory-particle').count(),0);
 }}
 const early=await p.evaluate(t=>{const{before,resolution}=window.rangeFixture;return window.gameDebug.inspectPresentation(before,resolution,t).renderer.influence.lights;},setup.arrivals[0].end+.56);
 assert.equal(early.sources[0].strength,0);assert.equal(early.sources.at(-1).strength,1);
 await p.screenshot({path:'artifacts/range-light/'+name+'-independent-fade.png',fullPage:true});
 const resources=await p.evaluate(()=>{let first,last;for(let i=0;i<20;i++){const{before,resolution}=window.rangeFixture;const r=window.gameDebug.inspectPresentation(before,resolution,.5).renderer;first??=r;last=r;}return{first,last};});
 assert.equal(resources.first.geometries,resources.last.geometries);assert.equal(resources.first.textures,resources.last.textures);
 const reduced=await p.evaluate(()=>{const{before,resolution}=window.rangeFixture;return window.gameDebug.inspectPresentation(before,resolution,.2,true);});assert.equal(reduced.renderer.influence.lights.cells.length,3);assert.equal(reduced.renderer.influence.particles,0);
 await p.evaluate(()=>window.gameDebug.finishInspection());
 // Real drag has no adjacent mini-map; tray icons alone communicate range.
 if(name==='desktop'){
 const tool=p.locator('.magnet-tool').first(),rect=await tool.boundingBox();await p.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await p.mouse.down();await p.mouse.move(640,380,{steps:10});
 assert.equal(await p.locator('.floating-range').count(),0);assert(await p.evaluate(()=>Boolean(window.gameDebug.snapshot().drag)));await p.mouse.move(50,500);await p.mouse.up();await p.waitForTimeout(900);assert.equal(await p.locator('.moves-panel strong').textContent(),'0');
 }
 // Live hover and keyboard preview matches actual source IDs.
 const planned=await p.evaluate(async()=>{const s=window.gameDebug.snapshot().state;const{canPlaceMagnet}=await import('/src/prototype/model.js');const{previewMagnetInfluence}=await import('/src/prototype/magnet-influence.js');for(const color of s.magnets)for(const cell of s.cells.filter(c=>canPlaceMagnet(s,c))){const plan=previewMagnetInfluence(s,cell,color);if(plan.sources.length)return{color,cell,sources:plan.sources};}});
 await p.locator('[data-magnet-color="'+planned.color+'"]').click();const at=await p.evaluate(cell=>window.gameDebug.screenPosition(cell),planned.cell);await p.mouse.move(at.x,at.y);await p.waitForTimeout(100);
 const live=await p.evaluate(()=>window.gameDebug.snapshot());assert.deepEqual(live.renderer.influence.lights.cells,planned.sources);
 await p.waitForTimeout(350);const liveIdle=await p.evaluate(()=>window.gameDebug.snapshot());assert.notDeepEqual(live.renderer.influence.lights.idle,liveIdle.renderer.influence.lights.idle);assert.deepEqual(live.state,liveIdle.state);
 await p.screenshot({path:'artifacts/range-light/'+name+'-live.png',fullPage:true});
 await keyboardPlace(p,planned.cell);await p.waitForTimeout(150);const active=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(active.renderer.influence.lights.cells.length,planned.sources.length);
 await p.evaluate(()=>window.gameDebug.setPaused(true));const frozen=await p.evaluate(()=>window.gameDebug.snapshot().timeline.elapsed);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>window.gameDebug.snapshot().timeline.elapsed),frozen);
 await p.getByRole('button',{name:'Resume',exact:true}).click();await p.evaluate(()=>window.gameDebug.finishTestPresentation());await readyTools(p);
 await p.getByRole('button',{name:'Restart',exact:true}).click();await readyTools(p);const reset=await p.evaluate(()=>window.gameDebug.snapshot());assert.equal(reset.state.movesUsed,0);assert(reset.state.stacks.every(s=>s.units.length<=10));
 for(const size of [{width:320,height:844},{width:844,height:390}]){await p.setViewportSize(size);await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const labels=await p.locator('.magnet-range').evaluateAll(ns=>ns.map(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.bottom<=b.bottom;}));assert(labels.every(Boolean));assert.equal(await p.locator('.floating-range,.range-label').count(),0);}assert.equal(await p.locator('canvas').count(),1);assert.deepEqual(errors,[]);await p.close();
 }}finally{await b.close();}
 console.log('Range badges, full-hex floor/back/front lights and animated idle, independent source fade after last arrival, centered magnets, zero particles, real input, pause/reset/resize/reduced and 20 resource cycles passed (desktop/mobile viewport).');
})().catch(e=>{console.error(e);process.exitCode=1;});
