// Derive an aligned edge mask from the restored, project-owned raster background.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),source=path.join(root,'docs/design/resource-quality/background-source.png');
async function buildBackground(){
 const {data,info}=await sharp(source).greyscale().blur(1.2).raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,mask=Buffer.alloc(w*h*4);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;
  const gx=-data[i-w-1]+data[i-w+1]-2*data[i-1]+2*data[i+1]-data[i+w-1]+data[i+w+1];
  const gy=-data[i-w-1]-2*data[i-w]-data[i-w+1]+data[i+w-1]+2*data[i+w]+data[i+w+1];
  const strength=Math.hypot(gx,gy)/4;
  const alpha=Math.round(Math.min(1,Math.max(0,(strength-1.6)/7))*255);
  mask[i*4]=mask[i*4+1]=mask[i*4+2]=255;mask[i*4+3]=alpha;
 }
 const output=path.join(root,'public/art/mockup');
 fs.copyFileSync(source,path.join(output,'background.png'));
 await sharp(mask,{raw:{width:w,height:h,channels:4}}).png().toFile(path.join(output,'background-grid-mask.png'));
 console.log(`Restored embossed background and aligned ${w}x${h} grid mask.`);
}
module.exports={buildBackground};
if(require.main===module)buildBackground().catch(e=>{console.error(e);process.exitCode=1});
