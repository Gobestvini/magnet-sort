import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cellId } from '../game/hex.js';
import { COLORS, canPlaceMagnet } from './model.js';
import { sampleTransferTimeline } from './motion.js';

const UNIT_HEIGHT = .14;
const FLOOR = .21;
const RADIUS = .64;
export function cellPosition(cell) {
  return { x: (cell.col - 3 + (cell.row % 2) * .5 - .25) * Math.sqrt(3) * RADIUS,
    z: (cell.row - 3) * 1.5 * RADIUS };
}

function hexShape(radius, hole = false) {
  const shape = new THREE.Shape();
  const points = Array.from({ length: 6 }, (_, i) => ({ x: Math.sin(i * Math.PI / 3) * radius, y: Math.cos(i * Math.PI / 3) * radius }));
  for (let i = 0; i < 6; i++) {
    const previous = points[(i + 5) % 6], current = points[i], next = points[(i + 1) % 6];
    const start = { x: current.x * .87 + previous.x * .13, y: current.y * .87 + previous.y * .13 };
    const end = { x: current.x * .87 + next.x * .13, y: current.y * .87 + next.y * .13 };
    if (!i) shape.moveTo(start.x, start.y); else shape.lineTo(start.x, start.y);
    shape.quadraticCurveTo(current.x, current.y, end.x, end.y);
  }
  shape.closePath();
  if (hole) {
    const path = new THREE.Path();
    const inner = typeof hole === 'number' ? hole : .17;
    for (let i = 6; i >= 0; i--) {
      const angle = i * Math.PI / 3;
      const x = Math.sin(angle) * inner, y = Math.cos(angle) * inner;
      if (i === 6) path.moveTo(x, y); else path.lineTo(x, y);
    }
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

export function createThreeBoard(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 60);
  camera.position.set(0, 13, 9);
  camera.lookAt(0, .1, 0);
  scene.add(new THREE.HemisphereLight(0xf3f4ff, 0x78829e, 1.3));
  const sun = new THREE.DirectionalLight(0xfff5e6, 2.2);
  sun.position.set(-5, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 25 });
  sun.shadow.bias = -.0005;
  sun.shadow.normalBias = .025;
  sun.shadow.radius = 3;
  scene.add(sun);
  const resources = new Set();
  const own = resource => { resources.add(resource); return resource; };
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = own(pmrem.fromScene(room, .04));
  scene.environment = environment.texture;
  scene.environmentIntensity = .4;
  room.dispose(); pmrem.dispose();
  const material = (color, options = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: .42, metalness: .05, ...options }));
  const extrude = (shape, depth, bevel = .025) => {
    const geometry = own(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
      bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 4 }));
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  };
  const cellGeometry = extrude(hexShape(RADIUS * .94), .14, .04);
  const lipGeometry = extrude(hexShape(RADIUS * .94, RADIUS * .83), .05, .018);
  const unitGeometry = extrude(hexShape(RADIUS * .75, true), .075, .035);
  const white = material('#fffaf0');
  const cellMaterial = material('#f5dfbd', { roughness: .35 });
  const lipMaterial = material('#fff5df', { roughness: .25 });
  const blockedMaterial = material('#514b6c');
  const validMaterial = material('#d8fff2', { emissive: '#59ccad', emissiveIntensity: .2 });
  const invalidMaterial = material('#ffd2ce');
  const tokenMaterials = Object.fromEntries(Object.entries(COLORS).map(([key, info]) => [key, material(info.hex, { roughness: .19, metalness: .12 })]));
  const blockerBar = own(new THREE.BoxGeometry(.115, .012, .035));
  const boardRoot = new THREE.Group();
  const unitsRoot = new THREE.Group();
  scene.add(boardRoot, unitsRoot);
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(200, 200)), own(new THREE.ShadowMaterial({ opacity: .18 })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -.11;
  shadow.receiveShadow = true;
  scene.add(shadow);
  const pickMeshes = [], cellMeshes = new Map(), unitMeshes = new Map();
  let currentLevel = null;
  let disposed = false;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const axis = new THREE.Vector3(), projected = new THREE.Vector3();

  const magnet = new THREE.Group();
  const u = new THREE.Shape();
  u.moveTo(-.26, .28); u.lineTo(-.26, -.03); u.absarc(0, -.03, .26, Math.PI, Math.PI * 2, false);
  u.lineTo(.26, .28); u.lineTo(.11, .28); u.lineTo(.11, -.03);
  u.absarc(0, -.03, .11, 0, -Math.PI, true); u.lineTo(-.11, .28); u.closePath();
  const magnetBody = new THREE.Mesh(extrude(u, .12, .015), tokenMaterials.violet);
  magnetBody.castShadow = true;
  magnet.add(magnetBody);
  const tipGeometry = own(new THREE.BoxGeometry(.16, .15, .12));
  for (const x of [-.185, .185]) {
    const tip = new THREE.Mesh(tipGeometry, white); tip.position.set(x, .065, -.235); magnet.add(tip);
  }
  const halo = new THREE.Mesh(own(new THREE.TorusGeometry(.48, .022, 8, 48)), material('#faf7ff', { emissive: '#9463ed', emissiveIntensity: .7 }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -.02;
  magnet.add(halo);
  magnet.visible = false;
  scene.add(magnet);

  function buildLevel(level) {
    if (currentLevel === level) return;
    currentLevel = level;
    unitsRoot.clear(); unitMeshes.clear();
    boardRoot.clear(); pickMeshes.length = 0; cellMeshes.clear();
    const blocked = new Set(level.blockers.map(cellId));
    for (const cell of level.cells) {
      const pos = cellPosition(cell), id = cellId(cell);
      const lip = new THREE.Mesh(lipGeometry, lipMaterial);
      lip.position.set(pos.x, .13, pos.z); lip.receiveShadow = true; boardRoot.add(lip);
      const tile = new THREE.Mesh(cellGeometry, blocked.has(id) ? blockedMaterial : cellMaterial);
      tile.position.set(pos.x, 0, pos.z);
      tile.receiveShadow = true; tile.castShadow = true; tile.userData.cell = cell;
      boardRoot.add(tile); pickMeshes.push(tile); cellMeshes.set(id, tile);
      if (blocked.has(id)) {
        for (const rotation of [Math.PI / 4, -Math.PI / 4]) {
          const bar = new THREE.Mesh(blockerBar, white);
          bar.position.set(pos.x, .202, pos.z); bar.scale.set(3.5, 1, 1.5); bar.rotation.y = rotation;
          boardRoot.add(bar);
        }
      }
    }
  }

  function unitMesh(unit) {
    if (unitMeshes.has(unit.id)) return unitMeshes.get(unit.id);
    const root = new THREE.Group();
    const body = new THREE.Mesh(unitGeometry, tokenMaterials[unit.color]); body.castShadow = true; body.receiveShadow = true;
    root.add(body);
    unitsRoot.add(root); unitMeshes.set(unit.id, root);
    return root;
  }

  function draw(level, state, { timeline = null, time = 0, hover = null, selected = null, paused = false } = {}) {
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
    }
    for (const [id, mesh] of unitMeshes) if (!alive.has(id)) { unitsRoot.remove(mesh); unitMeshes.delete(id); }
    for (const [id, tile] of cellMeshes) {
      const isBlocked = level.blockers.some(cell => cellId(cell) === id);
      tile.material = isBlocked ? blockedMaterial : cellMaterial;
      if (hover && cellId(hover) === id && selected && !paused) tile.material = canPlaceMagnet(state, hover) ? validMaterial : invalidMaterial;
    }
    const activeMagnet = sampled?.magnet ?? (!paused && hover && selected && canPlaceMagnet(state, hover) ? { cell: hover, color: selected } : null);
    magnet.visible = Boolean(activeMagnet);
    if (activeMagnet) {
      const pos = cellPosition(activeMagnet.cell);
      magnet.position.set(pos.x, FLOOR + .1, pos.z);
      magnetBody.material = tokenMaterials[activeMagnet.color];
    }
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
  }

  function resize(width, height) {
    if (disposed || width <= 0 || height <= 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = Math.max(2.8, 3.15 / aspect);
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
    snapshot() { return { engine: 'Three.js', revision: THREE.REVISION, meshes: unitMeshes.size,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, drawCalls: renderer.info.render.calls }; },
    dispose() {
      if (disposed) return;
      disposed = true; scene.clear(); unitMeshes.clear(); cellMeshes.clear(); pickMeshes.length = 0;
      sun.shadow.dispose();
      for (const resource of resources) resource.dispose();
      resources.clear(); renderer.dispose();
    },
  };
}
