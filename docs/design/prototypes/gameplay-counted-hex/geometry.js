import * as THREE from 'three';
export const DESIGN = { width:941,height:1672,board:{x:30,y:400,width:881,height:720},radius:1,chipRadius:.82,thickness:.066,floor:.12 };
export function position(cell) { return { x:Math.sqrt(3)*(cell.col+(cell.row%2)*.5-3.5), z:1.5*(cell.row-3) }; }
export function contour(radius=1) { return Array.from({length:6},(_,i)=>({x:Math.cos(Math.PI/6+i*Math.PI/3)*radius,z:Math.sin(Math.PI/6+i*Math.PI/3)*radius})); }
export function camera() {
 const halfHeight=4.5*DESIGN.board.height/DESIGN.board.width;
 const c=new THREE.OrthographicCamera(-4.5,4.5,halfHeight,-halfHeight,.1,50);
 c.position.set(0,11,7); c.lookAt(0,.2,0); c.updateMatrixWorld(); return c;
}
export function project(x,y,z,c=camera()) {
 const p=new THREE.Vector3(x,y,z).project(c),b=DESIGN.board;
 return {x:b.x+(p.x+1)*b.width/2,y:b.y+(1-p.y)*b.height/2};
}
export function geometry(radius,height) {
 const points=contour(radius); const s=new THREE.Shape();
 points.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();
 const bevel=Math.min(.008,height/4);
 const g=new THREE.ExtrudeGeometry(s,{depth:height-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:.013,bevelSegments:1,steps:1});
 g.rotateX(-Math.PI/2);g.translate(0,bevel,0);return g;
}
export function posePosition(p,reduced=false) {
 const at=position(p.cell??p.from),h=DESIGN.thickness,f=DESIGN.floor;
 if(!p.from)return {x:at.x,y:f+p.index*h,z:at.z,flip:0};
 const to=position(p.to),t=p.progress,u=t*t*(3-2*t);
 return {x:at.x+(to.x-at.x)*u,z:at.z+(to.z-at.z)*u,
 y:f+(p.fromIndex+(p.toIndex-p.fromIndex)*u)*h+(reduced?0:Math.sin(Math.PI*t)*.7),
 flip:reduced?0:Math.PI*2*u};
}
