// Deterministic asset slicing requested by the user; no generative repainting here.
// Run: SHARP_MODULE=/absolute/path/to/sharp node tools/slice-mockup-assets.cjs
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs'), path = require('node:path');
const root=path.resolve(__dirname,'..'), out=path.join(root,'public/art/mockup');
const reference=path.join(root,'docs/design/mockups/2026-10-09-facebook-casual');
const generatedDirectory=process.env.GENERATED_ART_DIR || path.join(process.env.USERPROFILE || root,'.codex/generated_images/01a11f69-38bb-7cf0-8094-9030841da2ab');
const generated=Object.fromEntries(Object.entries({background:'exec-59f401f4-efcf-43c6-a3f2-1420e56009cb.png',logo:'exec-76ce51d8-62bb-4d13-ae0b-af9bb9078e20.png',tile:'exec-a723bc37-1013-4e55-9f4c-c9fc144c45b3.png'}).map(([name,file])=>[name,path.join(generatedDirectory,file)]));
const manifest={version:1,reference:'English mockups revision 2',method:'Exact rectangular crops and nine-slice assembly; generated extraction only where occluded',assets:[]};
fs.mkdirSync(out,{recursive:true});
async function save(name,pipe,meta={}){
 const buffer=await pipe.png().toBuffer();fs.writeFileSync(path.join(out,name+'.png'),buffer);
 const m=await sharp(buffer).metadata();manifest.assets.push({name,file:name+'.png',width:m.width,height:m.height,...meta});
 return buffer;
}
async function crop(file,rect){return sharp(path.join(reference,file+'.png')).extract(rect).png().toBuffer()}
async function masked(name,file,rect,svg){
 const buffer=await crop(file,rect);
 return save(name,sharp(buffer).ensureAlpha().composite([{input:Buffer.from('<svg width="'+rect.width+'" height="'+rect.height+'" xmlns="http://www.w3.org/2000/svg">'+svg+'</svg>'),blend:'dest-in'}]),{source:file+'.png',rect});
}
// Remove only connected exterior ivory; preserve enclosed metal highlights.
async function ivoryCutout(name,file,rect){
 const buffer=await crop(file,rect), {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,seen=new Uint8Array(w*h),queue=[];
 function add(x,y){if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x,p=i*4;
  if(seen[i])return;seen[i]=1;
  if(data[p]>155&&data[p]>=data[p+1]*.98&&data[p+1]>=data[p+2]*.96){data[p+3]=0;queue.push(i);}}
 for(let x=0;x<w;x++){add(x,0);add(x,h-1)}for(let y=0;y<h;y++){add(0,y);add(w-1,y)}
 for(let k=0;k<queue.length;k++){const i=queue[k],x=i%w,y=Math.floor(i/w);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1)}
 await save(name,sharp(data,{raw:info}),{source:file+'.png',rect,mask:'connected exterior ivory'});
}
async function blankFrame(name,file,rect,slice,column){
 const b=await crop(file,rect),w=rect.width,h=rect.height;
 const left=await (name==='loading-track'?sharp(b).extract({left:w-slice,top:0,width:slice,height:h}).flop():sharp(b).extract({left:0,top:0,width:slice,height:h})).toBuffer();
 const right=await sharp(b).extract({left:w-slice,top:0,width:slice,height:h}).toBuffer();
 const leftPixels=await sharp(b).ensureAlpha().extract({left:column,top:0,width:1,height:h}).raw().toBuffer();
 const rightPixels=await sharp(b).ensureAlpha().extract({left:w-slice,top:0,width:1,height:h}).raw().toBuffer();
 const inner=w-2*slice,pixels=Buffer.alloc(inner*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<inner;x++)for(let c=0;c<4;c++)pixels[(y*inner+x)*4+c]=Math.round(leftPixels[y*4+c]+(rightPixels[y*4+c]-leftPixels[y*4+c])*x/(inner-1));
 let middle=await sharp(pixels,{raw:{width:inner,height:h,channels:4}}).png().toBuffer();
 if(name.startsWith('tool-')) {
  const fill=await sharp(b).extract({left:column,top:30,width:1,height:1}).resize(w-2*slice,h-70,{fit:'fill',kernel:'nearest'}).toBuffer();
  middle=await sharp(middle).composite([{input:fill,left:0,top:35}]).toBuffer();
 }
 const assembled=await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:left,left:0,top:0},{input:middle,left:slice,top:0},{input:right,left:w-slice,top:0}]).png().toBuffer();
 const mask=Buffer.from('<svg width="'+w+'" height="'+h+'"><rect width="'+w+'" height="'+h+'" rx="'+(name.startsWith('tool-')?45:Math.floor(h/2)-3)+'" fill="white"/></svg>');
 return save(name,sharp(assembled).composite([{input:mask,blend:'dest-in'}]),{source:file+'.png',rect,slice:[name.startsWith('tool-')?45:Math.floor(h/2)-3,slice,name.startsWith('tool-')?45:Math.floor(h/2)-3,slice],blankColumn:column});
}
(async()=>{
 for(const id of ['background','logo','tile']){
  const size=id==='background'?941:id==='logo'?640:id==='tile'?256:256;
  const original=fs.existsSync(generated[id]);
  let pipe=sharp(original?generated[id]:path.join(out,id+'.png'));if(original&&id!=='background')pipe=pipe.trim({threshold:12});
  await save(id,pipe.resize({width:size,withoutEnlargement:true}),{source:'imagegen extraction',generatedOriginal:path.basename(generated[id])});
 }
 const magnetMask='<path fill="white" d="M28 3L62 6Q79 8 75 23L62 67C48 113 78 135 106 135C139 135 157 111 143 68L134 25Q130 8 146 6L177 1Q189 0 192 14L204 73C221 131 171 183 107 183C41 185-10 132 6 75L21 16Q22 4 28 3Z"/>';
 for(const [name,left] of [['violet',95],['blue',373],['coral',639]])await masked('magnet-'+name,'03-playing',{left,top:1260,width:208,height:187},magnetMask);
 await save('loading-art',sharp(await crop('01-loading',{left:0,top:0,width:941,height:1220})),{source:'01-loading.png',rect:{left:0,top:0,width:941,height:1220}});
 await blankFrame('loading-track','01-loading',{left:111,top:1398,width:720,height:95},45,685);
 await masked('loading-fill','01-loading',{left:125,top:1410,width:508,height:73},'<rect width="508" height="73" rx="35" fill="white"/>');
 await masked('tutorial-arrow','02-tutorial',{left:252,top:748,width:173,height:394},'<path fill="white" d="M49 3Q57 0 61 10L79 39Q87 52 76 60L64 58C59 127 78 221 168 385L170 393H145C50 231 20 130 28 60L16 66Q3 67 7 52Z"/>');
 await masked('tutorial-hand','02-tutorial',{left:507,top:1468,width:172,height:175},'<path fill="white" d="M14 8Q22 4 31 14L58 44Q62 35 76 40Q82 30 94 37Q109 30 117 40Q136 42 143 61L156 99 161 120Q177 125 170 143Q148 171 116 174L89 154 55 142Q17 139 22 115Q24 98 45 109L7 49Q-6 25 14 8Z"/>');
 // The logo used by the live UI is the exact approved crop, with a hand-traced outer alpha mask.
 await masked('logo-exact','03-playing',{left:48,top:20,width:371,height:228},
  '<path fill="white" d="M9 88 Q5 75 30 75 L67 79 100 73 112 25Q130-1 166 9L184 17Q219-4 245 12L257 31 266 73 294 78 310 75 360 83Q373 88 370 111L358 139 339 152 304 154 282 176 275 206 249 222 155 225 118 217 110 195 85 182 46 175 16 165Z"/>');
 await blankFrame('panel','03-playing',{left:442,top:107,width:321,height:89},45,49);
 await blankFrame('button-purple','03-playing',{left:491,top:1515,width:390,height:112},45,50);
 await blankFrame('button-green','09-paused',{left:182,top:869,width:577,height:145},85,90);
 await blankFrame('button-light','09-paused',{left:236,top:1035,width:469,height:104},65,61);
 // Modal corners and edges are cut outside its text/magnet; flat ivory fill sampled from clear interior.
 const modal=await crop('11-defeat',{left:118,top:539,width:708,height:775});
 const w=708,h=775,edge=90,parts=[];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const sx=col===0?0:col===1?edge:w-edge,sy=row===0?0:row===1?200:h-edge;
  const sw=col===1?1:edge,sh=row===1&&col===1?h-2*edge:row===1?1:edge;
  let part=sharp(modal).extract({left:col===1&&row===1?31:col===2&&row===0?0:sx,top:col===1&&row===1?edge:sy,width:sw,height:sh});
  if(col===2&&row===0)part=part.flop();
  parts.push({input:await part.resize(col===1?w-edge*2:edge,row===1?h-edge*2:edge,{fit:'fill',kernel:'nearest'}).toBuffer(),left:col===0?0:col===1?edge:w-edge,top:row===0?0:row===1?edge:h-edge});
 }
 const modalFrame=await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(parts).png().toBuffer();
 await save('modal',sharp(modalFrame).composite([{input:Buffer.from('<svg width="708" height="775"><rect width="708" height="775" rx="90" fill="white"/></svg>'),blend:'dest-in'}]),{source:'11-defeat.png',slice:[90,90,90,90]});
 await masked('switch-off','09-paused',{left:596,top:1171,width:144,height:69},'<rect width="144" height="69" rx="34" fill="white"/>');
 await masked('switch-thumb','09-paused',{left:600,top:1175,width:65,height:65},'<circle cx="32" cy="32" r="31" fill="white"/>');
 await masked('pause','03-playing',{left:795,top:99,width:108,height:108},'<circle cx="54" cy="54" r="51" fill="white"/>');
 await masked('close','09-paused',{left:705,top:487,width:121,height:120},'<circle cx="60" cy="60" r="57" fill="white"/>');
 // Original icon crops: masks follow their white silhouettes, keeping original shading.
 await masked('hint','03-playing',{left:137,top:1535,width:56,height:69},'<path fill="white" d="M26 0C-3 0-2 28 7 41L13 51 15 62 24 69 33 67 39 61 40 51 48 37C63 9 43-1 26 0Z"/>');
 await masked('restart','03-playing',{left:578,top:1534,width:68,height:72},'<path fill="white" d="M10 14Q29-2 49 10L51 0 68 27 39 27 47 19Q27 8 18 24Q3 53 33 58Q46 59 55 47L67 56Q49 81 22 68Q-8 55 3 27Z"/>');
 // Exact visible top ring layer; polygon includes the original bevel and side-wall only.
 const ringMask='<path fill="white" d="M28 2Q30 0 34 0H83Q88 0 91 4L111 27Q116 33 113 41L91 68Q86 74 80 74H30Q24 74 20 68L2 43Q-2 35 3 28Z"/>';
 await masked('ring-violet','03-playing',{left:239,top:436,width:116,height:75},ringMask);
 await masked('ring-blue','03-playing',{left:588,top:436,width:116,height:75},ringMask);
 await masked('ring-coral','03-playing',{left:167,top:774,width:116,height:75},ringMask);
 await masked('blocker','03-playing',{left:398,top:432,width:140,height:141},'<path fill="white" d="M66 0Q70-2 76 3L132 32Q138 36 138 43V100Q139 105 132 109L76 139Q70 143 63 139L8 110Q2 106 2 98V43Q1 36 9 32Z"/>');
 await blankFrame('tool-neutral-frame','03-playing',{left:346,top:1228,width:254,height:240},28,30);
 await blankFrame('tool-selected-frame','03-playing',{left:58,top:1228,width:274,height:240},28,30);
 // Exact control tiles are retained as art plates; use their source corners for scalable variants.
 for(const[name,x]of [['tool-violet',58],['tool-blue',346],['tool-coral',610]]){
 await save(name,sharp(await crop('03-playing',{left:x,top:1228,width:274,height:240})),{source:'03-playing.png',rect:{left:x,top:1228,width:274,height:240}});
 }
 await save('progress-empty',sharp(await crop('03-playing',{left:107,top:317,width:500,height:32})),{source:'03-playing.png',slice:[15,18,15,18]});
 await save('progress-full',sharp(await crop('10-victory',{left:107,top:317,width:500,height:32})),{source:'10-victory.png',slice:[15,18,15,18]});
 await ivoryCutout('paused-title','09-paused',{left:280,top:567,width:385,height:95});
 await ivoryCutout('defeat-title','11-defeat',{left:285,top:572,width:375,height:182});
 await ivoryCutout('defeat-magnet','11-defeat',{left:240,top:754,width:462,height:211});
 await masked('victory-ribbon','10-victory',{left:94,top:645,width:769,height:215},'<path fill="white" d="M64 35Q70 4 385 4Q690 4 699 34L695 70Q735 70 754 84L732 116 744 194Q741 213 716 199L652 180Q644 168 647 155Q390 121 95 161Q100 178 88 187L15 203Q-3 209 5 192L27 130 2 90Q-3 82 12 79L64 64Z"/>');
 await masked('victory-star','10-victory',{left:431,top:395,width:90,height:102},'<path fill="white" d="M43 0Q48 0 51 11L61 34 84 44Q94 48 83 56L60 66 50 94Q46 105 40 94L30 66 6 56Q-5 49 7 44L30 33 38 10Z"/>');
 await masked('confetti-violet','10-victory',{left:78,top:417,width:55,height:52},'<path fill="white" d="M22 0L54 27 30 51 1 23Z"/>');
 await masked('confetti-yellow','10-victory',{left:265,top:395,width:40,height:53},'<path fill="white" d="M4 11L24 0 39 38 19 52 10 36Z"/>');
 await masked('confetti-blue','10-victory',{left:847,top:411,width:42,height:61},'<path fill="white" d="M22 0L41 15 24 58 1 49 9 22Z"/>');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log('Saved '+manifest.assets.length+' sliced assets to '+out);
})().catch(e=>{console.error(e);process.exitCode=1});

