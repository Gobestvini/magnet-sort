const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const output='artifacts/source-light';fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch();const results=[];
 try{for(const [name,viewport]of [['desktop',{width:1000,height:900}],['mobile',{width:390,height:844}]]){
  const p=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const capture=async(t,off)=>{
   await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'docs/design/magnet-range-light/index.html?t='+t+(off?'&light=off':''));
   await p.waitForFunction(()=>window.lightPreview);await p.locator('#light').scrollIntoViewIfNeeded();
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const points=await p.evaluate(()=>[-1.6,0].map(x=>window.lightPreview.tilePixelPosition(x,235,482)));
   const bytes=await p.locator('canvas').screenshot({path:output+'/'+name+'-'+t+(off?'-off':'')+'.png'});
   return p.evaluate(async({data,points})=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return points.map(({x,y})=>Array.from(ctx.getImageData(Math.round(x),Math.round(y),1,1).data));},{data:bytes.toString('base64'),points});
  };
  const off=await capture(2.76,true),mixed=await capture(2.475,false),earlyOff=await capture(2.76,false);
  const tint=(pixels,i)=>(pixels[i][2]-pixels[i][0])-(off[i][2]-off[i][0]);
  assert(tint(mixed,0)>25&&tint(mixed,0)<tint(mixed,1)-25,'first source must be partly faded while second is fully lit');
  for(let channel=0;channel<3;channel++)assert(Math.abs(earlyOff[0][channel]-off[0][channel])<=1,'completed source must match unlit pixels');
  assert(tint(earlyOff,1)>100,'later source must remain lit after first has gone dark');
  // The same centering is visible in the mockup; mini-map retains its anchor.
  const centers=await p.locator('.current-tool').evaluateAll(ns=>ns.map(n=>{const a=n.getBoundingClientRect(),b=n.querySelector('.tool-art').getBoundingClientRect();return [b.x+b.width/2-a.x-a.width/2,b.y+b.height/2-a.y-a.height/2];}));
  assert(centers.every(c=>c.every(v=>Math.abs(v)<1)));assert.deepEqual(errors,[]);
  results.push({name,off,mixed,earlyOff,centers});await p.close();
 }}finally{await browser.close();fs.writeFileSync(output+'/pixels.json',JSON.stringify(results,null,2));}
 console.log('Independent per-source shader opacity verified by actual pixels: one fades/goes dark while the other stays lit; mockup magnets centered (desktop/mobile).');
})().catch(e=>{console.error(e);process.exitCode=1;});
