import fs from 'node:fs';
import {scenario} from '../docs/design/prototypes/gameplay-counted-hex/fixtures.js';
import {DESIGN,position,project} from '../docs/design/prototypes/gameplay-counted-hex/geometry.js';
import {topRunCount} from '../docs/design/prototypes/gameplay-counted-hex/presentation.js';
const root='docs/design/prototypes/gameplay-counted-hex',out=root+'/painted-study';
const sizes=JSON.parse(fs.readFileSync(out+'/sizes.json'));
const template=fs.readFileSync('artifacts/gameplay-counted-hex/gameplay-counted-hex.svg','utf8');
const bg=template.slice(0,template.indexOf('<g id="Pieces">'));
const state=scenario().before;
const paintedPitch=.11;
function pieces(stacks){return stacks.map(stack=>{
 const p=position(stack.cell),center=project(p.x,DESIGN.floor,p.z),width=DESIGN.chipRadius*Math.sqrt(3)*DESIGN.board.width/9;
 // The image already contains the thin wall. Anchor at its top-face centre.
 const images=stack.units.map((u,i)=>{const size=sizes[u.color],height=width*size.height/size.width;
  const q=project(p.x,DESIGN.floor+i*paintedPitch,p.z);
  return `<image id="Painted-${u.id}" x="${center.x-width/2}" y="${q.y-height*.485}" width="${width}" height="${height}" href="data:image/png;base64,${fs.readFileSync(out+'/'+u.color+'.png').toString('base64')}"/>`;
 }).join('');
 const q=project(p.x,DESIGN.floor+(stack.units.length-1)*paintedPitch,p.z);
 return `<g id="Stack-r${stack.cell.row}c${stack.cell.col}">${images}<text x="${q.x}" y="${q.y+17}" font-family="Nunito" font-size="48" font-weight="1000" text-anchor="middle" fill="white" stroke="#281039" stroke-width="3" paint-order="stroke fill">${topRunCount(stack.units)}</text></g>`;
}).join('');}
for(const [name,stacks] of [['composition',state.stacks],['twenty',scenario('tall').before.stacks]])fs.writeFileSync(out+'/'+name+'.svg',bg+`<g id="Pieces">${pieces(stacks)}</g></svg>`);
fs.writeFileSync(out+'/index.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Magnet Sort — regenerated painted chips</title><style>@font-face{font-family:Nunito;src:url('/fonts/Nunito.ttf')}body{margin:0;background:#190c35;color:white;font-family:Nunito}main{display:flex;flex-wrap:wrap;justify-content:center;gap:24px;padding:16px}figure{margin:0;width:min(390px,100%)}svg{width:100%;height:auto}figcaption{text-align:center;padding:10px}</style><main>${['composition','twenty'].map(n=>`<figure>${fs.readFileSync(out+'/'+n+'.svg','utf8')}<figcaption>${n==='composition'?'6 violet · 6 blue · 3 violet + 3 coral':'20 individual violet chips'}</figcaption></figure>`).join('')}</main></html>`);
console.log('Painted composition: 18 distinct image IDs; stress study: 20.');

