import * as THREE from 'three';
import {DESIGN,camera,position,posePosition,project} from './geometry.js';
import {SPRITES} from './sprites.js';
import {topRunCount} from './presentation.js';

// One painted plane per ID; Figma and Three use the same image and projection.
export async function createBoard(canvas,labels) {
 const sizes=await fetch('./assets/sprite-sizes.json').then(r=>r.json());
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
 renderer.setPixelRatio(2);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),cam=camera(),owned=[],units=new Map(),floor=new THREE.Group();scene.add(floor);
 const own=r=>(owned.push(r),r),plane=own(new THREE.PlaneGeometry(1,1)),materials={};
 await Promise.all(Object.keys(SPRITES).map(async name=>{
  const texture=own(await new THREE.TextureLoader().loadAsync('./assets/'+name+'.png'));texture.colorSpace=THREE.SRGBColorSpace;
  materials[name]=own(new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
 }));
 const screenUp=new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion);
 const edgePath=new THREE.CurvePath(),edgePoints=[
  new THREE.Vector3(DESIGN.chipRadius*Math.sqrt(3)/2,0,DESIGN.chipRadius/2),
  new THREE.Vector3(0,0,DESIGN.chipRadius),
  new THREE.Vector3(-DESIGN.chipRadius*Math.sqrt(3)/2,0,DESIGN.chipRadius/2)
 ];
 edgePath.add(new THREE.LineCurve3(edgePoints[0],edgePoints[1]));edgePath.add(new THREE.LineCurve3(edgePoints[1],edgePoints[2]));
 const edgeGeometry=own(new THREE.TubeGeometry(edgePath,2,.006,4,false));
 const edgeMaterial=own(new THREE.MeshBasicMaterial({color:0xe8bcff,transparent:true,opacity:.7,depthTest:false,depthWrite:false}));
 function painted(name){
  const spec=SPRITES[name],width=spec.radius*Math.sqrt(3),height=width*(sizes[name]?.ratio??149/154);
  const group=new THREE.Group(),face=new THREE.Mesh(plane,materials[name]);
  face.quaternion.copy(cam.quaternion);face.scale.set(width,height,1);face.position.copy(screenUp).multiplyScalar((.5-spec.anchor)*height);group.add(face);
  if(name.startsWith('chip-'))group.add(new THREE.Mesh(edgeGeometry,edgeMaterial));
  return group;
 }
 function setup(state){
  floor.clear();for(const mesh of units.values())scene.remove(mesh);units.clear();
  for(const cell of state.cells){const p=position(cell),tile=painted('tile-cream');tile.position.set(p.x,.12,p.z);tile.children[0].renderOrder=p.z*100;floor.add(tile);
   if(state.blockers.some(c=>c.col===cell.col&&c.row===cell.row)){const blocker=painted('blocker');blocker.position.set(p.x,.13,p.z);blocker.children[0].renderOrder=p.z*100+1;floor.add(blocker);}}
 }
 function draw(state,sample,time,timeline){
  const alive=new Set(sample.units.map(p=>p.id));for(const [id,mesh] of units)if(!alive.has(id)){scene.remove(mesh);units.delete(id);}
  for(const p of sample.units){
   let mesh=units.get(p.id);if(!mesh){mesh=painted('chip-'+p.color);units.set(p.id,mesh);scene.add(mesh);}
   const at=posePosition(p,timeline.reduced);mesh.position.set(at.x,at.y+DESIGN.thickness,at.z);mesh.rotation.set(0,0,0);mesh.scale.setScalar(p.scale);
   const order=p.from?10000+(p.toIndex??0):1000+at.z*100+(p.index??0);
   mesh.children.forEach((child,i)=>{child.renderOrder=order+i*.1;});
   if(p.from){const from=position(p.from),to=position(p.to);mesh.rotateOnWorldAxis(new THREE.Vector3(to.z-from.z,0,from.x-to.x).normalize(),at.flip);}
   if(!timeline.reduced&&!p.from){const s=[...timeline.segments].reverse().find(s=>s.type==='unitMoved'&&s.unit.id===p.id&&time>=s.end);if(s&&time-s.end<.09)mesh.position.y+=Math.sin((time-s.end)/.09*Math.PI)*.018;}
  }
  labels.replaceChildren();for(const s of sample.stacks){const p=position(s.cell),q=project(p.x,DESIGN.floor+(s.units.at(-1).index+1)*DESIGN.thickness,p.z,cam);
   const el=document.createElement('span');el.className='count';el.textContent=topRunCount(s.units);el.dataset.cell=`r${s.cell.row}c${s.cell.col}`;el.style.left=q.x+'px';el.style.top=q.y+'px';labels.append(el);}
  renderer.render(scene,cam);
 }
 renderer.setSize(DESIGN.board.width,DESIGN.board.height,false);
 return {setup,draw,info:()=>({meshes:units.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,units:[...units].map(([id,m])=>({id,x:m.position.x,y:m.position.y,z:m.position.z}))}),
 dispose(){for(const r of owned)r.dispose();units.clear();scene.clear();renderer.dispose();labels.replaceChildren();}};
}
