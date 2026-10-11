import * as THREE from 'three';
import { hexContour } from './ring.js';

export const CHIP_RADIUS = .4352;
export const CHIP_WIDTH = Math.sqrt(3) * CHIP_RADIUS;
// World-space rise projects to about one tenth of a wafer's width on screen.
export const CHIP_HEIGHT = .14;
export const CHIP_DEPTH = .028;
export const CHIP_ANCHOR = .52;

// Complete authored wafer: cap, bevel and front wall share the tile's camera.
export function chipLayout(image, screenUpY) {
  const height = CHIP_WIDTH * image.height / image.width;
  return { width: CHIP_WIDTH, height,
    offset: (CHIP_ANCHOR - .5) * height - CHIP_HEIGHT * .5 * screenUpY };
}

// Thin backing supplies an edge during flips, behind the complete raster.
export function createChipBodyGeometry() {
  const geometry = new THREE.ExtrudeGeometry(hexContour(CHIP_RADIUS * .985), {
    depth: CHIP_DEPTH, bevelEnabled: false, curveSegments: 6, steps: 1,
  });
  geometry.scale(1, Math.sqrt(3) / 2 * 512 / 510, 1);
  geometry.translate(0, 0, -CHIP_DEPTH);
  return geometry;
}

export function topColorCount(units) {
  const color = units.at(-1)?.color;
  let count = 0;
  for (let i = units.length - 1; i >= 0 && units[i].color === color; i--) count++;
  return count;
}
