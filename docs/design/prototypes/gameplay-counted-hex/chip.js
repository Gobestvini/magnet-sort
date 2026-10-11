import * as THREE from 'three';
import {DESIGN,contour,position,project} from './geometry.js';

// Shared, light-independent facets: SVG and WebGL use these exact vertices/colors.
// Each unit has its own thin body and dark bottom seam; no baked full-height wall.
export const PALETTE={
 violet:{top:'#ab60e7',bevel:'#cb96ef',side:'#7d3db0',seam:'#55257a'},
 blue:{top:'#419fe9',bevel:'#8dc8f3',side:'#2575b5',seam:'#18517f'},
 coral:{top:'#f07564',bevel:'#f7b1a0',side:'#ba4a40',seam:'#803129'}
};
export function chipFacets(color){
 const c=PALETTE[color],r=DESIGN.chipRadius,h=DESIGN.thickness;
 const rings=[[r-.008,0],[r,.014],[r,h-.008],[r-.012,h]].map(([radius,y])=>contour(radius).map(p=>({...p,y})));
 const faces=[];
 for(let band=0;band<3;band++)for(let i=0;i<6;i++){
  const j=(i+1)%6;
  faces.push({points:[rings[band][i],rings[band][j],rings[band+1][j],rings[band+1][i]],fill:[c.seam,c.side,c.bevel][band],front:(rings[band][i].z+rings[band][j].z)>1e-8});
 }
 faces.push({points:rings[3],fill:c.top,front:true});
 // Bottom cap matters when a unit flips.
 faces.push({points:[...rings[0]].reverse(),fill:c.side,front:false});
 return faces;
}
export function chipGeometry(color){
 const vertices=[],colors=[];
 for(const face of chipFacets(color))for(let i=1;i<face.points.length-1;i++){
  const shade=new THREE.Color(face.fill);
  for(const p of [face.points[0],face.points[i],face.points[i+1]]){vertices.push(p.x,p.y,p.z);colors.push(shade.r,shade.g,shade.b);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
export function chipSvg(cell,index,color,id){
 const at=position(cell),y=DESIGN.floor+index*DESIGN.thickness;
 return `<g id="${id}">`+chipFacets(color).filter(f=>f.front).map(f=>`<path d="${f.points.map((p,i)=>{const q=project(at.x+p.x,y+p.y,at.z+p.z);return `${i?'L':'M'}${q.x.toFixed(3)},${q.y.toFixed(3)}`;}).join(' ')}Z" fill="${f.fill}"/>`).join('')+'</g>';
}
