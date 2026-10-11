import {DESIGN,position,project} from './geometry.js';
export const SPRITES={
 // Inner floor centre is y=234 in the 512px asset, not the outer body centre.
 'tile-cream':{radius:.995,anchor:234/512},
 'chip-violet':{radius:DESIGN.chipRadius,anchor:.52},
 'chip-blue':{radius:DESIGN.chipRadius,anchor:.52},
 'chip-coral':{radius:DESIGN.chipRadius,anchor:.52},
 blocker:{radius:.78,anchor:.54}
};
export function spriteRect(cell,y,name,sizes){
 const p=position(cell),q=project(p.x,y,p.z),spec=SPRITES[name];
 const width=spec.radius*Math.sqrt(3)*DESIGN.board.width/9;
 const height=width*(sizes[name]?.ratio??149/154);
 return {x:q.x-width/2,y:q.y-height*spec.anchor,width,height};
}
