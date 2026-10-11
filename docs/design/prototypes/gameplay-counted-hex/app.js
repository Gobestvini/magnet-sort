import {fixtures,scenario} from './fixtures.js';
import {presentation} from './presentation.js';
import {createBoard} from './board.js';
const $=s=>document.querySelector(s),selection=$('#fixture'),reduced=$('#reduced'),scrub=$('#scrub'),play=$('#play');
for(const f of fixtures){const opt=document.createElement('option');opt.value=f.id;opt.textContent=f.label;selection.append(opt);}
const layers=await fetch('./ui-layers.json').then(r=>{if(!r.ok)throw Error('Missing UI artwork');return r.json();});
await Promise.all(layers.map(async l=>{const img=new Image();img.src=l.url;img.alt='';Object.assign(img.style,{left:l.x+'px',top:l.y+'px',width:l.width+'px',height:l.height+'px'});await img.decode();$('#art').append(img);}));
const board=await createBoard($('#board'),$('#labels'));let data,time=0,playing=false,raf=0,last=0,disposed=false;
function resize(){const w=Math.min(document.documentElement.clientWidth,470);$('#viewport').style.width=w+'px';$('#viewport').style.height=w*1672/941+'px';$('#screen').style.transform=`scale(${w/941})`;}
function render(){const sample=presentation(data.timeline,time);board.draw(data.before,sample,time,data.timeline);scrub.value=time/data.timeline.duration;
 $('#status').textContent=`${time.toFixed(2)} / ${data.timeline.duration.toFixed(2)} s · ${sample.phases.resting.length} resting · ${sample.phases.flying.length} flying · ${sample.phases.cleared.length} cleared`;return sample;}
function pause(){playing=false;cancelAnimationFrame(raf);raf=0;last=0;play.textContent='Play';}
function tick(now){raf=0;if(!playing||disposed)return;if(last)time=Math.min(data.timeline.duration,time+Math.min((now-last)/1000,.05));last=now;render();if(time>=data.timeline.duration)pause();else raf=requestAnimationFrame(tick);}
function load(){pause();data=scenario(selection.value,reduced.checked);time=0;board.setup(data.before);render();}
function start(){if(disposed)return;if(time>=data.timeline.duration)time=0;playing=true;last=0;play.textContent='Pause';raf=requestAnimationFrame(tick);}
const events=new AbortController(),on=(target,type,handler)=>target.addEventListener(type,handler,{signal:events.signal});
on(play,'click',()=>playing?pause():start());on($('#replay'),'click',()=>{pause();time=0;render();start();});
on(scrub,'input',()=>{pause();time=Number(scrub.value)*data.timeline.duration;render();});
on(selection,'change',load);on(reduced,'change',load);on(window,'resize',resize);
const hidden=()=>{if(document.hidden)pause();};on(document,'visibilitychange',hidden);
function dispose(){if(disposed)return;pause();disposed=true;events.abort();board.dispose();}
on(window,'pagehide',dispose);resize();load();
window.countedHex={select(id,reduce=false){selection.value=id;reduced.checked=reduce;load();},seek(t){pause();time=t;return render();},
 snapshot(){return {time,playing,disposed,data,sample:presentation(data.timeline,time),board:board.info(),counts:[...document.querySelectorAll('.count')].map(e=>({cell:e.dataset.cell,value:Number(e.textContent)}))};},dispose};
