const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const target=JSON.parse(fs.readFileSync('artifacts/border-preview/target.json','utf8'));
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});fs.mkdirSync('artifacts/public-border',{recursive:true});try{
const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
await p.goto((process.env.GAME_BASE_URL||'https://gobestvini.github.io/magnet-sort/')+'?seed='+target.seed+'&verify='+Date.now());await p.locator('.loading-screen').waitFor({state:'detached'});
const tool=await p.locator(`[data-magnet-color="${target.color}"]`).boundingBox(),canvas=await p.locator('canvas').boundingBox();
await p.mouse.move(tool.x+tool.width/2,tool.y+tool.height/2);await p.mouse.down();await p.mouse.move(canvas.x+canvas.width*target.x,canvas.y+canvas.height*target.y,{steps:8});
for(const name of ['inner','outer','repeat']){await p.waitForTimeout(name==='inner'?600:1200);await p.screenshot({path:`artifacts/public-border/${name}.png`});assert.equal(await p.locator('.moves-panel strong').textContent(),'0');}
await p.mouse.move(2,2);await p.mouse.up();await p.waitForTimeout(350);assert.equal(await p.locator('.moves-panel strong').textContent(),'0');
await p.getByRole('button',{name:'Pause',exact:true}).click();await p.getByRole('button',{name:'Resume',exact:true}).click();assert.deepEqual(errors,[]);console.log('Published border preview: stationary drag cycle captured, cancel/pause/input and resources passed.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
