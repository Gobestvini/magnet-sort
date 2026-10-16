import * as THREE from 'three';
import { COLORS } from './model.js';
import { sampleInfluenceArc } from './magnet-influence.js';

export const PARTICLES_PER_CELL = 3;
// The board owns every shared GPU resource; runtime supplies the only clock.
export function createInfluenceEffects(scene,camera,plane,own,anchor,cellOrder) {
  const group=new THREE.Group();scene.add(group);
  const geometry=own(new THREE.CircleGeometry(.04,8));
  const material=own(new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
    opacity:.85,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  const particles=Array.from({length:18*PARTICLES_PER_CELL},()=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.quaternion.copy(camera.quaternion);
    mesh.visible=false;group.add(mesh);return mesh;
  });
  let previewKey=null,previewStart=0,stats={cells:[],particles:0,waves:0,arcs:[]};
  function hide(){particles.forEach(mesh=>{mesh.visible=false;});}
  return {
    draw(plan,timeline,time,reduced,paused){
      hide();stats={cells:[],particles:0,waves:0,arcs:[],reduced:Boolean(reduced)};
      // Empty cells and foreign colors emit too; movement still uses matching tops.
      const preview=plan?.rings?plan:null;
      const work=timeline?.influence;
      const magnet=timeline?.magnet??preview?.magnet;
      if(paused||!magnet||(!preview&&!work)||time>=timeline?.deactivateEnd){previewKey=null;return;}
      const key=preview?.key??'work';
      if(previewKey!==key||time<previewStart){previewKey=key;previewStart=time;}
      if(reduced)return;
      const cells=preview?preview.rings.flat():work.sources;
      const target=anchor(magnet.cell);
      material.color.set(COLORS[magnet.color].hex);
      stats.center=magnet.cell;
      for(let c=0;c<cells.length;c++){
        const source=anchor(cells[c]);
        for(let n=0;n<PARTICLES_PER_CELL;n++){
          const mesh=particles[c*PARTICLES_PER_CELL+n];
          if(!mesh)break;
          // Stable phases avoid synchronized showers and don't consume RNG.
          const progress=((time-previewStart)/1.35+n/PARTICLES_PER_CELL+c*.137)%1;
          const position=sampleInfluenceArc(source,target,progress);
          mesh.visible=true;mesh.position.copy(position);
          mesh.scale.setScalar(.55+.55*Math.sin(Math.PI*progress));
          mesh.renderOrder=Math.max(cellOrder(cells[c]),cellOrder(magnet.cell))+120;
          stats.particles++;stats.arcs.push({cell:cells[c],color:magnet.color,progress,position,
            from:{x:source.x,y:source.y,z:source.z},to:{x:target.x,y:target.y,z:target.z}});
        }
      }
    },
    reset(){hide();previewKey=null;stats={cells:[],particles:0,waves:0,arcs:[]};},
    snapshot:()=>({...stats,pool:{marks:0,rims:0,particles:particles.length,waves:0}}),
  };
}
