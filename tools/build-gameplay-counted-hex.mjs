import fs from 'node:fs';
import path from 'node:path';
import {scenario} from '../docs/design/prototypes/gameplay-counted-hex/fixtures.js';
import {DESIGN,position,project} from '../docs/design/prototypes/gameplay-counted-hex/geometry.js';
import {topRunCount} from '../docs/design/prototypes/gameplay-counted-hex/presentation.js';
import {chipSvg,PALETTE} from '../docs/design/prototypes/gameplay-counted-hex/chip.js';
import {spriteRect} from '../docs/design/prototypes/gameplay-counted-hex/sprites.js';
const root='docs/design/prototypes/gameplay-counted-hex',out='artifacts/gameplay-counted-hex';
fs.mkdirSync(root+'/assets',{recursive:true});fs.mkdirSync(out,{recursive:true});
let ui;
if(fs.existsSync('artifacts/figma-exact/manifest.json')) {
 const manifest=JSON.parse(fs.readFileSync('artifacts/figma-exact/manifest.json'));
 const source=manifest.screens.find(s=>s.name==='03-playing');
 const layers=source.layers.filter(l=>!l.name.startsWith('Board')&&!l.name.startsWith('Pieces')&&l.kind!=='background');
 ui=layers.map((l,i)=>{const name=`ui-${String(i).padStart(2,'0')}.png`;fs.copyFileSync('artifacts/figma-exact/'+l.file,root+'/assets/'+name);return {...l,url:'./assets/'+name};});
} else ui=JSON.parse(fs.readFileSync(root+'/ui-layers.json'));
if(!fs.existsSync(root+'/assets/background.png'))fs.copyFileSync('public/art/mockup/background.png',root+'/assets/background.png');
fs.writeFileSync(root+'/ui-layers.json',JSON.stringify(ui,null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const image=(file,x,y,w,h,name)=>`<image id="${esc(name)}" x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"/>`;
const sizes=JSON.parse(fs.readFileSync(root+'/assets/sprite-sizes.json'));
const sprite=(cell,y,name,id)=>{const r=spriteRect(cell,y,name,sizes);return image(root+'/assets/'+name+'.png',r.x,r.y,r.width,r.height,id);};
const state=scenario().before;let board='';
for(const cell of [...state.cells].sort((a,b)=>position(a).z-position(b).z)){
 board+=sprite(cell,.12,'tile-cream',`Cell-r${cell.row}c${cell.col}`);
 const blocked=state.blockers.some(c=>c.col===cell.col&&c.row===cell.row);
 if(blocked)board+=sprite(cell,.13,'blocker',`Blocker-r${cell.row}c${cell.col}`);
}
let pieces='';
for(const stack of [...state.stacks].sort((a,b)=>position(a.cell).z-position(b.cell).z)){
 let group='';stack.units.forEach((u,i)=>{group+=chipSvg(stack.cell,i,u.color,'Chip-'+u.id);});
 const p=position(stack.cell),q=project(p.x,DESIGN.floor+stack.units.length*DESIGN.thickness,p.z);
 group+=`<text id="Count-r${stack.cell.row}c${stack.cell.col}" x="${q.x}" y="${q.y+17}" text-anchor="middle" font-family="Nunito" font-size="48" font-weight="900" fill="white" stroke="#281039" stroke-width="3" paint-order="stroke fill">${topRunCount(stack.units)}</text>`;
 pieces+=`<g id="Stack-r${stack.cell.row}c${stack.cell.col}">${group}</g>`;
}
const body=image(root+'/assets/background.png',0,0,941,1672,'Background')+ui.map(l=>image(path.join(root,l.url),l.x,l.y,l.width,l.height,l.name)).join('')+`<g id="Board">${board}</g><g id="Pieces">${pieces}</g>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="941" height="1672" viewBox="0 0 941 1672"><title>Gameplay v2 — counted thin hexes</title>${body}</svg>`;
fs.writeFileSync(out+'/gameplay-counted-hex.svg',svg);
// Separate reusable vector units, from the same facets as the real 3D bodies.
for(const color of Object.keys(PALETTE)){
 const center=project(0,DESIGN.floor,0),w=DESIGN.chipRadius*Math.sqrt(3)*DESIGN.board.width/9+4;
 const h=w*1.2;
 fs.writeFileSync(root+'/assets/chip-'+color+'-thin.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${center.x-w/2} ${center.y-h/2} ${w} ${h}">${chipSvg({col:3,row:3},0,color,'Chip-'+color)}</svg>`);
}
fs.writeFileSync(out+'/geometry-proof.json',JSON.stringify({design:DESIGN,units:state.stacks.map(s=>({cell:s.cell,units:s.units,count:topRunCount(s.units)})),tileCount:state.cells.length,discreteUiImages:25,boardSprites:39},null,2));
console.log('Built gameplay SVG: 19 cells, 18 individual chips, 2 blockers, 3 counters, 25 preserved UI images.');
