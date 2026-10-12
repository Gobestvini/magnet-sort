const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {readyTools,keyboardPlace}=require('./v4-browser-check.cjs');
const witnesses=require('./fixtures/earned-star-witnesses.json');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5175/';
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});fs.mkdirSync('artifacts/moves-stars',{recursive:true});try{
  const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const fixture=witnesses.find(w=>w.stars===1);
  await p.goto(base+'?seed='+fixture.seed);await readyTools(p);
  for(const [i,action] of fixture.actions.entries()){
    const goal=50,moves=i,expected=moves<=5?3:moves<=9?2:1;
    await p.getByRole('img',{name:`Potential stars: ${expected} of 3`,exact:true}).waitFor();
    const before=await p.locator('.potential-stars').getAttribute('aria-label');
    if(i===0){
      await p.getByRole('button',{name:'Pause',exact:true}).click();await p.getByRole('button',{name:'Resume',exact:true}).click();
      assert.equal(await p.locator('.potential-stars').getAttribute('aria-label'),before);
      const bad=await p.evaluate(()=>window.gameDebug.snapshot().state.blockers[0]);await keyboardPlace(p,bad);
      assert.equal(await p.locator('.moves-panel strong').textContent(),'0');
      const tool=await p.locator('.magnet-tool').first().boundingBox();await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(2,2);await p.mouse.up();await p.waitForTimeout(350);
      assert.equal(await p.locator('.potential-stars').getAttribute('aria-label'),before);
    }
    await readyTools(p);await p.locator(`[data-magnet-color="${action.color}"]`).click();await keyboardPlace(p,action.cell);
    if(i<fixture.actions.length-1)await readyTools(p);
    if([0,5,9].includes(i))await p.screenshot({path:`artifacts/moves-stars/real-move-${i+1}.png`});
  }
  await p.getByRole('dialog',{name:'Victory',exact:true}).waitFor();assert.equal(await p.locator('.earned-stars .earned').count(),1);
  await p.getByRole('button',{name:'Play again',exact:true}).click();await p.getByRole('img',{name:'Potential stars: 3 of 3',exact:true}).waitFor();
  for(const viewport of [{width:320,height:720},{width:390,height:844},{width:900,height:900},{width:844,height:390}]){
    await p.setViewportSize(viewport);if(await p.getByRole('dialog',{name:'Paused',exact:true}).count())await p.getByRole('button',{name:'Resume',exact:true}).click();await p.waitForTimeout(350);
    const boxes=await p.evaluate(()=>Object.fromEntries(['.potential-stars','.moves-panel','.goal-panel','.topbar'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x,y:r.y,b:r.bottom,r:r.right}];})));
    assert.ok(Object.values(boxes).every(r=>r.x>=0&&r.r<=viewport.width+1));assert.ok(boxes['.potential-stars'].b<=boxes['.moves-panel'].y+1);
    const overlap=await p.evaluate(()=>{const stars=[...document.querySelectorAll('.potential-stars img')].map(n=>n.getBoundingClientRect());return ['.brand','.level-badge','.topbar .round-button','.goal-panel'].some(s=>{const r=document.querySelector(s).getBoundingClientRect();return stars.some(a=>a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top);});});assert.equal(overlap,false);
    const unchanged=await p.evaluate(()=>{const selectors=['.brand','.level-badge','.hud','.goal-panel','.moves-panel','.board-host','.controls'];const rects=()=>selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height];});const before=rects(),group=document.querySelector('.moves-group'),moves=group.querySelector('.moves-panel'),parent=group.parentNode;parent.insertBefore(moves,group);group.remove();const after=rects();parent.insertBefore(group,moves);group.append(moves);return {before,after};});assert.deepEqual(unchanged.before,unchanged.after,'stars must not alter original HUD/board layout');
    await p.screenshot({path:`artifacts/moves-stars/viewport-${viewport.width}.png`,fullPage:true});
  }
  // Explicitly isolated presentation fixture, never injected into production model/debug API.
  await p.setViewportSize({width:390,height:844});
  for(const [goal,moves,expected] of [[50,5,3],[50,6,2],[50,9,2],[50,10,1],[100,9,3],[100,10,2],[100,17,2],[100,18,1],[600,50,3],[600,51,2],[600,100,2],[600,101,1]]){
    await p.evaluate(async({goal,moves})=>{
      const {h,render}=await import('/node_modules/.vite/deps/preact.js');const {PrototypeApp}=await import('/src/prototype/App.js');
      let root=document.getElementById('stars-fixture');if(!root){root=document.createElement('div');root.id='stars-fixture';root.style='position:fixed;inset:0;z-index:100;background:#3021ba;overflow:auto';document.body.append(root);}
      const state={...window.gameDebug.snapshot().state,goal,movesUsed:moves,turn:moves,terminal:null};
      render(h(PrototypeApp,{state,levelIndex:1,totalLevels:12,phase:'playing',notice:'Fixture',reduced:true,selected:state.magnets[0]}),root);
    },{goal,moves});
    const stars=p.locator('#stars-fixture .potential-stars');assert.equal(await stars.getAttribute('aria-label'),`Potential stars: ${expected} of 3`);assert.equal(await stars.locator('.lit').count(),expected);
    assert.equal(await stars.locator('img').first().evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
    if(goal===50)await p.screenshot({path:`artifacts/moves-stars/fixture-${moves}.png`});
  }
  assert.deepEqual(errors,[]);await p.close();
  const failed=await b.newPage();await failed.route('**/moves-star.png',r=>r.abort());await failed.goto(base);
  await failed.getByRole('dialog',{name:'Launch error',exact:true}).waitFor();await failed.unroute('**/moves-star.png');await failed.getByRole('button',{name:'Retry',exact:true}).click();await readyTools(failed);await failed.close();
  console.log('HUD stars: real 3→2→1 moves, cancel/invalid/pause/retry, inclusive fixtures, four viewport layouts and asset failure/retry passed.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
