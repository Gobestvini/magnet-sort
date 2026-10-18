import * as THREE from 'three';

export const SOURCE_LIGHT_FADE = .55;
const smooth = p => p*p*(3-2*p);
// Sampled time only: pause/hidden freeze with the rest of the move.
export function sourceLightStrength(time, finish = Infinity, reduced = false) {
  if (time < 0) return 0;
  const fade = reduced ? .08 : SOURCE_LIGHT_FADE;
  return time <= finish ? 1 : 1-smooth(Math.min(1,(time-finish)/fade));
}

export function createSourceLights(scene,camera,plane,own,anchor,cellOrder) {
  const group=new THREE.Group(); scene.add(group);
  const material=own(new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    uniforms:{color:{value:new THREE.Color()},strength:{value:0}},
    vertexShader:`varying vec2 uvLight; void main(){uvLight=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 color; uniform float strength; varying vec2 uvLight;
      void main(){float x=abs(uvLight.x-.5)*2.0; float y=uvLight.y;
        float sides=1.0-smoothstep(.35,1.0,x);
        float column=sides*pow(1.0-y,1.25)*smoothstep(0.0,.035,y)*.85;
        float base=exp(-pow(x/.82,4.0)-pow((y-.025)/.027,2.0))*.65;
        float a=(column+base)*strength;
        gl_FragColor=vec4(mix(color,vec3(1.0),min(.8,.5+base*.3)),a);
        #include <colorspace_fragment>
      }`}));
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const meshes=Array.from({length:18},()=>{const mesh=new THREE.Mesh(plane,material);mesh.quaternion.copy(camera.quaternion);mesh.scale.set(.94,2.75,1);mesh.visible=false;group.add(mesh);return mesh;});
  let cells=[];
  return {
    draw(sources,color,strength){
      cells=[];material.uniforms.strength.value=strength;
      if(color)material.uniforms.color.value.set(color);
      meshes.forEach((mesh,i)=>{mesh.visible=Boolean(sources[i]&&strength>0);if(!mesh.visible)return;
        mesh.position.copy(anchor(sources[i])).addScaledVector(up,1.375);
        mesh.renderOrder=cellOrder(sources[i])+3;cells.push({...sources[i]});});
    },
    reset(){this.draw([],null,0);},
    snapshot:()=>({cells,strength:material.uniforms.strength.value,pool:meshes.length}),
  };
}
