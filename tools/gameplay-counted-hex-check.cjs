const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5174')+'/docs/design/prototypes/gameplay-counted-hex/index.html');
 await page.waitForFunction(()=>window.countedHex);await page.evaluate(()=>document.fonts.ready);
 const cases=[];
 for(const reduced of [false,true])for(const id of ['design','single','mixed','chain','clear','tall','twelve']){
  await page.evaluate(({id,reduced})=>countedHex.select(id,reduced),{id,reduced});
  const result=await page.evaluate(()=>{
   const first=countedHex.snapshot(),timeline=first.data.timeline;
   const ids=timeline.before.stacks.flatMap(s=>s.units.map(u=>u.id)).sort();
   let maxLandingError=0,maxGeometries=0;
   const times=[0,timeline.duration,...timeline.segments.flatMap(s=>[s.start,s.start+.00001,(s.start+s.end)/2,s.end])];
   for(const time of times){
    countedHex.seek(time);const snap=countedHex.snapshot(),phases=Object.values(snap.sample.phases).flat().sort();
    if(JSON.stringify(ids)!==JSON.stringify(phases)||new Set(phases).size!==ids.length)throw Error('ID conservation');
    if(snap.board.meshes!==snap.sample.units.length)throw Error('mesh/list mismatch');
    maxGeometries=Math.max(maxGeometries,snap.board.geometries);
    for(const stack of snap.sample.stacks){const expected=(()=>{const c=stack.units.at(-1).color;let n=0;for(let i=stack.units.length-1;i>=0&&stack.units[i].color===c;i--)n++;return n;})();
     if(snap.counts.find(c=>c.cell===`r${stack.cell.row}c${stack.cell.col}`)?.value!==expected)throw Error('badge mismatch');
    }
    for(const pose of snap.sample.units.filter(p=>!p.from)){
     const mesh=snap.board.units.find(u=>u.id===pose.id),x=Math.sqrt(3)*(pose.cell.col+(pose.cell.row%2)*.5-3.5),z=1.5*(pose.cell.row-3);
     maxLandingError=Math.max(maxLandingError,Math.hypot(mesh.x-x,mesh.z-z));
    }
   }
   countedHex.seek(0);
   // Read the rendered cap, not just object IDs: catches invisible chips/render queues.
   const snap=countedHex.snapshot(),canvas=document.querySelector('#board'),probe=document.createElement('canvas');
   probe.width=canvas.width;probe.height=canvas.height;const ctx=probe.getContext('2d');ctx.drawImage(canvas,0,0);
   const palette={violet:[171,96,231],blue:[65,159,233],coral:[240,117,100]};
   for(const stack of snap.sample.stacks){
    const label=document.querySelector(`.count[data-cell="r${stack.cell.row}c${stack.cell.col}"]`);
    const x=(parseFloat(label.style.left)-30)*canvas.width/881,y=(parseFloat(label.style.top)-400)*canvas.height/720;
    const pixel=ctx.getImageData(Math.round(x),Math.round(y),1,1).data,expected=palette[stack.units.at(-1).color];
    if(expected.some((value,i)=>Math.abs(value-pixel[i])>12)||pixel[3]<250)throw Error('rendered cap missing/wrong color '+stack.units.at(-1).color+' '+[...pixel]);
   }
   return {units:ids.length,hops:timeline.segments.filter(s=>s.type==='unitMoved').length,maxLandingError,maxGeometries};
  });
  cases.push({id,reduced,...result});
  if(!reduced)await page.screenshot({path:`artifacts/gameplay-counted-hex/${id}.png`,fullPage:true});
 }
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:width===320?640:width===390?844:932});
  await page.waitForFunction(()=>document.querySelector('#viewport').getBoundingClientRect().width<=innerWidth);
  await page.evaluate(()=>countedHex.select('tall'));
  const ok=await page.evaluate(()=>{const bounds=document.querySelector('#viewport').getBoundingClientRect();return [...document.querySelectorAll('.count')].every(e=>{const r=e.getBoundingClientRect();return r.left>=bounds.left&&r.right<=bounds.right&&r.top>=bounds.top&&r.bottom<=bounds.bottom;})&&document.documentElement.scrollWidth<=innerWidth;});
  if(!ok)throw Error('viewport overflow '+width);
 }
 await page.evaluate(()=>countedHex.select('mixed'));
 await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(90);await page.getByRole('button',{name:'Pause',exact:true}).click();
 const paused=await page.evaluate(()=>countedHex.snapshot().time);await page.waitForTimeout(100);
 if(await page.evaluate(()=>countedHex.snapshot().time)!==paused)throw Error('pause advanced');
 await page.getByRole('button',{name:'Replay',exact:true}).click();await page.waitForTimeout(40);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const before=await page.evaluate(()=>{countedHex.select('design');return countedHex.snapshot().board.geometries;});
 for(let i=0;i<12;i++)await page.evaluate(()=>{countedHex.select('tall');countedHex.select('design');});
 if(await page.evaluate(()=>countedHex.snapshot().board.geometries)!==before)throw Error('geometry growth');
 await page.evaluate(()=>countedHex.dispose());if(!await page.evaluate(()=>countedHex.snapshot().disposed))throw Error('dispose');
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('artifacts/gameplay-counted-hex/browser-report.json',JSON.stringify({ok:true,cases,viewports:[320,390,430],errors},null,2));
 const videoContext=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:'artifacts/gameplay-counted-hex/video',size:{width:390,height:844}}});
 const clip=await videoContext.newPage();await clip.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5174')+'/docs/design/prototypes/gameplay-counted-hex/index.html');
 await clip.waitForFunction(()=>window.countedHex);await clip.evaluate(()=>countedHex.select('chain'));
 await clip.getByRole('button',{name:'Play',exact:true}).click();await clip.waitForFunction(()=>!countedHex.snapshot().playing);
 const video=clip.video();await videoContext.close();fs.copyFileSync(await video.path(),'docs/design/prototypes/gameplay-counted-hex/chain-motion.webm');
 await browser.close();console.log('PASS: 14 fixture/motion combinations, ID phases, counters, exact landing, 3 viewports, pause/replay/dispose/resource reuse; chain video saved.');
})().catch(e=>{console.error(e);process.exit(1)});
