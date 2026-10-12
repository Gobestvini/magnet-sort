import * as THREE from 'three';
import { cellId } from '../game/hex.js';
import { COLORS, canPlaceMagnet } from './model.js';
import { sampleTransferTimeline, collectionPacking, sampleHexFlip, sampleHexTransfer } from './motion.js';
import {createChipBodyGeometry,createInsetFaceGeometry,chipLayout,CHIP_HEIGHT,WELL_PIXELS,topColorCount} from './chip.js';
import { createMagnetGlow } from './magnet-glow.js';
import { createInfluenceEffects } from './influence-effects.js';
// Renderer-owned painter order; no dependency on untracked local modules.
const paintCell = cell => 1000 + 1000 * cell.row;
const paintUnit = pose => pose.from ? 18000 : paintCell(pose.cell) + 10 + 2 * pose.index;

const UNIT_HEIGHT = CHIP_HEIGHT;
const FLOOR = .16;
const RADIUS = .64;
export function cellPosition(cell) {
  return { x: (cell.col - 3 + (cell.row % 2) * .5 - .25) * Math.sqrt(3) * RADIUS,
    z: (cell.row - 3) * 1.5 * RADIUS };
}

// Complete pseudo-3D wafers and tiles share one camera projection.
// Every model ID owns one group, including transit and clearance.
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
  const chipFaceGeometry = own(createInsetFaceGeometry());
  const materials = Object.fromEntries(Object.entries(textures).map(([name, texture]) => [name,
    own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))]));
  const wallColors=Object.fromEntries(Object.entries(COLORS).map(([id, info]) => [id, new THREE.Color(info.hex).multiplyScalar(.65)]));
  const chipMaterials = Object.fromEntries(Object.entries(COLORS).map(([color]) => {
    const cap = own(materials['chip-' + color].clone());
    cap.depthTest = cap.depthWrite = false;
    const wall = own(new THREE.MeshBasicMaterial({ color:wallColors[color],toneMapped:false,
      side:THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false }));
    return [color, [cap, wall]];
  }));
  const diagnosticMaterials=new Map();
  const tileWidth=Math.sqrt(3)*RADIUS*.995;
  const tileHeight = tileWidth * textures.tile.image.height / textures.tile.image.width;
  const screenUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const layout=chipLayout(screenUp.y,tileWidth,tileHeight);
  const chipGeometry=own(createChipBodyGeometry(layout.width,layout.height));
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const shadowContext=shadowCanvas.getContext('2d');
  const gradient=shadowContext.createRadialGradient(64,64,8,64,64,64);
  gradient.addColorStop(0,'rgba(43,18,53,.38)');gradient.addColorStop(.65,'rgba(43,18,53,.22)');gradient.addColorStop(1,'rgba(43,18,53,0)');
  shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,128,128);
  const shadowTexture=own(new THREE.CanvasTexture(shadowCanvas));shadowTexture.colorSpace=THREE.SRGBColorSpace;
  const shadowMaterial=own(new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
  const pickShape = new THREE.Shape();
  [[0, .5], [.5, .25], [.5, -.25], [0, -.5], [-.5, -.25], [-.5, .25]].forEach(([x, y], index) => {
    const px=x*tileWidth,py=(y+234/512-.5)*tileHeight;
    if (!index) pickShape.moveTo(px,py); else pickShape.lineTo(px,py);
  });
  pickShape.closePath();
  const pickGeometry = own(new THREE.ShapeGeometry(pickShape));
  const pickMaterial = own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  const validMaterial = own(materials.tile.clone()); validMaterial.color.set('#b7ffd3');
  const invalidMaterial = own(materials.tile.clone()); invalidMaterial.color.set('#ffaaa0');
  const tutorialMaterial = own(materials.tile.clone()); tutorialMaterial.color.set('#fff1a6');
  const boardRoot = new THREE.Group(), unitsRoot = new THREE.Group();
  scene.add(boardRoot, unitsRoot);
  const pickMeshes = [], cellMeshes = new Map(), unitMeshes = new Map(), blockerMeshes = new Map();
  const labels=new Map(),labelTextures=new Map(),shadows=new Map();
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
  const flip=new THREE.Quaternion(), localAxis=new THREE.Vector3();
  const cameraNormal=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
  const cameraInverse=camera.quaternion.clone().invert();
  function artwork(name, width) {
    const mesh = new THREE.Mesh(plane, materials[name]);
    mesh.quaternion.copy(camera.quaternion);
    mesh.scale.set(width, width * textures[name].image.height / textures[name].image.width, 1);
    return mesh;
  }
  const magnet = artwork('magnet-violet', .64);
  magnet.visible = false; scene.add(magnet);
  const activeBaseMaterial=own(materials.tile.clone());
  const magneticMaterials=Object.fromEntries(Object.keys(COLORS).map(c=>[c,own(materials['tile-magnetic-'+c].clone())]));
  const magneticTile=artwork('tile-magnetic-violet',tileWidth);magneticTile.scale.y=tileHeight;magneticTile.visible=false;scene.add(magneticTile);
  const edgeGeometry=own(new THREE.BufferGeometry());
  const edgeMaterial=own(new THREE.LineBasicMaterial({color:'#fff7da',transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
  const energyEdge=new THREE.Line(edgeGeometry,edgeMaterial);energyEdge.quaternion.copy(camera.quaternion);energyEdge.visible=false;scene.add(energyEdge);
  const glow = createMagnetGlow(scene, camera, plane, own);
  const magnetAnchor = cell => {
    const pos = cellPosition(cell);
    return new THREE.Vector3(pos.x + layout.offsetX, FLOOR, pos.z).addScaledVector(screenUp, -.035);
  };
  const influenceEffects=createInfluenceEffects(scene,camera,plane,own,magnetAnchor,cell=>cellMeshes.get(cellId(cell))?.renderOrder??100);
  function buildLevel(level) {
    if (currentLevel === level) return;
    currentLevel = level; influenceEffects.reset();
    unitsRoot.clear(); unitMeshes.clear();
    boardRoot.clear(); pickMeshes.length = 0; cellMeshes.clear();blockerMeshes.clear();
    const blocked = new Set(level.blockers.map(cellId));
    for (const cell of level.cells) {
      const pos = cellPosition(cell), id = cellId(cell);
      const tile = artwork(blocked.has(id)?'tile-blocked':'tile', tileWidth);
      tile.scale.y=tileHeight;
      tile.position.set(pos.x, FLOOR, pos.z);tile.position.addScaledVector(screenUp,(234/512-.5)*tileHeight);
      tile.renderOrder = paintCell(cell);
      boardRoot.add(tile); cellMeshes.set(id, tile);
      tile.userData={cell,blocked:blocked.has(id)};
      if(blocked.has(id)){tile.material=materials['tile-blocked'];blockerMeshes.set(id,tile);}
      const pick = new THREE.Mesh(pickGeometry, pickMaterial);
      pick.quaternion.copy(camera.quaternion);
      pick.position.set(pos.x, FLOOR, pos.z); pick.userData.cell = cell;
      boardRoot.add(pick); pickMeshes.push(pick);
    }
  }
  function unitMesh(unit) {
    if (unitMeshes.has(unit.id)) return unitMeshes.get(unit.id);
    const root = new THREE.Group();
    const backing=new THREE.Mesh(chipGeometry,chipMaterials[unit.color][1]);
    backing.position.set(layout.offsetX,layout.offset,0);root.add(backing);
    const face=new THREE.Mesh(chipFaceGeometry,chipMaterials[unit.color][0]);
    face.scale.set(layout.width,layout.height,1);face.position.set(layout.offsetX,layout.offset,0);root.add(face);
    unitsRoot.add(root); unitMeshes.set(unit.id, root);
    return root;
  }
  function draw(level, state, { timeline = null, time = 0, hover = null, selected = null, paused = false, hint = null, hideMagnet = false, dragging = false, reduced = false, influence = null } = {}) {
    if (disposed) return;
    buildLevel(level);
    const sampled = timeline ? sampleTransferTimeline(timeline, time) : null;
    const poses = sampled ? sampled.units.filter(unit => !unit.collecting) : state.stacks.flatMap(stack => stack.units.map((unit, index) => ({ ...unit, cell: stack.cell, index, scale: 1 })));
    const alive = new Set();
    for (const pose of poses) {
      const mesh = unitMesh(pose); alive.add(pose.id);
      const packing = collectionPacking(pose.pack);
      mesh.quaternion.copy(camera.quaternion); mesh.scale.setScalar(pose.scale * packing.scale);
      const face=mesh.children[1], backing=mesh.children[0];
      face.quaternion.identity();
      face.position.set(layout.offsetX,layout.offset,0);
      backing.position.copy(face.position);
      if (pose.from) {
        const from = cellPosition(pose.from), to = cellPosition(pose.to);
        const motion=(timeline.before.rulesVersion===4?sampleHexTransfer:sampleHexFlip)(pose.progress,timeline.reduced), ease=motion.travel;
        const fromY = FLOOR + (pose.fromIndex + .5) * UNIT_HEIGHT, toY = FLOOR + (pose.toIndex + .5) * UNIT_HEIGHT;
        mesh.position.set(THREE.MathUtils.lerp(from.x, to.x, ease), THREE.MathUtils.lerp(fromY, toY, ease), THREE.MathUtils.lerp(from.z, to.z, ease));
        if (!timeline.reduced) {
          mesh.position.y += motion.lift;
          axis.set(to.x-from.x,0,to.z-from.z).cross(cameraNormal).normalize();
          localAxis.copy(axis).applyQuaternion(cameraInverse);
          flip.setFromAxisAngle(axis, motion.angle);
          mesh.quaternion.premultiply(flip);
          // Keep the pivot at the artwork centre. Both sides use the same
          // authored face; change sides while edge-on, never at touchdown.
          face.position.applyAxisAngle(localAxis,-motion.angle);
          backing.position.copy(face.position);
          if(motion.reverseFace) face.quaternion.setFromAxisAngle(localAxis,Math.PI);
        }
      } else {
        const pos = cellPosition(pose.cell); mesh.position.set(pos.x, FLOOR + (.5 + (pose.layer ?? pose.index)) * UNIT_HEIGHT, pos.z);
        // Shrink about the ground contact, keeping the compact packet in its well.
        mesh.position.x += layout.offsetX * (1 - packing.scale);
        mesh.position.addScaledVector(screenUp, layout.offset * (1 - packing.scale));
      }
      // Keep ground plaques at their natural depth; raise only airborne units.
      const order=paintUnit(pose);
      mesh.children[0].renderOrder=order;mesh.children[1].renderOrder=order+1;
      mesh.children[0].visible=Boolean(pose.from);
      mesh.userData = { id: pose.id, color: pose.color, cell: pose.cell ?? null, index: pose.index ?? null,
        moving: Boolean(pose.from), from: pose.from, to: pose.to, progress: pose.progress, scale: pose.scale,
        flipAngle:pose.from ? (timeline.before.rulesVersion===4?sampleHexTransfer:sampleHexFlip)(pose.progress,timeline.reduced).angle : 0,
        pack: pose.pack ?? 0, layer: pose.layer ?? pose.index, anchorOffsetY: screenUp.y * layout.offset * (1 - packing.scale) };
    }
    for (const [id, mesh] of unitMeshes) if (!alive.has(id)) { unitsRoot.remove(mesh); unitMeshes.delete(id); }
    // Sampled resting pieces only: source loses one on launch, destination gains on landing.
    const stacks=new Map();
    for(const p of poses)if(!p.from){const id=cellId(p.cell);if(!stacks.has(id))stacks.set(id,[]);stacks.get(id).push(p);}
    for(const [id,units] of stacks){
      units.sort((a,b)=>a.index-b.index);const count=topColorCount(units),top=units.at(-1),pos=cellPosition(top.cell);
      let badge=labels.get(id);if(!badge){badge=new THREE.Sprite(labelMaterial(count));badge.scale.set(.48,.48,1);scene.add(badge);labels.set(id,badge);}
      const clearBadge=sampled?.clearBadges?.find(b=>cellId(b.cell)===id);
      const displayCount=clearBadge?.count??count;
      badge.visible=Boolean(clearBadge)||(!units.some(unit=>unit.pack>0)&&!sampled?.hiddenCells?.includes(`${top.cell.row}:${top.cell.col}`));
      badge.renderOrder=paintUnit(top)+2;badge.material=labelMaterial(displayCount);badge.position.set(pos.x+layout.offsetX,FLOOR+(.5+(top.layer??top.index))*UNIT_HEIGHT,pos.z);
      badge.position.addScaledVector(screenUp,layout.offset+.028);badge.userData={cell:top.cell,count:displayCount,visible:badge.visible};
      let shadow=shadows.get(id);if(!shadow){shadow=new THREE.Mesh(plane,shadowMaterial);shadow.quaternion.copy(camera.quaternion);shadow.scale.set(.99,.8,1);scene.add(shadow);shadows.set(id,shadow);}
      shadow.renderOrder=paintCell(top.cell)+1;shadow.position.set(pos.x+layout.offsetX,FLOOR,pos.z);shadow.position.addScaledVector(screenUp,-.065);
    }
    for(const [id,badge]of labels)if(!stacks.has(id)){scene.remove(badge);labels.delete(id);}
    for(const [id,shadow]of shadows)if(!stacks.has(id)){scene.remove(shadow);shadows.delete(id);}
    for (const [id, tile] of cellMeshes) {
      tile.material = tile.userData.blocked ? materials['tile-blocked'] : materials.tile;
      if (!tile.userData.blocked && hover && cellId(hover) === id && selected && !paused && !timeline) tile.material = canPlaceMagnet(state, hover) ? validMaterial : invalidMaterial;
      else if (hint && cellId(hint) === id && !paused) tile.material = tutorialMaterial;
    }
    magneticTile.visible=Boolean(sampled?.magnet&&sampled.magneticStrength>0);
    energyEdge.visible=magneticTile.visible&&!reduced;
    if(magneticTile.visible){
      const tile=cellMeshes.get(cellId(sampled.magnet.cell)),strength=sampled.magneticStrength;
      activeBaseMaterial.opacity=1-strength;tile.material=activeBaseMaterial;
      magneticTile.material=magneticMaterials[sampled.magnet.color];magneticTile.material.opacity=strength;
      magneticTile.position.copy(tile.position);magneticTile.renderOrder=tile.renderOrder+1;
      magneticTile.userData={cell:sampled.magnet.cell,color:sampled.magnet.color,phase:sampled.magneticPhase};
      const phase=(time*2)%6,index=Math.floor(phase),fraction=phase-index;
      const contour=WELL_PIXELS.map(([x,y])=>new THREE.Vector3((x/471-.5)*tileWidth,(.5-y/512)*tileHeight,0));
      const a=contour[index],b=contour[(index+1)%6];
      const start=a.clone().lerp(b,Math.max(0,fraction-.35)),end=a.clone().lerp(b,Math.min(1,fraction+.35));
      const attr=edgeGeometry.attributes.position;
      if(!attr)edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([...start.toArray(),...end.toArray()],3));
      else{attr.setXYZ(0,start.x,start.y,0);attr.setXYZ(1,end.x,end.y,0);attr.needsUpdate=true;}
      energyEdge.position.copy(tile.position);energyEdge.renderOrder=tile.renderOrder+2;edgeMaterial.opacity=strength;
    }
    const activeMagnet = !sampled && !paused && hover && selected && canPlaceMagnet(state, hover) ? { cell: hover, color: selected } : null;
    magnet.visible = Boolean(activeMagnet) && !hideMagnet;
    glow.draw(null, '#ffffff', time, reduced);
    influenceEffects.draw(influence,timeline,time,timeline?.reduced??reduced,paused);
    if (activeMagnet) {
      magnet.position.copy(magnetAnchor(activeMagnet.cell));
      magnet.material = materials['magnet-' + activeMagnet.color];
      magnet.renderOrder = paintCell(activeMagnet.cell)+6;
    }
    scene.updateMatrixWorld(true); renderer.render(scene, camera);
    return sampled;
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
  function placementProof() {
    const projectPoint=(mesh,x,y)=>new THREE.Vector3(x,y,0).applyMatrix4(mesh.matrixWorld).project(camera).toArray().slice(0,2);
    const proof=(cell,face,quaternion,kind,scale=1)=>{
      const tile=cellMeshes.get(cellId(cell)),points=face.geometry.attributes.position;
      return {cell,kind,scale,
        footprint:Array.from({length:6},(_,i)=>projectPoint(face,points.getX(i+1),points.getY(i+1))),
        well:WELL_PIXELS.map(([x,y])=>projectPoint(tile,x/471-.5,.5-y/512)),
        facing:new THREE.Vector3(0,0,1).applyQuaternion(quaternion).dot(new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion))};
    };
    return [...unitMeshes.values()].filter(mesh=>!mesh.userData.moving&&mesh.userData.index===0)
      .map(mesh=>proof(mesh.userData.cell,mesh.children[1],mesh.quaternion,'chip',mesh.scale.x))
;
  }
  return {
    draw, resize,
    ...(import.meta.env.DEV ? { inspectBackingLighting(legacy) {
      for(const [id,mesh] of unitMeshes){
        const color=mesh.userData.color;
        if(legacy){
          if(!diagnosticMaterials.has(color))diagnosticMaterials.set(color,own(new THREE.MeshStandardMaterial({color:wallColors[color],roughness:.65,metalness:0,toneMapped:false,transparent:true,depthTest:false,depthWrite:false})));
          mesh.children[0].material=diagnosticMaterials.get(color);
        }else mesh.children[0].material=chipMaterials[color][1];
      }
      renderer.render(scene,camera);
    }} : {}),
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
    magnetScreenSize() { return magnet.scale.x / (camera.right - camera.left) * canvas.getBoundingClientRect().width; },
    chipScreenPosition(cell, index, pack = 0) {
      const pos = cellPosition(cell), rect = canvas.getBoundingClientRect();
      const packing = collectionPacking(pack);
      projected.set(pos.x + layout.offsetX, FLOOR + (.5 + index * packing.pitch) * UNIT_HEIGHT, pos.z);
      projected.addScaledVector(screenUp, layout.offset).project(camera);
      return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2,
        width: layout.width * packing.scale / (camera.right - camera.left) * rect.width,
        height: layout.height * packing.scale / (camera.top - camera.bottom) * rect.height };
    },
    magnetScreenPosition(cell) {
      const rect = canvas.getBoundingClientRect(); projected.copy(magnetAnchor(cell)).project(camera);
      return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
    },
    snapshot() { return { engine: 'Three.js', revision: THREE.REVISION, artwork: 'authored-pseudo3d-wafers', meshes: unitMeshes.size,
      glow: glow.snapshot(), influence:influenceEffects.snapshot(),
      magneticCell: magneticTile.visible ? {...magneticTile.userData,strength:magneticTile.material.opacity} : null,
      counts:[...labels.values()].map(b=>({...b.userData,renderOrder:b.renderOrder})),
      tiles:[...cellMeshes].map(([id,tile])=>({id,renderOrder:tile.renderOrder})),
      placement:placementProof(),
      units: [...unitMeshes.values()].map(mesh => ({ ...mesh.userData, position: mesh.position.toArray(), height: UNIT_HEIGHT * mesh.scale.x, renderOrder:mesh.children[1].renderOrder })),
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, drawCalls: renderer.info.render.calls }; },
    dispose() {
      if (disposed) return;
      disposed = true; scene.clear(); unitMeshes.clear(); cellMeshes.clear(); blockerMeshes.clear();labels.clear();shadows.clear();labelTextures.clear();pickMeshes.length = 0;
      for (const resource of resources) resource.dispose();
      resources.clear(); renderer.dispose();
    },
  };
}
