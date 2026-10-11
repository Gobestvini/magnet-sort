import * as THREE from 'three';
import { hexContour } from './ring.js';

export const CHIP_RADIUS = .4352;
export const CHIP_HEIGHT = .064;
export const CHIP_SEAM = .012;
const BEVEL = .008;
// Generated sprites: only top-face pixels, excluding the painted lower wall.
export function chipFaceUV(x,y) {
  return new THREE.Vector2(.5+x/(Math.sqrt(3)*CHIP_RADIUS)*.97,
    1-(.477-y/CHIP_RADIUS*.468));
}
export function createChipGeometry() {
  const geometry=new THREE.ExtrudeGeometry(hexContour(CHIP_RADIUS),{
    depth:CHIP_HEIGHT-CHIP_SEAM-2*BEVEL,bevelEnabled:true,
    bevelSize:BEVEL,bevelThickness:BEVEL,bevelSegments:3,curveSegments:6,steps:1,
    UVGenerator:{generateTopUV:(_,vertices,...indices)=>indices.map(i=>chipFaceUV(vertices[i*3],vertices[i*3+1])),
      generateSideWallUV:(_,vertices,...indices)=>indices.map(i=>new THREE.Vector2(vertices[i*3],vertices[i*3+2]))}
  });
  geometry.rotateX(-Math.PI/2);geometry.translate(0,CHIP_SEAM+BEVEL,0);return geometry;
}
export function createChipSeamGeometry(){
 const g=new THREE.ExtrudeGeometry(hexContour(CHIP_RADIUS-.002),{depth:CHIP_SEAM,bevelEnabled:false,curveSegments:6,steps:1});
 g.rotateX(-Math.PI/2);return g;
}
export function topColorCount(units){
 const color=units.at(-1)?.color;let count=0;
 for(let i=units.length-1;i>=0&&units[i].color===color;i--)count++;
 return count;
}
