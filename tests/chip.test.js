import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createChipGeometry,createChipSeamGeometry,CHIP_HEIGHT,CHIP_RADIUS,CHIP_SEAM,chipFaceUV,topColorCount} from '../src/prototype/chip.js';
test('thin solid chip and seam meet with exact per-unit height and no ring hole',()=>{
 const top=createChipGeometry(),seam=createChipSeamGeometry();top.computeBoundingBox();seam.computeBoundingBox();
 assert.ok(Math.abs(top.boundingBox.min.y-CHIP_SEAM)<1e-6);assert.ok(Math.abs(top.boundingBox.max.y-CHIP_HEIGHT)<1e-6);
 assert.ok(Math.abs(seam.boundingBox.min.y)<1e-6);assert.ok(Math.abs(seam.boundingBox.max.y-CHIP_SEAM)<1e-6);
 assert.ok(CHIP_RADIUS+.008<.64*.78);assert.ok(CHIP_HEIGHT<.075);
 // Ray through the centre must hit a solid cap (legacy ring centre was empty).
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(top,material);mesh.updateMatrixWorld();
 const hits=new THREE.Raycaster(new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
 assert.ok(hits.some(h=>Math.abs(h.point.y-CHIP_HEIGHT)<1e-6),'centre has a hole');material.dispose();
 for(let i=0;i<6;i++){const angle=i*Math.PI/3,uv=chipFaceUV(Math.sin(angle)*CHIP_RADIUS,Math.cos(angle)*CHIP_RADIUS);assert.ok(uv.x>=0&&uv.x<=1&&uv.y>=.04&&uv.y<=.992,'UV enters baked front wall');}
 top.dispose();seam.dispose();
});
test('chip badge counts contiguous exposed color, including zero and twenty',()=>{
 assert.equal(topColorCount([]),0);assert.equal(topColorCount(['violet','blue','violet'].map(color=>({color}))),1);
 assert.equal(topColorCount(['violet','violet','coral','coral','coral'].map(color=>({color}))),3);
 assert.equal(topColorCount(Array.from({length:20},()=>({color:'blue'}))),20);
});
