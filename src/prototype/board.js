import * as THREE from 'three';
import { cellId } from '../game/hex.js';
import { COLORS, canPlaceMagnet } from './model.js';
import { sampleTransferTimeline } from './motion.js';
import { hexContour } from './ring.js';
import {createChipGeometry,createChipSeamGeometry,CHIP_HEIGHT,topColorCount} from './chip.js';

const UNIT_HEIGHT = CHIP_HEIGHT;
const FLOOR = .16;
const RADIUS = .64;
export function cellPosition(cell) {
  return { x: (cell.col - 3 + (cell.row % 2) * .5 - .25) * Math.sqrt(3) * RADIUS,
    z: (cell.row - 3) * 1.5 * RADIUS };
}

// Generated satin caps and thin solid bodies share one Three scene.
// Every model ID owns one group; the PNG's baked wall is excluded from top UVs.
export function createThreeBoard(canvas, textures) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 60);
  camera.position.set(0, 11, 7); camera.lookAt(0, .1, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x654777, 1.25));
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(-4, 8, 5); scene.add(light);
  const resources = new Set(Object.values(textures));
  const own = resource => { resources.add(resource); return resource; };
  const plane = own(new THREE.PlaneGeometry(1, 1));
  const chipGeometry = own(createChipGeometry()),seamGeometry=own(createChipSeamGeometry());
  const materials = Object.fromEntries(Object.entries(textures).map(([name, texture]) => [name,
    own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))]));
  const wallColors={violet:'#7439b4',blue:'#087cb9',coral:'#bd4948'};
  const chipMaterials = Object.fromEntries(Object.entries(COLORS).map(([color]) => {
    const cap = own(materials['chip-' + color].clone());
    cap.depthTest = cap.depthWrite = true;
    const wall = own(new THREE.MeshStandardMaterial({ color:wallColors[color],roughness:.65,metalness:0,toneMapped:false,
      transparent: true, depthTest: true, depthWrite: true }));
    return [color, [cap, wall]];
  }));
  const seamMaterials=Object.fromEntries(Object.entries(wallColors).map(([color,value])=>[color,own(new THREE.MeshBasicMaterial({color:new THREE.Color(value).multiplyScalar(.62),transparent:true,depthTest:true,depthWrite:true,toneMapped:false}))]));
  const tileWidth=Math.sqrt(3)*RADIUS*.995;
  const tileHeight = tileWidth * textures.tile.image.height / textures.tile.image.width;
  const screenUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const pickShape = new THREE.Shape();
  [[0, .5], [.5, .25], [.5, -.25], [0, -.5], [-.5, -.25], [-.5, .25]].forEach(([x, y], index) => {
    const px=x*tileWidth,py=(y+.5-234/512)*tileHeight;
    if (!index) pickShape.moveTo(px,py); else pickShape.lineTo(px,py);
  });
  pickShape.closePath();
  const pickGeometry = own(new THREE.ShapeGeometry(pickShape));
  const pickMaterial = own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  const blockerGeometry = own(new THREE.ShapeGeometry(hexContour(.50)));
  const blockerPositions = blockerGeometry.attributes.position;
  const blockerUV = blockerGeometry.attributes.uv;
  for (let index = 0; index < blockerPositions.count; index++) {
    blockerUV.setXY(index, (70 + blockerPositions.getX(index) / .50 * 59) / 140,
      1 - (65 - blockerPositions.getY(index) / .50 * 59) / 141);
  }
  blockerGeometry.rotateX(-Math.PI / 2);
  const validMaterial = own(materials.tile.clone()); validMaterial.color.set('#b7ffd3');
  const invalidMaterial = own(materials.tile.clone()); invalidMaterial.color.set('#ffaaa0');
  const tutorialMaterial = own(materials.tile.clone()); tutorialMaterial.color.set('#fff1a6');
  const boardRoot = new THREE.Group(), unitsRoot = new THREE.Group();
  scene.add(boardRoot, unitsRoot);
  const pickMeshes = [], cellMeshes = new Map(), unitMeshes = new Map();
  const labels=new Map(),labelTextures=new Map();
  const labelMaterial=count=>{
    if(labelTextures.has(count))return labelTextures.get(count);
    const c=document.createElement('canvas');c.width=128;c.height=128;
    const ctx=c.getContext('2d');ctx.font='1000 82px Nunito, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineJoin='round';ctx.lineWidth=9;ctx.strokeStyle='#281039';ctx.strokeText(count,64,66);ctx.fillStyle='white';ctx.fillText(count,64,66);
    const texture=own(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;
    const material=own(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));labelTextures.set(count,material);return material;
  };
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
      const tile = artwork('tile', tileWidth);
      tile.position.set(pos.x, FLOOR, pos.z);tile.position.addScaledVector(screenUp,(.5-234/512)*tileHeight);
      tile.renderOrder = Math.round(pos.z * 100);
      boardRoot.add(tile); cellMeshes.set(id, tile);
      if (blocked.has(id)) {
        const marker = new THREE.Mesh(blockerGeometry, materials.blocker);
        marker.position.set(pos.x, FLOOR, pos.z); marker.renderOrder = 500;
        boardRoot.add(marker);
      }
      const pick = new THREE.Mesh(pickGeometry, pickMaterial);
      pick.quaternion.copy(camera.quaternion);
      pick.position.set(pos.x, FLOOR, pos.z); pick.userData.cell = cell;
      boardRoot.add(pick); pickMeshes.push(pick);
    }
  }
  function unitMesh(unit) {
    if (unitMeshes.has(unit.id)) return unitMeshes.get(unit.id);
    const root = new THREE.Group();
    const body = new THREE.Mesh(chipGeometry, chipMaterials[unit.color]);
    body.renderOrder = 1000; body.userData.unitId = unit.id;
    body.position.y = -UNIT_HEIGHT / 2;
    root.add(body);
    const seam=new THREE.Mesh(seamGeometry,seamMaterials[unit.color]);seam.position.y=-UNIT_HEIGHT/2;seam.renderOrder=1000;root.add(seam);
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
        const fromY = FLOOR + (pose.fromIndex + .5) * UNIT_HEIGHT, toY = FLOOR + (pose.toIndex + .5) * UNIT_HEIGHT;
        mesh.position.set(THREE.MathUtils.lerp(from.x, to.x, ease), THREE.MathUtils.lerp(fromY, toY, ease), THREE.MathUtils.lerp(from.z, to.z, ease));
        if (!timeline.reduced) {
          mesh.position.y += Math.sin(p * Math.PI) * .54;
          axis.set(to.z - from.z, 0, from.x - to.x).normalize();
          mesh.setRotationFromAxisAngle(axis, -Math.PI * 2 * ease);
        }
      } else {
        const pos = cellPosition(pose.cell); mesh.position.set(pos.x, FLOOR + (pose.index + .5) * UNIT_HEIGHT, pos.z);
      }
      mesh.userData = { id: pose.id, color: pose.color, cell: pose.cell ?? null, index: pose.index ?? null,
        moving: Boolean(pose.from), from: pose.from, to: pose.to, progress: pose.progress, scale: pose.scale };
    }
    for (const [id, mesh] of unitMeshes) if (!alive.has(id)) { unitsRoot.remove(mesh); unitMeshes.delete(id); }
    // Sampled resting pieces only: source loses one on launch, destination gains on landing.
    const stacks=new Map(),clearing=new Set(timeline?.segments.filter(s=>s.type==='unitsCleared'&&time>=s.start&&time<s.end).flatMap(s=>s.units.map(u=>u.id))??[]);
    for(const p of poses)if(!p.from&&!clearing.has(p.id)){const id=cellId(p.cell);if(!stacks.has(id))stacks.set(id,[]);stacks.get(id).push(p);}
    for(const [id,units] of stacks){
      units.sort((a,b)=>a.index-b.index);const count=topColorCount(units),top=units.at(-1),pos=cellPosition(top.cell);
      let badge=labels.get(id);if(!badge){badge=new THREE.Sprite(labelMaterial(count));badge.scale.set(.48,.48,1);badge.renderOrder=20000;scene.add(badge);labels.set(id,badge);}
      badge.material=labelMaterial(count);badge.position.set(pos.x,FLOOR+(top.index+1)*UNIT_HEIGHT+.003,pos.z);badge.userData={cell:top.cell,count};
    }
    for(const [id,badge]of labels)if(!stacks.has(id)){scene.remove(badge);labels.delete(id);}
    for (const [id, tile] of cellMeshes) {
      tile.material = materials.tile;
      if (hover && cellId(hover) === id && selected && !paused) tile.material = canPlaceMagnet(state, hover) ? validMaterial : invalidMaterial;
      else if (hint && cellId(hint) === id && !paused) tile.material = tutorialMaterial;
    }
    const activeMagnet = sampled?.magnet ?? (!paused && hover && selected && canPlaceMagnet(state, hover) ? { cell: hover, color: selected } : null);
    magnet.visible = Boolean(activeMagnet);
    if (activeMagnet) {
      const pos = cellPosition(activeMagnet.cell);
      magnet.position.set(pos.x, FLOOR + .12, pos.z);
      magnet.material = materials['magnet-' + activeMagnet.color];
      magnet.renderOrder = 600;
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
      projected.set(pos.x, FLOOR, pos.z).project(camera);
      return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
    },
    snapshot() { return { engine: 'Three.js', revision: THREE.REVISION, artwork: 'generated-satin-chips', meshes: unitMeshes.size,
      counts:[...labels.values()].map(b=>b.userData),
      units: [...unitMeshes.values()].map(mesh => ({ ...mesh.userData, position: mesh.position.toArray(), height: UNIT_HEIGHT * mesh.scale.x })),
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, drawCalls: renderer.info.render.calls }; },
    dispose() {
      if (disposed) return;
      disposed = true; scene.clear(); unitMeshes.clear(); cellMeshes.clear(); labels.clear();labelTextures.clear();pickMeshes.length = 0;
      for (const resource of resources) resource.dispose();
      resources.clear(); renderer.dispose();
    },
  };
}
