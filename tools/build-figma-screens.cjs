// Offline editable Figma source. No running-game capture or flattened UI images.
// Rebuild: node tools/build-figma-screens.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/figma-casual');
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const fileKey='Nntj95XfGJSGVy0FwadZMN';
const W=160,H=2*W/Math.sqrt(3)*.78,THICKNESS=16;
const palette={ink:'#27094f',cream:'#fff2df',gold:'#ffbd27',violet:'#a81bff',blue:'#00a9ff',coral:'#ff5629',white:'#ffffff',valid:'#51ef94',invalid:'#ff5a68',hint:'#ffe56d'};
const colors={violet:['#e07aff','#a921ff','#7200c6','#440074'],blue:['#84e9ff','#02aeff','#0076d4','#003e83'],coral:['#ffbb85','#ff6034','#df3011','#8f1e0e']};
const components={},assets={},screens=[];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const n=v=>Number(v.toFixed(6));
const pts=(w,h,inset=0)=>[[w/2,inset],[w-inset,h/4+inset/2],[w-inset,h*3/4-inset/2],[w/2,h-inset],[inset,h*3/4-inset/2],[inset,h/4+inset/2]];
const poly=points=>points.map(p=>p.map(n).join(',')).join(' ');
const d=points=>'M'+points.map(p=>p.map(n).join(' ')).join('L')+'Z';
function component(id,w,h,body,description){components[id]={name:id,width:w,height:h,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`,description};return id}
function gradient(id,stops){return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`}
function panel(id,w,h,skin='cream'){
 const stops=skin==='purple'?[[0,'#b78cff'],[.4,'#8a43eb'],[.53,'#7830d3'],[1,'#481385']]:skin==='green'?[[0,'#79f138'],[.4,'#26ce13'],[.53,'#13bf0c'],[1,'#138b06']]:[[0,'#fffaf0'],[.5,'#fff0db'],[1,'#f8e4ca']];
 const r=({'Panel':45,'Moves panel':45,'Magnet tray':55,'Instruction panel':45,'Modal':90})[id]??Math.min(h*.46,80),gid=id.replaceAll(' ','-')+'-surface';
 return component(id,w,h,`<defs>${gradient(gid,stops)}</defs><rect x="4" y="9" width="${w-8}" height="${h-12}" rx="${r}" fill="#5b2b5b" opacity=".2"/><rect x="3" y="3" width="${w-6}" height="${h-10}" rx="${r}" fill="#ba782d"/><rect x="3" y="1" width="${w-6}" height="${h-10}" rx="${r}" fill="#ffcc42" stroke="#fff6c7" stroke-width="3"/><rect x="10" y="9" width="${w-20}" height="${h-23}" rx="${r-7}" fill="url(#${gid})" stroke="#fffdf2" stroke-width="3"/><path d="M${r+10} 15 H${w-r-10}" fill="none" stroke="white" stroke-width="4" opacity=".7"/>`,'Editable layered rim, highlight and surface; export corners for nine-slice.');
}
panel('Panel',580,125);panel('Level badge',321,89);panel('Moves panel',236,125);panel('Magnet tray',880,286);panel('Instruction panel',760,160);panel('Modal',708,775);
panel('Button purple',390,112,'purple');panel('Button green',577,145,'green');panel('Button light',469,104);
for(const [id,selected] of [['Tool neutral',false],['Tool selected',true]]){
 const gid=id.replaceAll(' ','-');component(id,254,240,`<defs>${gradient(gid,[[0,selected?'#eadbff':'#fff9ed'],[1,selected?'#d4a6ff':'#ead0af']])}</defs><rect x="3" y="8" width="248" height="229" rx="43" fill="${selected?'#7511db':'#b48960'}"/><rect x="3" y="3" width="248" height="229" rx="43" fill="url(#${gid})" stroke="${selected?'#b13aff':'#f0cba5'}" stroke-width="6"/><rect x="11" y="11" width="232" height="209" rx="35" fill="none" stroke="white" stroke-width="3"/>`,'Independent magnet card frame; no magnet baked into its pixels.');
}
for(const state of ['default','valid','invalid','hint']){
 const color=state==='default'?palette.cream:palette[state],p=pts(W,H),b=p.map(([x,y])=>[x,y+14]),gid='tile-'+state;
 component('Tile '+state,W,H+14,`<defs>${gradient(gid,[[0,'#fff9ec'],[1,color]])}</defs><path d="${d([p[5],p[4],p[3],p[2],p[1],b[1],b[2],b[3],b[4],b[5]])}" fill="#c8a576"/><polygon points="${poly(p)}" fill="#fce5bf"/><polygon points="${poly(pts(W,H,4))}" fill="url(#${gid})" stroke="#fffbed" stroke-width="3"/><polygon points="${poly(pts(W,H,12))}" fill="none" stroke="${state==='default'?'#ddc49e':color}" stroke-width="4" opacity=".8"/>`,'Point-up hex. Outer vertices use shared W=160, H=2W/sqrt(3)*0.78. No inset is applied to the tiling contour.');
}
for(const [color,c] of Object.entries(colors)){
 const w=116,h=H*w/W,p=pts(w,h),inner=pts(42,h*42/w).map(([x,y])=>[x+(w-42)/2,y+(h-h*42/w)/2]),gid='ring-'+color;
 const front=[p[1],p[2],p[3],p[4],p[5]],side=front.concat(front.map(([x,y])=>[x,y+THICKNESS]).reverse());
 const walls=[5,0,1].map(i=>{const a=inner[i],b=inner[(i+1)%6];return `<polygon points="${poly([a,b,[b[0],b[1]+THICKNESS],[a[0],a[1]+THICKNESS]])}" fill="${c[3]}"/>`}).join('');
 component('Ring '+color,w,h+THICKNESS,`<defs>${gradient(gid,[[0,c[0]],[.4,c[1]],[1,c[2]]])}<clipPath id="${gid}-hole"><path d="${d(inner)}"/></clipPath></defs><path d="${d(side)}" fill="${c[2]}" stroke="${c[3]}" stroke-width="1.3"/><path d="${d(front)}" fill="none" stroke="${c[0]}" stroke-width="1" opacity=".45" transform="translate(0 ${THICKNESS-2})"/><path d="${d(p)+d(inner)}" fill-rule="evenodd" fill="url(#${gid})" stroke="${c[2]}" stroke-width="1.5"/><path d="${d(pts(w,h,3))+d(pts(44,h*44/w).map(([x,y])=>[x+(w-44)/2,y+(h-h*44/w)/2]))}" fill="none" stroke="${c[0]}" stroke-width="1.4"/><g clip-path="url(#${gid}-hole)">${walls}</g>`,'Exactly one ring, thickness 16. Same contour and projection as Tile, scaled to width 116. Hole remains transparent.');
}
const iconPaths={Pause:'M38 30h12v48H38z M62 30h12v48H62z',Close:'M36 30l42 42-8 8-42-42z M70 30l8 8-42 42-8-8z',Restart:'M52 12A40 40 0 1 0 91 65L80 60A28 28 0 1 1 53 24V39L80 18 53 0Z',Hint:'M40 4C11 4 5 40 24 56L28 64H52L56 56C75 40 69 4 40 4Z M29 70H51V78H29Z M34 82H46V87H34Z',Blocker:'M39 22L22 39 49 66 22 93 39 110 66 83 93 110 110 93 83 66 110 39 93 22 66 49Z',Check:'M12 42L33 64 79 12 92 25 33 88 0 54Z',Cross:'M15 0L40 25 65 0 80 15 55 40 80 65 65 80 40 55 15 80 0 65 25 40 0 15Z'};
for(const [name,body] of Object.entries(iconPaths))component('Icon '+name,name==='Hint'?80:112,name==='Hint'?90:112,`<path d="${body}" fill="${name==='Blocker'?'#969bb5':'#fffef9'}" stroke="${name==='Blocker'?'#555d7c':'#ded3f4'}" stroke-width="2"/>`,'Editable SVG icon; no letter or symbol is added to the magnet.');
component('Round button',108,108,`<defs>${gradient('round',[[0,'#bd9aff'],[.5,'#8040db'],[1,'#49109f']])}</defs><circle cx="54" cy="56" r="50" fill="#532689"/><circle cx="54" cy="52" r="49" fill="url(#round)" stroke="#ffdf74" stroke-width="5"/><circle cx="54" cy="52" r="44" fill="none" stroke="#e7ceff" stroke-width="2"/>`,'Round pause/close button rim.');
component('Star',150,150,'<defs>'+gradient('star',[[0,'#fff4a0'],[.45,'#ffde34'],[1,'#ff9b09']])+'</defs><path d="M75 5L96 49 145 56 109 92 118 142 75 118 32 142 41 92 5 56 54 49Z" fill="url(#star)" stroke="#fff8b8" stroke-width="5"/>','Editable celebration star.');
component('Arrow',200,300,'<path d="M174 287C106 225 65 157 64 72L33 93 16 69 73 5 133 64 112 88 87 64C86 144 123 213 193 266Z" fill="#fffdfa" stroke="#c475ff" stroke-width="4"/>','Tutorial/hint route marker.');
for(const name of ['background','logo-exact','magnet-violet','magnet-blue','magnet-coral','tutorial-hand','defeat-magnet']){
 const file=path.join(root,'public/art/mockup',name+'.png'),bytes=fs.readFileSync(file);assets[name]={file:'assets/'+name+'.png',base64:bytes.toString('base64')};fs.copyFileSync(file,path.join(out,assets[name].file));
}
fs.copyFileSync(path.join(root,'public/fonts/Nunito.ttf'),path.join(out,'assets/Nunito.ttf'));
const ref=(id,x,y,w,h,extra={})=>({type:'instance',component:id,name:id,x,y,width:w??components[id].width,height:h??components[id].height,...extra});
const image=(asset,x,y,w,h)=>({type:'image',asset,name:asset,x,y,width:w,height:h});
const text=(value,x,y,w,size=42,color=palette.ink,align='CENTER')=>({type:'text',name:value,text:value,x,y,width:w,height:size*1.35,size,color,align});
const group=(name,x,y,w,h,children,extra={})=>({type:'frame',name,x,y,width:w,height:h,children,...extra});
const shape=(name,x,y,w,h,svg)=>({type:'vector',name,x,y,width:w,height:h,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg}</svg>`});
const button=(label,x,y,w=390,h=112,skin='purple',icon)=>group(label+' button',x,y,w,h,[ref('Button '+skin,0,0,w,h),...(icon?[ref('Icon '+icon,35,26,55,60)]:[]),text(label,icon?88:12,(h-58)/2,w-(icon?100:24),44,skin==='light'?palette.ink:palette.white)]);
function cell(col,row){return{x:(col-1)*W+(row%2?W/2:0),y:(row-1)*H*.75}}
const stacks=[{col:2,row:2,colors:['blue','blue','blue','violet','violet','violet']},{col:4,row:2,colors:['coral','coral','coral','blue','blue','blue']},{col:2,row:4,colors:['violet','violet','violet','coral','coral','coral']}];
function board(kind){
 const nodes=[],tutorial=kind==='tutorial',empty=kind==='victory',stateCell=kind==='invalid'?{col:2,row:2}:{col:3,row:3};
 for(let row=1;row<=5;row++)for(let col=1;col<=5;col++){
  const p=cell(col,row);let state='default';if(col===stateCell.col&&row===stateCell.row)state=kind==='valid'?'valid':kind==='invalid'?'invalid':['hint','tutorial'].includes(kind)?'hint':'default';
  nodes.push(ref('Tile '+state,p.x,p.y));
 }
 if(!tutorial)for(const row of [1,5]){const p=cell(3,row);nodes.push(ref('Icon Blocker',p.x+29,p.y+H/2-54,102,102))}
 const arrangement=['clearing','defeat'].includes(kind)?[]:tutorial?[{col:2,row:2,colors:Array(4).fill('violet')},{col:4,row:2,colors:Array(4).fill('violet')},{col:3,row:5,colors:Array(4).fill('violet')}]:stacks;
 if(!empty)for(const stack of arrangement){
  const p=cell(stack.col,stack.row),list=[...stack.colors];
  if(kind==='pulling'&&stack===arrangement[0])list.pop();
  const rings=list.map((color,i)=>ref('Ring '+color,22,H/2-H*116/W/2-(i+1)*THICKNESS));
  nodes.push(group(`Stack ${stack.col},${stack.row} — ${list.length} pieces`,p.x,p.y,W,H+14,rings));
 }
 const target=cell(3,3);
 if(['valid','pulling','clearing'].includes(kind))nodes.push(image('magnet-violet',target.x+23,target.y+H/2-45,114,104));
 if(kind==='invalid'){const p=cell(2,2);nodes.push(ref('Icon Cross',p.x+80,p.y-40,60,60))}
 if(kind==='pulling'){
  const p=cell(2,2);nodes.push(ref('Ring violet',p.x+100,p.y-80,116,H*116/W+16,{rotation:-27}));
  nodes.push(shape('One-piece flight trail — 2,2 to 3,2',p.x+70,p.y-25,180,100,'<path d="M0 80Q90 -40 170 80" fill="none" stroke="#f8c8ff" stroke-width="9" stroke-linecap="round" stroke-dasharray="3 22"/>'));
 }
 if(kind==='clearing'){
  for(let i=0;i<6;i++)nodes.push(ref('Ring violet',target.x+22+(i%2?8:-8),target.y+H/2-H*116/W/2-(i+1)*THICKNESS,116,H*116/W+16,{opacity:.65}));
  nodes.push(text('+6',target.x-15,target.y-125,190,80,'#fff19f'));
  for(let i=0;i<8;i++)nodes.push(ref('Star',target.x-45+Math.cos(i*Math.PI/4)*115,target.y-10+Math.sin(i*Math.PI/4)*120,28,28));
 }
 if(kind==='defeat'){const p=cell(2,4);nodes.push(group('Remaining stack — 6 pieces',p.x,p.y,W,H+14,Array.from({length:6},(_,i)=>ref('Ring violet',22,H/2-H*116/W/2-(i+1)*THICKNESS))))}
 if(['hint','tutorial'].includes(kind))nodes.push(ref('Arrow',target.x+5,target.y+35,145,218));
 return group('Board — exact shared-edge hex grid',30,450,880,H*4+14,nodes);
}
function baseScreen(id,label,kind){
 const tutorial=kind==='tutorial',nodes=[image('background',0,0,941,1672),image('logo-exact',48,20,371,228),ref('Level badge',442,107),text('LEVEL '+(tutorial?'1':'3'),452,121,301,48),ref('Round button',795,99),ref('Icon Pause',817,119,64,64)];
 const cleared=kind==='victory'?18:['clearing','defeat'].includes(kind)?12:0,moves=kind==='defeat'?0:kind==='victory'?2:kind==='clearing'?1:5;
 nodes.push(group('HUD',58,249,831,125,[ref('Panel',0,0),text(`CLEARED ${cleared} / ${tutorial?12:18}`,38,17,505,42,palette.ink,'LEFT'),shape('Progress track',38,83,500,31,'<rect width="500" height="31" rx="15" fill="#baa8b1"/><rect x="2" y="2" width="496" height="27" rx="13" fill="#cdbdc4" stroke="#fef7ec" stroke-width="2"/>'+Array.from({length:12},(_,i)=>`<path d="M${n(i*500/12)} 3V28" stroke="#fff6ed" stroke-width="2" opacity=".7"/>`).join('')+(cleared?`<rect x="2" y="2" width="${n(496*cleared/18)}" height="27" rx="13" fill="#a12ff0"/>`:'')),ref('Moves panel',595,0),text('MOVES',607,12,212,32),text(String(tutorial?3:moves),607,41,212,65)]));
 nodes.push(board(kind));
 const messages={tutorial:'Place a magnet on an empty tile',valid:'Release to place the magnet',invalid:'Choose an empty tile',pulling:'Pulling one piece at a time…',clearing:'Six pieces. Great clear!',hint:'Try the highlighted tile'};
 if(tutorial)nodes.push(ref('Instruction panel',90,1098),text(messages.tutorial,105,1124,730,44),text('Pieces move one at a time',105,1180,730,33));
 else nodes.push(text(messages[kind]??'Choose a magnet and an empty tile.',45,1136,850,40,palette.white));
 const tray=[];for(const [i,color] of (tutorial?['violet']:['violet','blue','coral']).entries()){
  const x=tutorial?306:28+i*268;tray.push(group(color+' magnet card',x,22,254,240,[ref(i===0?'Tool selected':'Tool neutral',0,0),image('magnet-'+color,23,32,208,187)]));
 }
 nodes.push(group('Magnet selector',31,1210,880,286,[ref('Magnet tray',0,0),...tray]));
 if(!tutorial)nodes.push(button('Hint',58,1515,390,112,'purple','Hint'),button('Restart',491,1515,390,112,'purple','Restart'));
 if(tutorial)nodes.push(image('tutorial-hand',485,1458,172,175));
 return {id,label,kind,width:941,height:1672,children:nodes};
}
screens.push({id:'01-loading',label:'Loading',kind:'loading',width:941,height:1672,children:[image('background',0,0,941,1672),image('logo-exact',155,230,630,387),image('magnet-violet',245,760,208,187),image('magnet-blue',500,780,208,187),ref('Ring coral',440,935),ref('Ring violet',415,919),ref('Ring blue',390,903),text('One magnet. A whole chain.',80,1125,781,48,palette.white),ref('Panel',111,1398,720,95),shape('Loading progress 72%',125,1410,508,73,'<defs>'+gradient('loading-fill',[[0,'#f1b8ff'],[1,'#9339f7']])+'</defs><rect width="508" height="73" rx="35" fill="url(#loading-fill)" stroke="#ffdcff" stroke-width="4"/>'),text('72%',320,1418,300,44,palette.white),text('Loading artwork…',80,1525,781,36,palette.white)]});
for(const [id,label,kind] of [['02-tutorial','Tutorial','tutorial'],['03-playing','Ready to play','playing'],['04-placement-valid','Valid placement','valid'],['05-placement-invalid','Invalid placement','invalid'],['06-pulling','Pulling one by one','pulling'],['07-clearing','Clearing a group','clearing'],['08-hint','Hint','hint'],['09-paused','Paused','paused'],['10-victory','Victory','victory'],['11-defeat','Out of moves','defeat']])screens.push(baseScreen(id,label,kind));
for(const s of screens.filter(s=>['paused','victory','defeat'].includes(s.kind))){
 s.children.push(shape('Dimmed game',0,0,941,1672,'<rect width="941" height="1672" fill="#190852" opacity=".58"/>'));
 const children=[ref('Modal',0,0)];
 if(s.kind==='paused')children.push(text('PAUSED',60,44,588,84),image('magnet-violet',230,190,248,223),button('Resume',65,460,577,145,'green'),button('Restart',119,625,469,104,'light'),text('Reduced motion',45,736,420,32),shape('Reduced motion off',520,725,140,65,'<rect width="140" height="65" rx="32" fill="#c6b5ac"/><circle cx="34" cy="32" r="27" fill="#fffdf5" stroke="#9d8c89" stroke-width="2"/>'));
 if(s.kind==='victory')children.push(text('BOARD CLEARED!',15,68,678,71),ref('Star',118,183,140,140),ref('Star',280,155,150,150),ref('Star',450,183,140,140),text('Nice chain!',55,365,598,54),button('Next puzzle',65,475,577,145,'green'),button('Play again',119,645,469,104,'light'));
 if(s.kind==='defeat')children.push(text('OUT OF',40,35,628,87),text('MOVES',40,125,628,100),image('defeat-magnet',175,255,358,280),text('Try a different magnet order',45,540,618,40),button('Try again',65,610,577,145,'green'));
 const modalY=s.kind==='paused'?480:539;
 s.children.push(group(s.label+' dialog',118,modalY,708,s.kind==='paused'?820:775,children));
 if(s.kind==='paused'){s.children.at(-1).children[0].height=820;s.children.push(ref('Round button',765,modalY-35,108,108),ref('Icon Close',787,modalY-13,64,64))}
}
screens.push({id:'12-render-error',label:'Launch error',kind:'error',width:941,height:1672,children:[image('background',0,0,941,1672),image('logo-exact',155,80,630,387),ref('Modal',118,555,708,775),text("COULDN'T OPEN",145,610,650,67),text('THE BOARD',145,690,650,70),image('magnet-violet',345,840,250,225),text('Please try again',155,1100,630,45),button('Retry',183,1180,577,145,'green'),text('Check your connection and browser support',70,1435,801,30,palette.white)]});

// Geometry verification checks actual shared endpoints, not approximate gaps.
const edgeMap=new Map();for(let row=1;row<=5;row++)for(let col=1;col<=5;col++){
 const p=cell(col,row),points=pts(W,H).map(([x,y])=>[n(x+p.x),n(y+p.y)]);
 for(let i=0;i<6;i++){const key=[points[i].join(','),points[(i+1)%6].join(',')].sort().join('|');edgeMap.set(key,(edgeMap.get(key)||0)+1)}
}
const sharedEdges=[...edgeMap.values()].filter(v=>v===2).length;assert.equal(sharedEdges,56);assert.ok([...edgeMap.values()].every(v=>v<=2));
function descendants(node){return [node,...(node.children??[]).flatMap(descendants)]}
const pieceCounts={};for(const s of screens){
 const field=s.children.find(node=>node.name==='Board — exact shared-edge hex grid');if(!field)continue;
 const pieces=descendants(field).filter(node=>node.type==='instance'&&node.component.startsWith('Ring ')).length;
 const cleared=['clearing','defeat'].includes(s.kind)?12:s.kind==='victory'?18:0;
 const total=s.kind==='tutorial'?12:18;assert.equal(pieces+cleared,total,s.id+' must conserve pieces');pieceCounts[s.id]={visible:pieces,cleared,total};
}
const report={screens:screens.length,components:Object.keys(components).length,sharedEdges,pieceCounts,hex:{width:W,height:H,rowPitch:H*.75,columnPitch:W,oddRowOffset:W/2,projectionY:.78,ringWidth:116,ringThickness:THICKNESS},figmaFile:'https://www.figma.com/design/'+fileKey,figmaStatus:'File created; remote construction blocked by Starter MCP call limit. Offline import not yet verified in Figma.'};
const spec={version:1,report,palette,components,screens};
fs.writeFileSync(path.join(out,'design.json'),JSON.stringify(spec,null,2));
function render(node){
 const transform=`translate(${node.x} ${node.y})${node.rotation?` rotate(${node.rotation} ${node.width/2} ${node.height/2})`:''}`,opacity=node.opacity??1;
 if(node.type==='frame')return `<g data-layer="${esc(node.name)}" transform="${transform}" opacity="${opacity}">${node.children.map(render).join('')}</g>`;
 if(node.type==='instance')return `<use data-layer="${esc(node.name)}" href="#c-${node.component.replaceAll(' ','-')}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" opacity="${opacity}"${node.rotation?` transform="rotate(${node.rotation} ${node.x+node.width/2} ${node.y+node.height/2})"`:''}/>`;
 if(node.type==='image')return `<image data-layer="${esc(node.name)}" href="${assets[node.asset].file}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" preserveAspectRatio="xMidYMid meet"/>`;
 if(node.type==='text')return `<text data-layer="${esc(node.name)}" x="${node.x+(node.align==='CENTER'?node.width/2:0)}" y="${node.y+node.size}" font-family="Nunito" font-weight="900" font-size="${node.size}" text-anchor="${node.align==='CENTER'?'middle':'start'}" fill="${node.color}">${esc(node.text)}</text>`;
 return `<g data-layer="${esc(node.name)}" transform="${transform}">${node.svg.replace(/<svg[^>]*>|<\/svg>/g,'')}</g>`;
}
const defs=Object.entries(components).map(([id,c])=>`<symbol id="c-${id.replaceAll(' ','-')}" viewBox="0 0 ${c.width} ${c.height}">${c.svg.replace(/<svg[^>]*>|<\/svg>/g,'')}</symbol>`).join('');
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672" viewBox="0 0 941 1672" role="img" aria-label="${s.label}"><defs>${defs}<style>@font-face{font-family:Nunito;src:url(assets/Nunito.ttf)}</style></defs>${s.children.map(render).join('')}</svg>`;
for(const s of screens)fs.writeFileSync(path.join(out,s.id+'.svg'),svg(s));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Magnet Sort · Editable Figma source</title><style>@font-face{font-family:Nunito;src:url(assets/Nunito.ttf)}*{box-sizing:border-box}body{margin:0;padding:40px;background:#141025;color:#faf3ff;font:18px Nunito}h1{margin:0}p{max-width:950px;color:#c7b7e7}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:30px}figure{margin:0;min-width:0}svg{width:100%;height:auto;border-radius:18px}figcaption{margin:12px 0 30px}a{color:#e2c9ff}.badge{color:#ffd17b}@media(max-width:900px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>Magnet Sort · Figma assembly</h1><p>12 editable screen compositions. Cells and rings use the same projected point-up hex. ${sharedEdges} shared grid edges match exactly. English UI, plain magnets.</p><p class="badge">Offline preview. The Figma file is still empty because the Starter MCP quota blocked construction.</p><p><a href="https://www.figma.com/design/${fileKey}">Figma file</a> · <a href="README.md">Import instructions</a> · <a href="design.json">Layer specification</a></p><main>${screens.map(s=>`<figure id="${s.id}">${svg(s)}<figcaption>${s.id.slice(0,2)} · ${s.label}</figcaption></figure>`).join('')}</main></html>`);
// A standard development plugin is provided for manual import, not executed by
// the agent as a workaround for the exhausted connector quota.
const plugin=`const design=${JSON.stringify(spec)};\nconst assets=${JSON.stringify(assets)};\n`+fs.readFileSync(path.join(__dirname,'figma-screen-importer.js'),'utf8');
fs.mkdirSync(path.join(out,'figma-plugin'),{recursive:true});
fs.writeFileSync(path.join(out,'figma-plugin/code.js'),plugin);
fs.writeFileSync(path.join(out,'figma-plugin/manifest.json'),JSON.stringify({name:'Magnet Sort — Import 12 editable screens',...(process.env.FIGMA_PLUGIN_ID?{id:process.env.FIGMA_PLUGIN_ID}:{}),api:'1.0.0',main:'code.js',editorType:['figma'],documentAccess:'dynamic-page',networkAccess:{allowedDomains:['none']}},null,2));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'README.md'),fs.readFileSync(path.join(root,'docs/design/FIGMA_ASSEMBLY.md')));
console.log(JSON.stringify(report));
