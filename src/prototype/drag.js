// Screen-space spring physics; presentation never chooses the placement cell.
export function createMagnetDrag(x, y, color, size = 80) {
  return { x, y, previousX: x, previousY: y, vx: 0, vy: 0, targetX: x, targetY: y,
    angle: 0, previousAngle: 0, spin: 0, color, size, previousSize: size, targetSize: size, homeSize: size, age: 0, released: false };
}

export function stepMagnetDrag(body, dt, reduced = false) {
  body.previousX = body.x; body.previousY = body.y; body.previousAngle = body.angle;
  body.age += dt;
  body.previousSize = body.size;
  if (reduced) {
    body.size = body.previousSize = body.targetSize;
    body.x = body.targetX; body.y = body.targetY; body.angle = 0; body.vx = body.vy = body.spin = 0;
    return;
  }
  // Monotone exponential response; 98% of the change takes about 200ms.
  body.size += (body.targetSize - body.size) * (1 - Math.exp(-20 * dt));
  // Semi-implicit spring with damping, integrated by the runtime's fixed step.
  const stiffness = body.released ? 240 : 310;
  const damping = body.released ? 21 : 25;
  for (const [position, velocity, target] of [['x', 'vx', 'targetX'], ['y', 'vy', 'targetY']]) {
    body[velocity] += ((body[target] - body[position]) * stiffness - body[velocity] * damping) * dt;
    body[position] += body[velocity] * dt;
  }
  const lean = body.released ? 0 : Math.max(-22, Math.min(22, body.vx * .025));
  body.spin += ((lean - body.angle) * 180 - body.spin * 16) * dt;
  body.angle += body.spin * dt;
}

export function dragSettled(body, reduced = false) {
  return body.released && (reduced || (body.age > .12 &&
    Math.hypot(body.x - body.targetX, body.y - body.targetY) < .6 &&
    Math.hypot(body.vx, body.vy) < 5 && Math.abs(body.angle) < .5 && Math.abs(body.size-body.targetSize)<.2) || body.age > 1.2);
}
