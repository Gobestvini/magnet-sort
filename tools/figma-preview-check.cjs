// Offline preview QA only. This does not validate the native Figma import.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.GAME_BASE_URL || 'http://127.0.0.1:5173';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await page.goto(base+'/artifacts/figma-casual/index.html');
  await page.evaluate(()=>document.fonts.ready);
  const evidence=await page.evaluate(async()=>{
   const images=[...document.querySelectorAll('main svg image')];
   await Promise.all(images.map(async node=>{const image=new Image();image.src=node.getAttribute('href');await image.decode()}));
   const missing=[],clipped=[];
   for(const svg of document.querySelectorAll('main>figure>svg')){
    for(const node of svg.querySelectorAll('[fill^="url("]')){
     const id=node.getAttribute('fill').slice(5,-1);
     if(!svg.querySelector('[id="'+id+'"]'))missing.push(id);
    }
    for(const node of svg.querySelectorAll('text')){
     const box=node.getBoundingClientRect(),screen=svg.getBoundingClientRect();
     if(box.left<screen.left-1||box.right>screen.right+1||box.top<screen.top-1||box.bottom>screen.bottom+1)clipped.push(node.textContent);
    }
   }
   return {screens:document.querySelectorAll('main>figure').length,images:images.length,missing,clipped,fontLoaded:document.fonts.check('900 42px Nunito')};
  });
  assert.equal(evidence.screens,12);assert.equal(evidence.fontLoaded,true);
  assert.deepEqual(evidence.missing,[]);assert.deepEqual(evidence.clipped,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/figma-casual/gallery.png',fullPage:true});
  for(const id of ['03-playing','09-paused','10-victory','11-defeat'])await page.locator('[id="'+id+'"]').screenshot({path:`artifacts/figma-casual/${id}-preview.png`});
  fs.writeFileSync('artifacts/figma-casual/preview-check.json',JSON.stringify({...evidence,errors},null,2));
  console.log(JSON.stringify({...evidence,errors}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
