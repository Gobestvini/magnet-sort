const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const output='artifacts/light-base-fix';fs.mkdirSync(output,{recursive:true});
 const b=await chromium.launch();const results=[];
 try{for(const [name,viewport] of [['desktop',{width:1000,height:900}],['mobile',{width:390,height:844}]]){
  const p=await b.newPage({viewport,deviceScaleFactor:1}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const base=(process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'docs/design/magnet-range-light/index.html?t=1.3';
  const capture=async off=>{
   await p.goto(base+(off?'&light=off':''));await p.waitForFunction(()=>window.lightPreview);
   await p.locator('#light').scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const points=await p.evaluate(()=>[[235,482],[98,414],[373,414],[20,320],[450,320]].map(([x,y])=>window.lightPreview.tilePixelPosition(0,x,y)));
   const bytes=await p.locator('canvas').screenshot({path:output+'/'+name+(off?'-off.png':'-lit.png')});
   return p.evaluate(async({data,points})=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return points.map(({x,y})=>Array.from(ctx.getImageData(Math.round(x),Math.round(y),1,1).data));},{data:bytes.toString('base64'),points});
  };
  const off=await capture(true),lit=await capture(false);results.push({name,off,lit});
  for(let i=0;i<off.length;i++){
   assert(off[i][0]-off[i][2]>25,'test point must lie on visible warm tile');
   assert((lit[i][2]-lit[i][0])-(off[i][2]-off[i][0])>80,name+' lower tile point '+i+' must receive clearly visible colored light: '+off[i]+' -> '+lit[i]);
   assert(lit[i][2]-lit[i][0]>45,name+' lower tile point '+i+' must be visibly cyan');
  }
  assert.deepEqual(errors,[]);await p.close();
 }}finally{await b.close();fs.writeFileSync(output+'/pixels.json',JSON.stringify(results,null,2));}
 console.log('All five visible tile-base points are lit: front center, both front corners and both outer shoulders (desktop/mobile).');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
