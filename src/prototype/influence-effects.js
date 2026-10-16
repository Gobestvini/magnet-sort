import * as THREE from 'three';
import { COLORS } from './model.js';
import { samplePreviewParticle } from './preview-particles.js';
import { sampleBorderWaves, BORDER_WAVE_WIDTH } from './border-preview.js';

export const PARTICLES_PER_CELL = 3;
export const PREVIEW_PARTICLE_RADIUS = .022;
// Retained masks and small particles share the board's owner and runtime clock.
export function createInfluenceEffects(scene,camera,plane,own,anchor,cellOrder,tile={width:1.1,height:1.1,offsetY:0}) {
  const group=new THREE.Group();scene.add(group);
  const geometry=own(new THREE.CircleGeometry(PREVIEW_PARTICLE_RADIUS,8));
  const material=own(new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
    opacity:.85,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  const particles=Array.from({length:18*PARTICLES_PER_CELL},()=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.quaternion.copy(camera.quaternion);
    mesh.visible=false;group.add(mesh);return mesh;
  });
  const rimShape=new THREE.Shape(),rimHole=new THREE.Path();
  // Authored 471x512 tile: upper rim ends at y=459; y=460..512 is its front wall.
  // Stay outside the well (WELL_PIXELS in chip.js), inside the rounded outer lip.
  const outer=[[235,10],[459,140],[459,332],[235,458],[12,332],[12,140]];
  const inner=[[235,43],[430,149],[430,316],[235,426],[40,316],[40,149]];
  function pathPixels(path,vertices){vertices.forEach(([x,y],i)=>{
    // Pixel vertices are relative to the PNG center, not its well center (234).
    // tile.offsetY already aligns the tile center with the magnet anchor.
    const px=(x-235)/471*tile.width,py=(256-y)/512*tile.height+tile.offsetY;
    if(i)path.lineTo(px,py);else path.moveTo(px,py);
  });path.closePath();}
  pathPixels(rimShape,outer);pathPixels(rimHole,[...inner].reverse());rimShape.holes.push(rimHole);
  const rimGeometry=own(new THREE.ShapeGeometry(rimShape));
  const groundRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const groundUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  groundUp.y=0;groundUp.divideScalar(groundUp.lengthSq());
  const uniforms={center:{value:new THREE.Vector2()},color:{value:new THREE.Color()},
    radii:{value:new THREE.Vector3()},alphas:{value:new THREE.Vector3()},reduced:{value:0},
    groundRight:{value:new THREE.Vector2(groundRight.x,groundRight.z)},groundUp:{value:new THREE.Vector2(groundUp.x,groundUp.z)}};
  const rimMaterial=own(new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,uniforms,
    vertexShader:`uniform vec2 groundRight; uniform vec2 groundUp; varying vec2 field;
      void main(){field=modelMatrix[3].xz+position.x*groundRight+position.y*groundUp;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec2 center; uniform vec3 color; uniform vec3 radii; uniform vec3 alphas; uniform float reduced; varying vec2 field;
      void main(){float d=distance(field,center);float a=0.0;
        for(int i=0;i<3;i++){a=max(a,(1.0-smoothstep(0.0,${BORDER_WAVE_WIDTH.toFixed(2)},abs(d-radii[i])))*alphas[i]);}
        a=mix(a*.95,.45,reduced);gl_FragColor=vec4(color,a);
        #include <colorspace_fragment>
      }` }));
  const rims=Array.from({length:18},()=>{const mesh=new THREE.Mesh(rimGeometry,rimMaterial);mesh.quaternion.copy(camera.quaternion);group.add(mesh);return mesh;});
  let previewKey=null,previewStart=0,stats={cells:[],particles:0,waves:0,arcs:[],radialWaves:[]};
  function hide(){for(const mesh of group.children)mesh.visible=false;}
  return {
    draw(plan,timeline,time,reduced,paused){
      hide();stats={cells:[],particles:0,waves:0,arcs:[],radialWaves:[],reduced:Boolean(reduced)};
      // All surrounding preview effects stop at placement, including activation,
      // hex transfers and collection. The board owns the active target's border.
      if(paused||timeline||!plan?.rings){previewKey=null;return;}
      const changed=previewKey!==plan.key||time<previewStart;
      if(changed){previewKey=plan.key;previewStart=time;}
      const target=anchor(plan.magnet.cell),age=time-previewStart;
      uniforms.center.value.set(target.x,target.z);
      uniforms.color.value.set(COLORS[plan.magnet.color].hex);uniforms.reduced.value=reduced?1:0;
      const radialWaves=sampleBorderWaves(age,reduced);
      uniforms.radii.value.set(...(radialWaves.length?radialWaves.map(w=>w.radius):[0,0,0]));
      uniforms.alphas.value.set(...(radialWaves.length?radialWaves.map(w=>w.opacity):[0,0,0]));
      stats.radialWaves=radialWaves;stats.center=plan.magnet.cell;
      let index=0;
      plan.rings.forEach((cells,ring)=>{for(const cell of cells){
        const mesh=rims[index++];mesh.visible=true;
        if(changed)mesh.position.copy(anchor(cell));
        mesh.renderOrder=cellOrder(cell)+1;
        stats.cells.push({cell,ring:ring+1,color:plan.magnet.color});
      }});
      if(reduced)return;
      material.color.set(COLORS[plan.magnet.color].hex);
      const cells=plan.particleCells;
      for(let c=0;c<cells.length;c++){
        const source=anchor(cells[c]);
        for(let n=0;n<PARTICLES_PER_CELL;n++){
          const mesh=particles[c*PARTICLES_PER_CELL+n];
          const sample=samplePreviewParticle(cells[c],n,age,source,target);
          mesh.visible=true;mesh.position.copy(sample.position);
          mesh.scale.setScalar(sample.size*(.55+.45*Math.sin(Math.PI*sample.progress)));
          mesh.renderOrder=Math.max(cellOrder(cells[c]),cellOrder(plan.magnet.cell))+120;
          stats.particles++;stats.arcs.push({cell:cells[c],color:plan.magnet.color,...sample,
            from:{x:source.x,y:source.y,z:source.z},to:{x:target.x,y:target.y,z:target.z}});
        }
      }
    },
    reset(){hide();previewKey=null;stats={cells:[],particles:0,waves:0,arcs:[],radialWaves:[]};},
    snapshot:()=>({...stats,pool:{marks:0,rims:rims.length,particles:particles.length,waves:0},particleRadius:PREVIEW_PARTICLE_RADIUS}),
  };
}
