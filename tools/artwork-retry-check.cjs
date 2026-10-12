const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {readyTools}=require('./v4-browser-check.cjs');
(async()=>{const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'});try{
  const p=await b.newPage(),pattern='**/'+(process.argv[2]||'moves-star.png');await p.route(pattern,r=>r.abort());await p.goto(process.env.GAME_BASE_URL||'http://127.0.0.1:5175/');
  await p.getByRole('dialog',{name:'Launch error',exact:true}).waitFor();await p.unroute(pattern);await p.getByRole('button',{name:'Retry',exact:true}).click();await readyTools(p);
  assert.equal(await p.getByRole('dialog',{name:'Launch error',exact:true}).count(),0);console.log('Shared artwork error/retry passed: '+pattern);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
