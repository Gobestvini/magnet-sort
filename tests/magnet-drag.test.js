import test from 'node:test';
import assert from 'node:assert/strict';
import { createMagnetDrag, stepMagnetDrag, dragSettled } from '../src/prototype/drag.js';
import { createStepper } from '../src/loop.js';

test('magnet has inertia, bounded lean and settles after release', () => {
  const body = createMagnetDrag(0, 0, 'violet');
  body.targetX = 250; body.targetY = -100;
  stepMagnetDrag(body, 1 / 60);
  assert.ok(body.x > 0 && body.x < 250);
  for (let i = 0; i < 12; i++) stepMagnetDrag(body, 1 / 60);
  assert.ok(body.angle > 1 && body.angle < 25);
  body.released = true; body.age = 0;
  for (let i = 0; i < 60; i++) stepMagnetDrag(body, 1 / 60);
  assert.ok(dragSettled(body));
  assert.ok(Math.hypot(body.x - 250, body.y + 100) < .6);
});

test('spring follows the same fixed simulation at 30/60/120/144 FPS', () => {
  const results = [30, 60, 120, 144].map(fps => {
    const body = createMagnetDrag(0, 0, 'blue');
    body.targetX = 300; body.targetY = 100;
    const stepper = createStepper();
    for (let i = 0; i < fps; i++) stepper.advance(1 / fps, dt => stepMagnetDrag(body, dt));
    return body;
  });
  for (const body of results) assert.ok(Math.abs(body.x - results[0].x) < 1e-8);
});

test('reduced motion tracks directly without lean or lingering release', () => {
  const body = createMagnetDrag(0, 0, 'coral');
  body.targetX = 300; body.targetY = 100;
  stepMagnetDrag(body, 1 / 60, true);
  assert.equal(body.x, 300); assert.equal(body.y, 100); assert.equal(body.angle, 0);
  body.released = true;
  assert.ok(dragSettled(body, true));
});

test('size shrinks and returns monotonically without depending on frame rate',()=>{
  const results=[30,60,120,144].map(fps=>{
    const body=createMagnetDrag(0,0,'blue',100),stepper=createStepper();
    body.targetSize=40;
    for(let i=0;i<fps;i++) stepper.advance(1/fps,dt=>{
      const last=body.size;stepMagnetDrag(body,dt);assert.ok(body.size<=last && body.size>=40);
    });
    const small=body.size;body.targetSize=body.homeSize;
    for(let i=0;i<fps;i++) stepper.advance(1/fps,dt=>{
      const last=body.size;stepMagnetDrag(body,dt);assert.ok(body.size>=last && body.size<=100);
    });
    return {small,size:body.size};
  });
  for(const result of results) assert.ok(Math.abs(result.small-results[0].small)<1e-8);
  const body=createMagnetDrag(0,0,'blue',100);body.targetSize=40;stepMagnetDrag(body,0,true);
  assert.equal(body.size,40);assert.equal(body.previousSize,40);
});
