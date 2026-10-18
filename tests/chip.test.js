import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createChipBodyGeometry,CHIP_DEPTH,CHIP_HEIGHT,chipLayout,topColorCount} from '../src/prototype/chip.js';
test('backing prism is thin and solid during a flip',()=>{
 const geometry=createChipBodyGeometry(.85,.83);geometry.computeBoundingBox();
 assert.ok(Math.abs(geometry.boundingBox.min.z+CHIP_DEPTH)<1e-6);
 assert.ok(Math.abs(geometry.boundingBox.max.z)<1e-6);
 assert.ok(CHIP_DEPTH<.04);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();
 const hits=new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
 assert.ok(hits.length,'flip exposes a hollow centre');material.dispose();geometry.dispose();
});
test('raised wafer seat stays proportional to the tile and independent of camera tilt',()=>{
 for(const tileWidth of [1,1.103,1.2])for(const screenUpY of [.4,.54,.8]){
  const tileHeight=tileWidth*512/471,layout=chipLayout(screenUpY,tileWidth,tileHeight);
  const centre=CHIP_HEIGHT*.5*screenUpY+layout.offset;
  assert.ok(centre>0,'wafer seat must be above the well centre');
  assert.ok(Math.abs(centre/tileHeight-4/512)<1e-9,'seat shifts when scale or camera changes');
  assert.ok(CHIP_HEIGHT*screenUpY<layout.height*.16,'individual layers became thick');
 }
});
test('chip badge counts contiguous exposed color, including zero and twenty',()=>{
 assert.equal(topColorCount([]),0);assert.equal(topColorCount(['violet','blue','violet'].map(color=>({color}))),1);
 assert.equal(topColorCount(['violet','violet','coral','coral','coral'].map(color=>({color}))),3);
 assert.equal(topColorCount(Array.from({length:20},()=>({color:'blue'}))),20);
});
