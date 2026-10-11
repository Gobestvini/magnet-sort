const fs=require('node:fs'),sharp=require('sharp');
(async()=>{
 const filename='public/art/mockup/manifest.json',manifest=JSON.parse(fs.readFileSync(filename));
 const native=JSON.parse(fs.readFileSync('docs/design/resource-quality/vector/inventory.json'));
 const replacements=new Map(native.map(a=>[a.name,a]));
 replacements.set('background',{source:'docs/design/resource-quality/background-source.png'});
 for(const c of ['violet','blue','coral'])replacements.set('magnet-'+c,{source:'docs/design/resource-quality/magnets-source.png'});
 replacements.set('logo-exact',{source:'docs/design/resource-quality/logo-source.png'});
 for(const a of manifest.assets){
  const info=await sharp('public/art/mockup/'+a.file).metadata();a.width=info.width;a.height=info.height;
  const replacement=replacements.get(a.name);
  if(replacement){
   if(!a.qualityRevision){a.previousSource=a.source;if(a.slice)a.slice=a.slice.map(v=>v*3);}
   a.source=replacement.source;a.qualityRevision='2026-10-11';delete a.rect;delete a.generatedOriginal;delete a.blankColumn;
  }
 }
 manifest.version=2;manifest.method='High-resolution generated illustrations; native SVG UI rasterized at 3x; audited original board sprites retained';
 fs.writeFileSync(filename,JSON.stringify(manifest,null,2)+'\n');
 const audit=[];
 for(const file of fs.readdirSync('public/art/mockup').filter(f=>f.endsWith('.png'))){
  const info=await sharp('public/art/mockup/'+file).metadata(),name=file.slice(0,-4);
  audit.push({name,width:info.width,height:info.height,bytes:fs.statSync('public/art/mockup/'+file).size,
   status:replacements.has(name)?'replaced':['tile','chip-violet','chip-blue','chip-coral','tutorial-hand'].includes(name)?'retained: sufficient native resolution':name==='background-grid-mask'?'aligned idle-shine mask':name==='blocker-x'?'parallel blocker task':'historical: not used by active UI'});
 }
 fs.writeFileSync('docs/design/resource-quality/audit.json',JSON.stringify(audit,null,2)+'\n');
 console.log(JSON.stringify({reviewed:audit.length,replaced:replacements.size,totalBytes:audit.reduce((n,a)=>n+a.bytes,0)}));
})().catch(e=>{console.error(e);process.exitCode=1});
