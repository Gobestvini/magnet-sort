import * as THREE from 'three';
import {createSourceLights,sourceLightStrength} from '../../../src/prototype/source-light.js';
const canvas=document.querySelector('canvas'),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2.4,-.4,.1,20);camera.position.z=5;
const owned=[],own=r=>(owned.push(r),r),plane=own(new THREE.PlaneGeometry(1,1)),loader=new THREE.TextureLoader();
for(const [x,color,count] of [[-1.6,'blue',6],[0,'blue',10],[1.6,'coral',4]]){
 for(const [name,y,width,height,order] of [['tile',0,1.3,1.4,1],...Array.from({length:count},(_,i)=>['chip-'+color,.12+i*.065,1.1,1.05,10+i*2])]){
 const texture=own(await loader.loadAsync('/art/mockup/'+name+'.png'));texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(plane,own(new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false})));mesh.position.set(x,y,0);mesh.scale.set(width,height,1);mesh.renderOrder=order;scene.add(mesh);}
}
const lights=createSourceLights(scene,camera,plane,own,c=>new THREE.Vector3(c.col,0,0),()=>1,{width:1.3,height:1.4,offsetY:0});
// Pixel regression projects authored tile pixels into this exact preview camera.
window.lightPreview={tilePixelPosition:(sourceX,x,y)=>{
 const point=new THREE.Vector3(sourceX+(x/471-.5)*1.3,(.5-y/512)*1.4,0).project(camera);
 return {x:(point.x+1)*canvas.clientWidth/2,y:(1-point.y)*canvas.clientHeight/2};
}};
const lightOff=new URLSearchParams(location.search).get('light')==='off';
const time=document.querySelector('#time'),reduced=document.querySelector('#reduced');let t=Number(new URLSearchParams(location.search).get('t')??0),playing=!location.search.includes('t='),previous;
document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Пауза':'Повтор';};time.oninput=()=>{playing=false;t=Number(time.value);};
function frame(now){if(playing&&previous)t=(t+(now-previous)/1000)%4.5;previous=now;time.value=t;
 const strength=lightOff?0:sourceLightStrength(t,3,reduced.checked);lights.draw([{col:-1.6},{col:0}],'#48baff',strength,t,reduced.checked);
 document.querySelector('#phase').textContent=t<2?'Idle — дыхание и подъём света':t<=3?'Притяжение':strength>0?'Затухание':'Завершено';
 const width=canvas.clientWidth,height=canvas.clientHeight;const span=Math.max(4.2,6*height/width);camera.bottom=-.9;camera.top=-.9+span;camera.left=-span*width/height/2;camera.right=span*width/height/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{owned.forEach(r=>r.dispose());renderer.dispose();},{once:true});
