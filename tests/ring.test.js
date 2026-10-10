import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRingGeometry, RING_HEIGHT, RING_RADIUS, ringFaceUV } from '../src/prototype/ring.js';

test('solid ring has a real through hole and exactly one layer of height', () => {
  const geometry = createRingGeometry();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(mesh).length, 0, 'centre is open rather than painted dark');
  ray.ray.origin.x = .32;
  assert.ok(ray.intersectObject(mesh).length > 0, 'ring body has a solid cap');
  assert.ok(Math.abs(geometry.boundingBox.min.y) < 1e-6);
  assert.ok(Math.abs(geometry.boundingBox.max.y - RING_HEIGHT) < 1e-6);
  // Point-up hex: its two tips are along the row axis, not the column axis.
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.z > size.x);
  geometry.dispose(); material.dispose();
});

test('top texture never samples the baked side wall or the adjacent PNG layer', () => {
  for (let index = 0; index < 360; index++) {
    const angle = index * Math.PI / 180;
    const uv = ringFaceUV(Math.sin(angle) * RING_RADIUS, Math.cos(angle) * RING_RADIUS);
    const pixelY = (1 - uv.y) * 75;
    assert.ok(pixelY >= 5 - 1e-6 && pixelY <= 59 + 1e-6);
    assert.ok(uv.x > 0 && uv.x < 1);
  }
});
