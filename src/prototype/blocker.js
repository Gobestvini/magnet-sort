import * as THREE from 'three';
import { createInsetFaceGeometry } from './chip.js';

// The plaque owns its entire silhouette. The X texture contains only the
// symbol, so transparent padding cannot shrink or tilt the fitted hex floor.
export function createBlockerPlateGeometry() {
  const geometry = createInsetFaceGeometry();
  const colors = ['#565d7c','#727997','#606783','#454b66','#383e57','#4c536e','#68718e'];
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(
    colors.flatMap(color => new THREE.Color(color).toArray()), 3));
  return geometry;
}
