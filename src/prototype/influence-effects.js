import * as THREE from 'three';
import { COLORS } from './model.js';
import { cellId } from '../game/hex.js';
import { sampleInfluenceArc } from './magnet-influence.js';
import { sampleBorderPulse } from './border-preview.js';

// Fixed retained pools; positions derive from the board's own anchors/camera.
export function createInfluenceEffects(scene,camera,plane,own,anchor,cellOrder,tile={width:1.1,height:1.1,offsetY:0}) {
  const group=new THREE.Group();scene.add(group);
  const make=(geometry)=>{
    const material=own(new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    const mesh=new THREE.Mesh(geometry,material);mesh.quaternion.copy(camera.quaternion);group.add(mesh);return mesh;
  };
  const shape=new THREE.Shape();
  for(let i=0;i<6;i++){const angle=Math.PI/2+i*Math.PI/3,x=Math.cos(angle)*.54,y=Math.sin(angle)*.51;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();
  const hole=new THREE.Path();for(let i=5;i>=0;i--){const angle=Math.PI/2+i*Math.PI/3,x=Math.cos(angle)*.49,y=Math.sin(angle)*.46;if(i===5)hole.moveTo(x,y);else hole.lineTo(x,y);}hole.closePath();shape.holes.push(hole);
  const contour=own(new THREE.ShapeGeometry(shape)),dot=own(new THREE.CircleGeometry(.025,8));
  const marks=Array.from({length:25},()=>make(contour));
  const particles=Array.from({length:48},()=>make(dot));
  const waves=Array.from({length:12},()=>make(plane));
  const rimShape=new THREE.Shape(),rimHole=new THREE.Path();
  const vertices=[[0,.5],[.5,.25],[.5,-.25],[0,-.5],[-.5,-.25],[-.5,.25]];
  vertices.forEach(([x,y],i)=>{const px=x*tile.width*.96,py=y*tile.height*.92+tile.offsetY;if(i)rimShape.lineTo(px,py);else rimShape.moveTo(px,py);});rimShape.closePath();
  [...vertices].reverse().forEach(([x,y],i)=>{const px=x*tile.width*.9,py=y*tile.height*.86+tile.offsetY;if(i)rimHole.lineTo(px,py);else rimHole.moveTo(px,py);});rimHole.closePath();rimShape.holes.push(rimHole);
  const rimGeometry=own(new THREE.ShapeGeometry(rimShape)),rims=Array.from({length:18},()=>make(rimGeometry));
  let previewKey=null,previewStart=0;
  const states=new Map(),tint=new THREE.Color(),white=new THREE.Color('#ffffff');let lastTime=null,stats={cells:[],particles:0,waves:0};
  function hide(mesh){mesh.visible=false;mesh.material.opacity=0;}
  return {
    draw(plan,timeline,time,reduced,paused){
      rims.forEach(hide);
      if(plan?.rings&&!timeline&&!paused){
        if(previewKey!==plan.key||time<previewStart){previewKey=plan.key;previewStart=time;}
        const strengths=sampleBorderPulse(time-previewStart,reduced);let index=0;
        states.clear();marks.forEach(hide);particles.forEach(hide);waves.forEach(hide);stats={cells:[],particles:0,waves:0,ringStrengths:strengths};
        plan.rings.forEach((cells,ring)=>{for(const cell of cells){const mesh=rims[index++];mesh.visible=strengths[ring]>.001;mesh.position.copy(anchor(cell));mesh.material.color.set(COLORS[plan.magnet.color].hex);mesh.material.opacity=strengths[ring]*.95;mesh.renderOrder=cellOrder(cell)+1;stats.cells.push({cell,ring:ring+1,strength:strengths[ring],color:plan.magnet.color});}});
        lastTime=time;return;
      }
      previewKey=null;
      if(!timeline){states.clear();marks.forEach(hide);particles.forEach(hide);waves.forEach(hide);stats={cells:[],particles:0,waves:0,ringStrengths:[0,0]};lastTime=time;return;}
      const dt=lastTime===null||time<lastTime?0:Math.min(.05,time-lastTime);lastTime=time;
      const active=timeline?.segments.filter(s=>s.type==='unitMoved'&&time>=s.start&&time<s.end)??[];
      const desired=new Map((plan?.affectedCells??[]).map(c=>[cellId(c),c]));
      // During work, only actual moving edges light up.
      for(const s of active)desired.set(cellId(s.from),s.from);
      const color=plan?.magnet.color??timeline?.magnet.color;
      for(const [id,cell]of desired){if(!states.has(id))states.set(id,{cell,strength:0,color,display:new THREE.Color(COLORS[color].hex)});states.get(id).color=color;}
      let index=0;stats={cells:[],particles:0,waves:0};
      for(const [id,s]of states){
        const target=desired.has(id)?1:0;
        if(!paused)s.strength=reduced?target:s.strength+(target-s.strength)*(1-Math.exp(-dt*20));
        if(!target&&s.strength<.005){states.delete(id);continue;}
        tint.set(COLORS[s.color].hex);if(!paused)s.display.lerp(tint,reduced?1:1-Math.exp(-dt*20));
        const mesh=marks[index++];mesh.visible=true;mesh.position.copy(anchor(s.cell));mesh.material.color.copy(s.display);mesh.material.opacity=s.strength*.8;mesh.renderOrder=cellOrder(s.cell)+2;
        stats.cells.push({cell:s.cell,strength:s.strength,color:s.color});
      }
      marks.slice(index).forEach(hide);particles.forEach(hide);waves.forEach(hide);
      if(plan&&!reduced&&!paused){
        const cells=plan.affectedCells,target=anchor(plan.magnet.cell);
        for(let i=0;i<Math.min(48,cells.length*4);i++){
          const cell=cells[Math.floor(i/4)],p=(time*.9+(i%4)/4)%1,mesh=particles[i];
          mesh.visible=true;mesh.position.copy(sampleInfluenceArc(anchor(cell),target,p));mesh.material.color.set(COLORS[plan.magnet.color].hex);mesh.material.opacity=Math.sin(p*Math.PI)*.85;mesh.renderOrder=Math.max(cellOrder(cell),cellOrder(plan.magnet.cell))+90;stats.particles++;
        }
      }
      if(!reduced&&!paused){
        const edges=new Map(active.map(s=>[cellId(s.from)+cellId(s.to),s]));let i=0;
        for(const s of edges.values()){
          if(i>=12)break;const mesh=waves[i++],p=(time-s.start)/(s.end-s.start),a=anchor(s.from),b=anchor(s.to);
          mesh.visible=true;mesh.position.copy(a).lerp(b,p);mesh.scale.set(.25,.035,1);
          const delta=b.clone().sub(a).applyQuaternion(camera.quaternion.clone().invert());mesh.quaternion.copy(camera.quaternion);mesh.rotateZ(Math.atan2(delta.y,delta.x)+Math.PI/2);
          mesh.material.color.set(COLORS[timeline.magnet.color].hex).lerp(white,.45);mesh.material.opacity=Math.sin(p*Math.PI)*.9;mesh.renderOrder=Math.max(cellOrder(s.from),cellOrder(s.to))+2;stats.waves++;
        }
      }
    },
    reset(){states.clear();lastTime=null;previewKey=null;group.children.forEach(hide);stats={cells:[],particles:0,waves:0};},
    snapshot:()=>({...stats,pool:{marks:25,rims:18,particles:48,waves:12}}),
  };
}
