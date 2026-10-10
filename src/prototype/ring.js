import * as THREE from 'three';

export const RING_RADIUS = .51;
export const RING_HEIGHT = .15;
const BEVEL = .025;

// The common point-up contour lives on the board plane. Do not rotate a
// perspective-baked PNG in screen space: it also rotates its baked side wall.
export function hexContour(radius, reverse = false) {
  const shape = new THREE.Shape();
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (reverse ? -index : index) * Math.PI / 3;
    return new THREE.Vector2(Math.sin(angle) * radius, Math.cos(angle) * radius);
  });
  points.forEach((point, index) => {
    const previous = points[(index + 5) % 6], next = points[(index + 1) % 6];
    const start = point.clone().lerp(previous, .07), end = point.clone().lerp(next, .07);
    if (!index) shape.moveTo(start.x, start.y); else shape.lineTo(start.x, start.y);
    shape.quadraticCurveTo(point.x, point.y, end.x, end.y);
  });
  shape.closePath();
  return shape;
}

// Unproject the authored flat-up top face, then turn it 30 degrees on the
// board plane. UVs intentionally exclude the lower PNG pixels containing a
// baked side wall and a sliver of the next layer in the original stack.
export function ringFaceUV(x, y) {
  const turnedX = x * Math.cos(Math.PI / 6) + y * .5;
  const turnedY = -x * .5 + y * Math.cos(Math.PI / 6);
  return new THREE.Vector2((58 + turnedX / RING_RADIUS * 52) / 116,
    1 - (32 - turnedY / RING_RADIUS * 27) / 75);
}

export function createRingGeometry() {
  const shape = hexContour(RING_RADIUS);
  shape.holes.push(hexContour(.185, true));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: RING_HEIGHT - BEVEL * 2, bevelEnabled: true,
    bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 3,
    curveSegments: 4, steps: 1,
    UVGenerator: {
      generateTopUV: (_, vertices, ...indices) => indices.map(index => ringFaceUV(vertices[index * 3], vertices[index * 3 + 1])),
      generateSideWallUV: (_, vertices, ...indices) => indices.map(index => new THREE.Vector2(vertices[index * 3], vertices[index * 3 + 2] / RING_HEIGHT)),
    },
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, BEVEL, 0);
  geometry.computeBoundingBox();
  return geometry;
}
