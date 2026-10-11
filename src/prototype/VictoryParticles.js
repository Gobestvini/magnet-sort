import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { art } from './assets.js';

// One bounded burst per result mount, no timers, animation loop or shared GPU assets.
function burst(seed) {
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return Array.from({length:42},(_,id)=>{
    const side=id%2 ? 1 : -1;
    return {id,side,size:12+random()*14,delay:Math.floor(id/2)*.014,
      duration:.95+random()*.45,x:side*(30+random()*190),rise:130+random()*220,
      fall:80+random()*180,spin:side*(220+random()*480),
      asset:id%11===0?'victory-star':'confetti-'+['violet','yellow','blue'][id%3]};
  });
}
export function VictoryParticles({seed=1,reduced=false,active=true}) {
  const [particles,setParticles]=useState(()=>burst(seed));
  const [cancelled,setCancelled]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop=()=>{if(document.hidden||media.matches)setCancelled(true);};
    stop();document.addEventListener('visibilitychange',stop);media.addEventListener('change',stop);
    return ()=>{document.removeEventListener('visibilitychange',stop);media.removeEventListener('change',stop);};
  },[]);
  useEffect(()=>{if(reduced||!active)setCancelled(true);},[reduced,active]);
  if(cancelled||reduced||!active)return null;
  return h('div',{className:'victory-particles','aria-hidden':'true'},particles.map(p=>h('img',{
    key:p.id,className:'victory-particle',src:art(p.asset),alt:'',draggable:false,
    style:{left:p.side<0?'24%':'76%',width:p.size+'px','--delay':p.delay+'s','--duration':p.duration+'s',
      '--x-mid':p.x*.55+'px','--x':p.x+'px','--rise':-p.rise+'px','--fall':p.fall+'px','--spin':p.spin+'deg'},
    onAnimationEnd:()=>setParticles(current=>current.filter(item=>item.id!==p.id))
  })));
}
