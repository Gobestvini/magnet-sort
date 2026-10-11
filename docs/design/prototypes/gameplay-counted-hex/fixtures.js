import {hexDistance} from '../../../../src/game/hex.js';
import {createPrototypeState,applyMagnet} from '../../../../src/prototype/model.js';
import {makeTransferTimeline} from '../../../../src/prototype/motion.js';
export const cells=Array.from({length:49},(_,i)=>({col:i%7,row:Math.floor(i/7)})).filter(c=>hexDistance(c,{col:3,row:3})<=2);
const stack=(col,row,colors)=>({cell:{col,row},units:colors.map((color,i)=>({id:`r${row}c${col}-${i}`,color}))});
const rep=(color,n)=>Array(n).fill(color);
const action=(color,col,row)=>({type:'placeMagnet',color,cell:{col,row}});
const base={rulesVersion:3,cells,blockers:[],moves:5,clearSize:6,magnets:['violet','blue','coral']};
export const fixtures=[
 {id:'design',label:'Main screen',stacks:[stack(2,1,rep('violet',6)),stack(4,1,rep('blue',6)),stack(2,4,[...rep('violet',3),...rep('coral',3)])],blockers:[{col:3,row:1},{col:3,row:5}],action:action('coral',2,3)},
 {id:'single',label:'One chip',stacks:[stack(3,2,['violet'])],action:action('violet',3,3)},
 {id:'mixed',label:'Expose the lower color',stacks:[stack(3,2,['blue','blue','violet','violet','violet'])],action:action('violet',3,3)},
 {id:'chain',label:'Neighbor chain',stacks:[stack(3,1,rep('blue',4))],action:action('blue',3,3)},
 {id:'clear',label:'Six-chip clear',stacks:[stack(3,2,rep('violet',6))],action:action('violet',3,3)},
 {id:'tall',label:'20 thin chips',stacks:[stack(3,3,rep('violet',20))],action:action('violet',4,3)},
 {id:'twelve',label:'12 chips',stacks:[stack(3,3,rep('blue',12))],action:action('blue',4,3)}
].map(f=>({...base,...f}));
export function scenario(id='design',reduced=false) {
 const fixture=fixtures.find(f=>f.id===id);if(!fixture)throw Error('Unknown fixture');
 const before=createPrototypeState(fixture);const resolution=applyMagnet(before,fixture.action);
 if(!resolution.accepted)throw Error('Invalid fixture action');
 return {fixture,before,resolution,timeline:makeTransferTimeline(before,resolution,reduced)};
}
