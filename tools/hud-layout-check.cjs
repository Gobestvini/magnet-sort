const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {readyTools}=require('./v4-browser-check.cjs');
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});fs.mkdirSync('artifacts/moves-stars',{recursive:true});try{
const p=await b.newPage();await p.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:5175/')+'?seed=0');await readyTools(p);
for(const viewport of [{width:320,height:720},{width:390,height:844},{width:900,height:900},{width:844,height:390}]){
await p.setViewportSize(viewport);await p.waitForTimeout(350);
const result=await p.evaluate(()=>{
 const selectors=['.brand','.level-badge','.hud','.goal-panel','.moves-panel','.board-host','.controls'];
 const rects=()=>selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
 const before=rects(),group=document.querySelector('.moves-group'),moves=group.querySelector('.moves-panel'),parent=group.parentNode;
 const stars=[...group.querySelectorAll('img')].map(n=>n.getBoundingClientRect());
 const collisions=['.brand','.level-badge','.topbar .round-button','.goal-panel'].filter(s=>{const r=document.querySelector(s).getBoundingClientRect();return stars.some(a=>a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top);});const overlaps=collisions.length>0;
 parent.insertBefore(moves,group);group.remove();const after=rects();parent.insertBefore(group,moves);group.append(moves);
 return {before,after,overlaps,collisions,arc:stars[1].top<stars[0].top&&stars[1].top<stars[2].top};
});assert.deepEqual(result.before,result.after);assert.equal(result.overlaps,false,JSON.stringify({viewport,collisions:result.collisions}));assert.equal(result.arc,true);
await p.screenshot({path:`artifacts/moves-stars/arc-${viewport.width}.png`,fullPage:true});
}console.log('Compact star arc: original logo/HUD/board geometry unchanged; no control overlap at four viewports.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
