import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleHexFlip, sampleHexTransfer } from '../src/prototype/motion.js';

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
test('v4 rocking hop remains front-facing and arrives continuously flat',()=>{
 let last=0;
 for(let i=0;i<=1000;i++){
  const p=sampleHexTransfer(i/1000);assert.ok(p.travel>=last);last=p.travel;
  assert.ok(p.lift>=-1e-9&&p.lift<=.28+1e-9);assert.ok(Math.abs(p.angle)<=Math.PI/6+1e-9);assert.equal(p.reverseFace,false);
 }
 for(const n of [0,1]){const p=sampleHexTransfer(n);assert.ok(Math.abs(p.angle)<1e-8);assert.ok(Math.abs(p.lift)<1e-8);assert.equal(p.travel,n);}
 const before=sampleHexTransfer(.999),end=sampleHexTransfer(1);assert.ok(Math.abs(before.angle-end.angle)<.00001);
 assert.equal(sampleHexTransfer(.5,true).angle,0);assert.equal(sampleHexTransfer(.5,true).lift,0);
});
