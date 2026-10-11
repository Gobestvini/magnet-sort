import * as THREE from 'three';
// World-space rise projects to about one tenth of a wafer's width on screen.
export const CHIP_HEIGHT = .14;
export const CHIP_DEPTH = .028;
export const WELL_INSET = .975;
export const WELL_PIXELS = [[235,53],[420,155],[420,310],[235,415],[50,310],[50,155]];
const contour = [[0,.5],[.5,79/362],[.5,-76/362],[0,-.5],[-.5,-76/362],[-.5,79/362]];

// Complete authored wafer: cap, bevel and front wall share the tile's camera.
export function chipLayout(screenUpY, tileWidth, tileHeight) {
  return { width: tileWidth * 370 / 471 * WELL_INSET,
    height: tileHeight * 362 / 512 * WELL_INSET,
    offsetX: (235 / 471 - .5) * tileWidth,
    offset: -CHIP_HEIGHT * .5 * screenUpY };
}

// Adapt the wafer's six boundary corners to the actual well; a uniform scale
// cannot fit both the angled shoulders and the front tip of the authored art.
export function createInsetFaceGeometry() {
  const vertices = [[0,0], ...contour];
  const uv = [[.5,.5],[.5,1],[1,.75],[1,.29],[.5,0],[0,.29],[0,.75]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(([x,y])=>[x,y,0]),3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(),2));
  geometry.setIndex(contour.flatMap((_,i)=>[0,i+1,(i+1)%6+1]));
  geometry.computeVertexNormals();
  return geometry;
}

// Thin backing supplies an edge during flips, behind the complete raster.
export function createChipBodyGeometry(width, height) {
  const shape = new THREE.Shape();
  contour.forEach(([x,y],i)=>i ? shape.lineTo(x*width*.985,y*height*.985) : shape.moveTo(x*width*.985,y*height*.985));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: CHIP_DEPTH, bevelEnabled: false, curveSegments: 6, steps: 1,
  });
  geometry.translate(0, 0, -CHIP_DEPTH);
  return geometry;
}

export function topColorCount(units) {
  const color = units.at(-1)?.color;
  let count = 0;
  for (let i = units.length - 1; i >= 0 && units[i].color === color; i--) count++;
  return count;
}
