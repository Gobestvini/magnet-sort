import { paceRules, PACE_VERSION } from './pace-profiles.js';
const $=id=>document.getElementById(id),frame=$('game'),records=[];
let active=null,last=performance.now(),lastMove=0,lastCount=0,sequence=0,download;
function capture(){if(active){active.notes=$('notes').value;records.push(active);active=null;}}
$('setup').addEventListener('submit',event=>{
  event.preventDefault();capture();
  const level=Number($('level').value),seed=Number($('seed').value),id=$('profile').value;
  if(!Number.isInteger(level)||level<1||level>12||!Number.isInteger(seed)||seed<0||seed>0xffffffff)return;
  const rules=paceRules(id);
  window.__magnetPaceExperiment={rules,levelIndex:level-1};
  active={version:PACE_VERSION,timingVersion:'through-result-2',player:$('player').value||'P1',profile:id,level,seed,startedAt:new Date().toISOString(),activeSeconds:0,idleSeconds:0,actions:[],outcome:'playing',notes:''};
  last=performance.now();lastMove=last;lastCount=0;$('notes').value='';
  frame.src='/?seed='+seed+'&paceRun='+(++sequence);
});
const timer=setInterval(()=>{
  const now=performance.now(),dt=Math.min(1,(now-last)/1000);last=now;
  if(!active)return;
  let s;try{s=frame.contentWindow.gameDebug?.snapshot();}catch{return;}
  if(!s||s.loading)return;
  if(s.state.movesUsed!==lastCount){lastCount=s.state.movesUsed;lastMove=now;}
  if(!document.hidden&&!s.paused&&!s.error&&['playing','resolving'].includes(s.phase)){active.activeSeconds+=dt;if(now-lastMove>15000)active.idleSeconds+=dt;}
  active.actions=s.attempt.actions;active.outcome=s.phase==='resolving'?'resolving':s.state.terminal??'playing';active.moves=s.state.movesUsed;active.cleared=s.state.cleared;active.stars=s.state.stars;
  $('live').textContent=active.profile+' · уровень '+active.level+' · '+active.outcome+'\nХоды: '+active.moves+'; сбор: '+active.cleared+'/'+s.state.goal+'\nВидимое время: '+Math.round(active.activeSeconds)+' с; idle (>15 с): '+Math.round(active.idleSeconds)+' с';
},200);
$('export').addEventListener('click',()=>{
  if(active)active.notes=$('notes').value;
  if(download)URL.revokeObjectURL(download);
  download=URL.createObjectURL(new Blob([JSON.stringify({version:PACE_VERSION,device:navigator.userAgent,records:[...records,...(active?[active]:[])]},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=download;a.download='magnet-sort-pace-playtest.json';a.click();
});
addEventListener('pagehide',()=>{clearInterval(timer);if(download)URL.revokeObjectURL(download);});
