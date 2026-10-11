import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleHexFlip } from '../src/prototype/motion.js';

test('one continuous half turn, lifted before travelling and flat at arrival', () => {
  let last=0;
  for(let i=0;i<=100;i++) {
    const pose=sampleHexFlip(i/100);
    assert.ok(pose.angle<=last+1e-9 && pose.angle>=-Math.PI);
    assert.ok(pose.lift>=0 && pose.travel>=0 && pose.travel<=1);
    last=pose.angle;
  }
  assert.equal(sampleHexFlip(0).lift,0);
  assert.equal(sampleHexFlip(1).lift,0);
  assert.equal(sampleHexFlip(1).angle,-Math.PI);
  assert.ok(sampleHexFlip(.1).lift>0);
  assert.ok(Math.abs(sampleHexFlip(.99999).lift)<1e-7);
  assert.equal(sampleHexFlip(1).travel,1);
  assert.equal(sampleHexFlip(.49).reverseFace,false);
  assert.equal(sampleHexFlip(.51).reverseFace,true);
});
test('reduced motion has no turn or vertical arc',()=>{
  for(const p of [0,.25,.5,.75,1]) {
    const pose=sampleHexFlip(p,true);
    assert.equal(pose.lift,0);assert.equal(pose.angle,0);assert.equal(pose.reverseFace,false);
  }
});
