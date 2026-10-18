import * as THREE from 'three';
import {createSourceLights,sourceLightStrength} from '../../../src/prototype/source-light.js';
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2.4,-.4,.1,20);camera.position.z=5;
const owned=[],own=r=>(owned.push(r),r),plane=own(new THREE.PlaneGeometry(1,1)),loader=new THREE.TextureLoader();
for(const [x,color] of [[-1.6,'blue'],[0,'blue'],[1.6,'coral']]){
 for(const [name,y,width,height] of [['tile',0,1.3,1.4],['chip-'+color,.2,1.1,1.05]]){
 const texture=own(await loader.loadAsync('/art/mockup/'+name+'.png'));texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(plane,own(new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false})));mesh.position.set(x,y,0);mesh.scale.set(width,height,1);mesh.renderOrder=name==='tile'?1:10;scene.add(mesh);}
}
const lights=createSourceLights(scene,camera,plane,own,c=>new THREE.Vector3(c.col,0,0),()=>1);
const time=document.querySelector('#time'),reduced=document.querySelector('#reduced');let t=Number(new URLSearchParams(location.search).get('t')??0),playing=!location.search.includes('t='),previous;
document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Пауза':'Повтор';};time.oninput=()=>{playing=false;t=Number(time.value);};
function frame(now){if(playing&&previous)t=(t+(now-previous)/1000)%4.5;previous=now;time.value=t;
 const strength=sourceLightStrength(t,3,reduced.checked);lights.draw([{col:-1.6},{col:0}],'#48baff',strength);
 document.querySelector('#phase').textContent=t<1?'Предпросмотр':t<=3?'Притяжение':strength>0?'Затухание':'Завершено';
 const width=canvas.clientWidth,height=canvas.clientHeight;const span=Math.max(3.8,6*height/width);camera.bottom=-.9;camera.top=-.9+span;camera.left=-span*width/height/2;camera.right=span*width/height/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{owned.forEach(r=>r.dispose());renderer.dispose();},{once:true});
