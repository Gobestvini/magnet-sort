// Real pointer/touch input and projected tutorial geometry, dev or production.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const output = process.env.TUTORIAL_OUTPUT || 'artifacts/tutorial-browser';
fs.mkdirSync(output, {recursive:true});
const close = (a,b,label) => assert.ok(Math.abs(a-b) < 1.5, `${label}: ${a} / ${b}`);
async function geometry(page) {
  await page.waitForSelector('.tutorial-route-line');
  // Button press/release changes its transform without changing layout size.
  await page.locator('.magnet-tool').evaluateAll(nodes => Promise.all(nodes.flatMap(node => node.getAnimations()).map(animation => animation.finished.catch(() => {}))));
  await page.waitForFunction(() => {
    const guide=document.querySelector('.tutorial-guide'), route=guide?.querySelector('.tutorial-route-line');
    if(!route)return false;
    const rect=document.querySelector(`[data-magnet-color="${guide.dataset.color}"] > img`).getBoundingClientRect(),start=route.getPointAtLength(0);
    return Math.abs(start.x-rect.x-rect.width/2)<1.5 && Math.abs(start.y-rect.y-rect.height/2)<1.5;
  });
  const g = await page.evaluate(() => {
    const guide = document.querySelector('.tutorial-guide'), color = guide.dataset.color;
    const rect = document.querySelector(`[data-magnet-color="${color}"] > img`).getBoundingClientRect();
    const route = guide.querySelector('.tutorial-route-line'), start = route.getPointAtLength(0), end = route.getPointAtLength(route.getTotalLength());
    const [col,row] = guide.dataset.targetCell.split(',').map(Number), target = window.gameDebug?.screenPosition({col,row});
    return {color,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},source:{x:rect.x+rect.width/2,y:rect.y+rect.height/2},target,
      selected:document.querySelector(`[data-magnet-color="${color}"]`).getAttribute('aria-pressed'),pointer:getComputedStyle(guide).pointerEvents};
  });
  close(g.start.x,g.source.x,'source x'); close(g.start.y,g.source.y,'source y');
  if (g.target) { close(g.end.x,g.target.x,'target x'); close(g.end.y,g.target.y,'target y'); }
  assert.equal(g.selected,'true'); assert.equal(g.pointer,'none');
  return g;
}
async function check(base) {
  const browser = await chromium.launch(); const results = [];
  try {
    for (const [width,height] of [[320,740],[390,844],[844,390],[1280,900],[1920,1080]]) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:true});
      const page = await context.newPage(), errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'?seed=1');
      await page.waitForFunction(()=>!document.body.dataset.startup && document.querySelector('.tutorial-route-line'));
      let g = await geometry(page);
      const frames = await page.locator('.tutorial-carrier').evaluate(el=>{
        const a = el.getAnimations()[0]; if(!a) throw Error('missing drag demonstration');
        a.pause(); a.currentTime=1848;
        const m = new DOMMatrix(getComputedStyle(el).transform);
        return {x:m.m41,y:m.m42,count:el.getAnimations().length};
      });
      close(frames.x,g.end.x,'demo end x'); close(frames.y,g.end.y,'demo end y'); assert.equal(frames.count,1);
      await page.screenshot({path:path.join(output,`${width}-drop.png`)});
      await page.locator('.tutorial-carrier').evaluate(el=>el.getAnimations()[0].currentTime=1250);
      await page.screenshot({path:path.join(output,`${width}-drag.png`)});
      // Selecting another offered magnet must change both ends of the guide.
      await page.locator('.magnet-tool').nth(1).tap();
      await page.waitForFunction(()=>document.querySelector('.tutorial-guide')?.dataset.color === document.querySelectorAll('.magnet-tool')[1].dataset.magnetColor);
      g = await geometry(page);
      await page.setViewportSize({width:width+16,height:height+20});
      await page.waitForFunction(w=>document.querySelector('.tutorial-route')?.getAttribute('width')===String(w),width+16);
      g = await geometry(page);
      await page.evaluate(()=>scrollBy(0,70)); await page.waitForTimeout(80); g = await geometry(page);
      // Real drag cancel does not spend a move; hint resumes after release.
      await page.mouse.move(g.source.x,g.source.y); await page.mouse.down();
      await page.waitForFunction(()=>!document.querySelector('.tutorial-guide'));
      assert.equal(await page.locator('.tutorial-carrier').count(),0);
      await page.mouse.move(5,5,{steps:6}); await page.mouse.up();
      g = await geometry(page); assert.equal(await page.locator('.moves-panel strong').textContent(),'0');
      // Pausing destroys the animation; reopening creates exactly one.
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      assert.equal(await page.locator('.tutorial-guide').count(),0);
      await page.getByRole('button',{name:'Resume',exact:true}).click(); await geometry(page);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>document.querySelector('.tutorial-guide')?.dataset.still==='true');
      assert.equal(await page.locator('.tutorial-carrier').evaluate(el=>el.getAnimations().length),0);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.waitForFunction(()=>document.querySelector('.tutorial-carrier')?.getAnimations().length===1);
      g = await geometry(page);
      // Touch drag from the displayed magnet to the highlighted target, no debug commands.
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:g.source.x,y:g.source.y}]});
      await page.waitForFunction(()=>!document.querySelector('.tutorial-guide'));
      for(let i=1;i<=12;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:g.source.x+(g.end.x-g.source.x)*i/12,y:g.source.y+(g.end.y-g.source.y)*i/12}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>document.querySelector('.moves-panel strong').textContent==='1');
      assert.equal(await page.locator('.tutorial-guide').count(),0);
      if(await page.evaluate(()=>Boolean(window.gameDebug))) {
        for(let i=0;i<3;i++) {
          await page.evaluate(()=>gameDebug.reset()); await geometry(page);
          assert.equal(await page.locator('.tutorial-carrier').evaluate(el=>el.getAnimations().length),1);
        }
        assert.equal(await page.evaluate(()=>gameDebug.snapshot().rafScheduled),false,'demo does not start game RAF');
        await page.evaluate(()=>gameDebug.dispose());
        assert.equal(await page.locator('.tutorial-guide').count(),0);
        assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.classList.contains('tutorial-carrier')).length),0);
      }
      assert.deepEqual(errors,[]); results.push({width,height,geometry:true,drag:true,cancel:true,reducedMotion:true});
      await context.close();
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({base,results},null,2));
    console.log('Tutorial: 5 viewports, live endpoints, selection/resize/scroll, mouse cancel, pause, reduced motion, real touch drop passed.');
  } finally { await browser.close(); }
}
(async()=>{
  let server;
  try {
    let base = process.env.GAME_BASE_URL;
    if(!base) {
      const dist=path.resolve('dist'),prefix='/magnet-sort/',mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.svg':'image/svg+xml'};
      server=http.createServer((req,res)=>{
        const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(dist,pathname.slice(prefix.length)||'index.html');
        if(!pathname.startsWith(prefix)||!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
      });
      await new Promise(r=>server.listen(0,'127.0.0.1',r)); base='http://127.0.0.1:'+server.address().port+prefix;
    }
    await check(base);
  } finally { if(server) await new Promise(r=>server.close(r)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
