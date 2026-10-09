import * as THREE from 'three';
import { cellId } from '../game/hex.js';
import { canPlaceMagnet } from './model.js';
import { sampleTransferTimeline } from './motion.js';

const UNIT_HEIGHT = .17;
const FLOOR = .16;
const RADIUS = .64;
export function cellPosition(cell) {
  return { x: (cell.col - 3 + (cell.row % 2) * .5 - .25) * Math.sqrt(3) * RADIUS,
    z: (cell.row - 3) * 1.75 * RADIUS };
}

// Authored raster layers in a Three scene. Each ring is still an independently
// positioned object: the model, neighbor routes and transfer timing are unchanged.
export function createThreeBoard(canvas, textures) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 60);
  camera.position.set(0, 13, 9); camera.lookAt(0, .1, 0);
  const resources = new Set(Object.values(textures));
  const own = resource => { resources.add(resource); return resource; };
  const plane = own(new THREE.PlaneGeometry(1, 1));
  const materials = Object.fromEntries(Object.entries(textures).map(([name, texture]) => [name,
    own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))]));
  const pickShape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const x = Math.sin(i * Math.PI / 3) * RADIUS * .92, y = Math.cos(i * Math.PI / 3) * RADIUS * .92;
    if (!i) pickShape.moveTo(x, y); else pickShape.lineTo(x, y);
  }
  pickShape.closePath();
  const pickGeometry = own(new THREE.ShapeGeometry(pickShape));
  pickGeometry.rotateX(-Math.PI / 2);
  const pickMaterial = own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  const validMaterial = own(materials.tile.clone()); validMaterial.color.set('#b7ffd3');
  const invalidMaterial = own(materials.tile.clone()); invalidMaterial.color.set('#ffaaa0');
  const tutorialMaterial = own(materials.tile.clone()); tutorialMaterial.color.set('#fff1a6');
  const boardRoot = new THREE.Group(), unitsRoot = new THREE.Group();
  scene.add(boardRoot, unitsRoot);
  const pickMeshes = [], cellMeshes = new Map(), unitMeshes = new Map();
  let currentLevel = null, disposed = false;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const axis = new THREE.Vector3(), projected = new THREE.Vector3();
  function artwork(name, width) {
    const mesh = new THREE.Mesh(plane, materials[name]);
    mesh.quaternion.copy(camera.quaternion);
    mesh.scale.set(width, width * textures[name].image.height / textures[name].image.width, 1);
    return mesh;
  }
  const magnet = artwork('magnet-violet', .84);
  magnet.visible = false; scene.add(magnet);
  function buildLevel(level) {
    if (currentLevel === level) return;
    currentLevel = level;
    unitsRoot.clear(); unitMeshes.clear();
    boardRoot.clear(); pickMeshes.length = 0; cellMeshes.clear();
    const blocked = new Set(level.blockers.map(cellId));
    for (const cell of level.cells) {
      const pos = cellPosition(cell), id = cellId(cell);
      const tile = artwork(blocked.has(id) ? 'blocker' : 'tile', 1.18);
      tile.position.set(pos.x, 0, pos.z);
      tile.renderOrder = Math.round(pos.z * 100);
      boardRoot.add(tile); cellMeshes.set(id, tile);
      const pick = new THREE.Mesh(pickGeometry, pickMaterial);
      pick.position.set(pos.x, .15, pos.z); pick.userData.cell = cell;
      boardRoot.add(pick); pickMeshes.push(pick);
    }
  }
  function unitMesh(unit) {
    if (unitMeshes.has(unit.id)) return unitMeshes.get(unit.id);
    const root = new THREE.Group();
    root.add(artwork('ring-' + unit.color, .94));
    unitsRoot.add(root); unitMeshes.set(unit.id, root);
    return root;
  }
  function draw(level, state, { timeline = null, time = 0, hover = null, selected = null, paused = false, hint = null } = {}) {
    if (disposed) return;
    buildLevel(level);
    const sampled = timeline ? sampleTransferTimeline(timeline, time) : null;
    const poses = sampled?.units ?? state.stacks.flatMap(stack => stack.units.map((unit, index) => ({ ...unit, cell: stack.cell, index, scale: 1 })));
    const alive = new Set();
    for (const pose of poses) {
      const mesh = unitMesh(pose); alive.add(pose.id);
      mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(pose.scale);
      if (pose.from) {
        const from = cellPosition(pose.from), to = cellPosition(pose.to);
        const p = pose.progress, ease = p * p * (3 - 2 * p);
        const fromY = FLOOR + pose.fromIndex * UNIT_HEIGHT, toY = FLOOR + pose.toIndex * UNIT_HEIGHT;
        mesh.position.set(THREE.MathUtils.lerp(from.x, to.x, ease), THREE.MathUtils.lerp(fromY, toY, ease), THREE.MathUtils.lerp(from.z, to.z, ease));
        if (!timeline.reduced) {
          mesh.position.y += Math.sin(p * Math.PI) * .54;
          axis.set(to.z - from.z, 0, from.x - to.x).normalize();
          mesh.setRotationFromAxisAngle(axis, -Math.PI * 2 * ease);
        }
      } else {
        const pos = cellPosition(pose.cell); mesh.position.set(pos.x, FLOOR + pose.index * UNIT_HEIGHT, pos.z);
      }
      // Front rows occlude rear rows; a moving piece clears the static board.
      mesh.children[0].renderOrder = pose.from ? 2000 : Math.round(mesh.position.z * 100) + 40 + pose.index;
    }
    for (const [id, mesh] of unitMeshes) if (!alive.has(id)) { unitsRoot.remove(mesh); unitMeshes.delete(id); }
    for (const [id, tile] of cellMeshes) {
      const isBlocked = level.blockers.some(cell => cellId(cell) === id);
      tile.material = isBlocked ? materials.blocker : materials.tile;
      if (hover && cellId(hover) === id && selected && !paused) tile.material = canPlaceMagnet(state, hover) ? validMaterial : invalidMaterial;
      else if (hint && cellId(hint) === id && !paused) tile.material = tutorialMaterial;
    }
    const activeMagnet = sampled?.magnet ?? (!paused && hover && selected && canPlaceMagnet(state, hover) ? { cell: hover, color: selected } : null);
    magnet.visible = Boolean(activeMagnet);
    if (activeMagnet) {
      const pos = cellPosition(activeMagnet.cell);
      magnet.position.set(pos.x, FLOOR + .12, pos.z);
      magnet.material = materials['magnet-' + activeMagnet.color];
      magnet.renderOrder = Math.round(pos.z * 100) + 35;
    }
    scene.updateMatrixWorld(true); renderer.render(scene, camera);
  }
  function resize(width, height) {
    if (disposed || width <= 0 || height <= 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    const aspect = width / height, halfHeight = Math.max(2.8, 3.15 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  return {
    draw, resize,
    pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(pickMeshes, false)[0]?.object.userData.cell ?? null;
    },
    screenPosition(cell) {
      const pos = cellPosition(cell), rect = canvas.getBoundingClientRect();
      projected.set(pos.x, .15, pos.z).project(camera);
      return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
    },
    snapshot() { return { engine: 'Three.js', revision: THREE.REVISION, artwork: 'mockup-raster', meshes: unitMeshes.size,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, drawCalls: renderer.info.render.calls }; },
    dispose() {
      if (disposed) return;
      disposed = true; scene.clear(); unitMeshes.clear(); cellMeshes.clear(); pickMeshes.length = 0;
      for (const resource of resources) resource.dispose();
      resources.clear(); renderer.dispose();
    },
  };
}
