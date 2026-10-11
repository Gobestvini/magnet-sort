// Slice generated atlas; retain the largest alpha island and painted pixels.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),src=path.join(root,'docs/design/resource-quality'),out=path.join(root,'public/art/mockup');
async function clean(input){
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,seen=new Uint8Array(w*h);let largest=[];
 for(let start=0;start<w*h;start++)if(!seen[start]&&data[start*4+3]>32){
  const island=[start];seen[start]=1;
  for(let j=0;j<island.length;j++){const p=island[j],x=p%w,y=Math.floor(p/w);for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!seen[n]&&data[n*4+3]>32){seen[n]=1;island.push(n);}}
  if(island.length>largest.length)largest=island;
 }
 const keep=new Uint8Array(w*h);for(const p of largest){keep[p]=1;const x=p%w,y=Math.floor(p/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)keep[(y+dy)*w+x+dx]=1;}
 for(let p=0;p<w*h;p++)if(!keep[p])data[p*4+3]=0;
 return sharp(data,{raw:{width:w,height:h,channels:4}}).trim({background:'#00000000',threshold:1}).png().toBuffer();
}
(async()=>{
 const atlas=path.join(src,'magnets-source.png'),m=await sharp(atlas).metadata();
 for(const [i,color]of ['violet','blue','coral'].entries()){
  const left=Math.round(i*m.width/3),right=Math.round((i+1)*m.width/3);
  const part=await sharp(atlas).extract({left,top:0,width:right-left,height:m.height}).png().toBuffer();
  await sharp(await clean(part)).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,'magnet-'+color+'.png'));
 }
 const logo=path.join(src,'logo-source.png');if(fs.existsSync(logo))await sharp(await clean(logo)).resize({width:1024,height:768,fit:'inside'}).png().toFile(path.join(out,'logo-exact.png'));
 console.log('Imported cleaned high-resolution generated artwork.');
})().catch(e=>{console.error(e);process.exitCode=1});
