import * as THREE from 'three';

// A small retained pool: no texture/material allocation during dragging.
export function createMagnetGlow(scene, camera, plane, own) {
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (kind === 'beam') {
      for (let y = 0; y < 256; y++) {
        const p = y / 256, width = 22 + p * 38;
        const gradient = ctx.createLinearGradient(64 - width, 0, 64 + width, 0);
        gradient.addColorStop(0, '#ffffff00'); gradient.addColorStop(.5, `rgba(255,255,255,${Math.pow(Math.sin(p * Math.PI), .65) * .65})`); gradient.addColorStop(1, '#ffffff00');
        ctx.fillStyle = gradient; ctx.fillRect(64 - width, y, width * 2, 1);
      }
    } else if (kind === 'wave') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(64, 128, 51, 102, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      const gradient = ctx.createRadialGradient(64, 128, 0, 64, 128, 62);
      gradient.addColorStop(0, '#fff'); gradient.addColorStop(.25, '#ffffffcf'); gradient.addColorStop(1, '#ffffff00');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 256);
      if (kind === 'spark') {
        ctx.fillStyle = '#fff'; ctx.beginPath();
        ctx.moveTo(64, 92); ctx.lineTo(70, 121); ctx.lineTo(94, 128); ctx.lineTo(70, 135);
        ctx.lineTo(64, 164); ctx.lineTo(58, 135); ctx.lineTo(34, 128); ctx.lineTo(58, 121); ctx.closePath(); ctx.fill();
      }
    }
    const result = own(new THREE.CanvasTexture(canvas)); result.colorSpace = THREE.SRGBColorSpace; return result;
  }
  const maps = { beam: texture('beam'), halo: texture('halo'), spark: texture('spark'), wave: texture('wave') };
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  function mesh(map, order) {
    const material = own(new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    const result = new THREE.Mesh(plane, material); result.quaternion.copy(camera.quaternion); result.renderOrder = order; group.add(result); return result;
  }
  const halo = mesh(maps.halo, 540), beam = mesh(maps.beam, 541);
  const sparks = Array.from({ length: 9 }, () => mesh(maps.spark, 542));
  const waves = Array.from({ length: 3 }, () => mesh(maps.wave, 543));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const white = new THREE.Color('#ffffff');
  let activeCell = null;
  let working = false;
  return {
    draw(position, color, time, reduced, cell = null, pulling = false) {
      working = Boolean(position && pulling);
      activeCell = position ? cell : null; group.visible = Boolean(position);
      if (!position) return;
      group.position.copy(position);
      const pulse = reduced ? 1 : 1 + Math.sin(time * 4) * .05;
      halo.scale.set(.98 * pulse, .95 * pulse, 1); halo.material.color.set(color).lerp(white, .3); halo.material.opacity = pulling ? .45 : .7;
      beam.visible = !reduced && !pulling; beam.scale.set(.95, 2, 1); beam.position.copy(up).multiplyScalar(.9);
      beam.material.color.set(color).lerp(white, .45); beam.material.opacity = .85;
      sparks.forEach((spark, i) => {
        spark.visible = !reduced;
        if (reduced) return;
        const p = (time * .55 + i / sparks.length) % 1;
        spark.position.copy(up).multiplyScalar(.04 + p * 1.85);
        spark.position.x += Math.sin(i * 2.4 + p * 2) * (.42 - p * .16);
        if (pulling) {
          const angle = i * 2.4 + time * 3.5, radius = (1 - p) * .85 + .18;
          spark.position.copy(right).multiplyScalar(Math.cos(angle) * radius);
          spark.position.addScaledVector(up, Math.sin(angle) * radius * .65 + .12);
        }
        const size = .12 + .03 * Math.sin(i * 3);
        spark.scale.set(size, size * 2, 1);
        spark.material.color.set(color).lerp(white, i % 3 ? .55 : 1); spark.material.opacity = Math.sin(p * Math.PI) * .9;
      });
      waves.forEach((wave, i) => {
        wave.visible = pulling && !reduced;
        if (!wave.visible) return;
        const p = (time * 1.5 + i / waves.length) % 1;
        const size = 1.9 - p * 1.35;
        wave.scale.set(size, size * .72, 1);
        wave.material.color.set(color).lerp(white, .5);
        wave.material.opacity = Math.sin(p * Math.PI) * .6;
      });
    },
    snapshot: () => ({ cell: activeCell, visible: group.visible, working, waves: group.visible ? waves.filter(wave => wave.visible).length : 0, particles: group.visible ? sparks.filter(spark => spark.visible).length : 0 }),
  };
}
