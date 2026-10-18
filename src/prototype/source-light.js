import * as THREE from 'three';

export const SOURCE_LIGHT_FADE = .55;
const smooth = p => p*p*(3-2*p);
// Sampled time only: pause/hidden freeze with the rest of the move.
export function sourceLightStrength(time, finish = Infinity, reduced = false) {
  if (time < 0) return 0;
  const fade = reduced ? .08 : SOURCE_LIGHT_FADE;
  return time <= finish ? 1 : 1-smooth(Math.min(1,(time-finish)/fade));
}

const TAU=Math.PI*2;
export function sampleSourceLightIdle(time,reduced=false){
  if(reduced)return {intensity:1,rise:0};
  const t=Math.max(0,time);
  return {intensity:.9+.1*Math.cos(t*TAU/3.2),rise:(t/2.6)%1};
}
export function sourceLightFootprint(tile){
  return [[235,1],[469,136],[469,372],[235,510],[1,372],[1,136]].map(([x,y])=>[
    (x-235)/471*tile.width,(256-y)/512*tile.height+tile.offsetY]);
}

// Full tile silhouette includes its front wall, not just the upper lip.
// Back volume, full footprint fill and translucent front volume.
// The owner releases two shared geometries and three materials; no per-frame resources.
export function createSourceLights(scene,camera,plane,own,anchor,cellOrder,tile={width:1.1,height:1.2,offsetY:0}) {
  const group=new THREE.Group();scene.add(group);
  const footprint=sourceLightFootprint(tile),height=2.65;
  const shape=vertices=>{const s=new THREE.Shape();vertices.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;};
  const hull=[footprint[0],footprint[1]].map(([x,y])=>[x,y+height]);
  hull.push(...footprint.slice(2,5),[footprint[5][0],footprint[5][1]+height]);
  const column=own(new THREE.ShapeGeometry(shape(hull))),floor=own(new THREE.ShapeGeometry(shape(footprint)));
  const bottom=Math.min(...footprint.map(p=>p[1])),top=Math.max(...footprint.map(p=>p[1]));
  const shared={color:{value:new THREE.Color()},strength:{value:0},idle:{value:1},rise:{value:0},reduced:{value:0}};
  const material=layer=>own(new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    uniforms:{...shared,layer:{value:layer}},
    vertexShader:`varying vec2 local; void main(){local=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 color;uniform float strength;uniform float idle;uniform float rise;uniform float reduced;uniform float layer;varying vec2 local;
      void main(){float x=abs(local.x)/${(tile.width*.477).toFixed(6)};
        float y=clamp((local.y-(${bottom.toFixed(6)}))/${(height+top-bottom).toFixed(6)},0.0,1.0);
        // Keep the entire lower hex illuminated. Side falloff begins above it.
        float ground=1.0-smoothstep(.10,.28,y);
        float sides=mix(1.0,1.0-smoothstep(.82,1.02,x),smoothstep(.12,.38,y));
        float wave=exp(-pow((y-rise)/.10,2.0))*sin(3.141593*rise)*(1.0-reduced);
        float body=sides*pow(1.0-y,1.4);
        float alpha=layer<.5?body*(.48+.22*wave):layer<1.5?.72:body*(.14+.32*ground+.09*wave);
        vec3 light=mix(color,vec3(1.0),layer<1.5?.28:.12);
        gl_FragColor=vec4(light,alpha*strength*idle);
        #include <colorspace_fragment>
      }`}));
  const materials=[material(0),material(1),material(2)];
  const pool=Array.from({length:18},()=>materials.map((mat,i)=>{const mesh=new THREE.Mesh(i===1?floor:column,mat);mesh.quaternion.copy(camera.quaternion);mesh.visible=false;group.add(mesh);return mesh;}));
  let cells=[],orders=[];
  return {
    draw(sources,color,strength,time=0,reduced=false){
      cells=[];orders=[];const idle=sampleSourceLightIdle(time,reduced);
      shared.strength.value=strength;shared.idle.value=idle.intensity;shared.rise.value=idle.rise;shared.reduced.value=reduced?1:0;
      if(color)shared.color.value.set(color);
      pool.forEach((layers,i)=>{const visible=Boolean(sources[i]&&strength>0);
        layers.forEach((mesh,layer)=>{mesh.visible=visible;if(!visible)return;
          mesh.position.copy(anchor(sources[i]));mesh.renderOrder=cellOrder(sources[i])+[3,4,70][layer];});
        if(visible){cells.push({...sources[i]});orders.push({cell:{...sources[i]},back:layers[0].renderOrder,floor:layers[1].renderOrder,front:layers[2].renderOrder});}
      });
    },
    reset(){this.draw([],null,0);},
    snapshot:()=>({cells,strength:shared.strength.value,pool:pool.length,idle:{intensity:shared.idle.value,rise:shared.rise.value},layers:3,footprint,orders}),
  };
}
