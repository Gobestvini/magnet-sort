// Derive the idle contour mask from the FINAL generated bitmap, never a second grid.
const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/gobes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source='C:/Users/gobes/.codex/generated_images/01a1308f-fa45-7383-9239-19047ba4edca';
(async()=>{
 const art='public/art/mockup',design='docs/design/victory-v2';fs.mkdirSync(design,{recursive:true});
 fs.copyFileSync(path.join(source,'exec-6ee60319-a3c0-4e43-9472-66482e590ade.png'),path.join(art,'background-v2.png'));
 fs.copyFileSync(path.join(source,'exec-39f62db0-ca7c-4075-8cef-98e0fa8776a0.png'),path.join(design,'reference.png'));
 const panel=path.join(source,'exec-8e402849-d4b3-4a97-b6ea-3f0515b5e2a1.png');
 // Crop only transparent margins; preserve generated RGBA panel.
 await sharp(panel).trim().resize({width:720}).png().toFile(path.join(design,'panel.png'));
 fs.copyFileSync(path.join(design,'panel.png'),path.join(art,'victory-panel-v2.png'));
 await sharp(path.join(source,'exec-09782f57-0287-4ced-b574-0518e0b1cd7c.png')).trim().resize({width:256}).png().toFile(path.join(design,'star.png'));
 fs.copyFileSync(path.join(design,'star.png'),path.join(art,'victory-star-v2.png'));
 fs.copyFileSync('artifacts/pages-browser/mobile-victory.png',path.join(design,'before.png'));
 const {data,info}=await sharp(path.join(art,'background-v2.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const blurred=await sharp(data,{raw:info}).blur(7).raw().toBuffer();
 const mask=Buffer.alloc(info.width*info.height*4);
 for(let i=0;i<info.width*info.height;i++){
  const k=i*info.channels,delta=(blurred[k]+blurred[k+1]+blurred[k+2]-data[k]-data[k+1]-data[k+2])/3;
  mask[i*4]=mask[i*4+1]=mask[i*4+2]=255;mask[i*4+3]=Math.min(255,Math.max(0,(delta-2)*28));
 }
 await sharp(mask,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(path.join(art,'background-grid-mask-v2.png'));
 fs.writeFileSync(path.join(design,'manifest.json'),JSON.stringify({source:'OpenAI built-in imagegen, 2026-10-12',reference:'reference.png',panel:'panel.png',star:'star.png',panelSize:await sharp(path.join(design,'panel.png')).metadata(),dynamic:'HTML heading, moves, collected/goal, stars and buttons; sample values are illustrative',layout:{width:390,maxHeight:'viewport - 32px',padding:32,gap:18,overlay:'rgba(25,5,86,.65)',primary:'Next level',secondary:'Play again',last:'Play from start'}},null,2));
 fs.writeFileSync(path.join(art,'background-v2-manifest.json'),JSON.stringify({source:'OpenAI built-in imagegen with background.png style reference',date:'2026-10-12',image:'background-v2.png',mask:'background-grid-mask-v2.png',geometry:'mask alpha extracted from local dark groove residual against blur(7) of same final bitmap',width:info.width,height:info.height,crop:'center / cover shared by background and mask',idle:'original 11-second sweep profile'},null,2));
 console.log('Prepared background, same-source mask, RGBA panel and reference');
})().catch(e=>{console.error(e);process.exitCode=1;});
