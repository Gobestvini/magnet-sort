const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {smoke,keyboardPlace,readyTools}=require('../v4-browser-check.cjs');
const {probe:audioProbe}=require('../audio-browser-check.cjs');
// Only the bridge boundary is simulated. The production renderer/game are real.
async function bridge(page) {
  await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.addInitScript(()=>{
    const handlers=new Map(); window.tgTest={ready:0,expanded:0,emit(name,data){for(const fn of handlers.get(name)||[])fn(data);}};
    window.Telegram={WebApp:{initData:'opaque-browser-fixture',version:'8.0',isActive:true,viewportStableHeight:innerHeight,viewportHeight:innerHeight,
      safeAreaInset:{top:20,bottom:12},contentSafeAreaInset:{top:36,bottom:24},
      expand(){window.tgTest.expanded++;},ready(){window.tgTest.ready++;},
      onEvent(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},offEvent(name,fn){handlers.get(name)?.delete(fn);}}};
  });
}
async function main() {
  const root=path.resolve(process.env.PUBLICATION_ROOT||'dist'); let server;
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
  try {
    let base=process.env.PLATFORM_BASE_URL;
    if(!base){
      server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://localhost');
        if(url.pathname==='/host.html'){res.setHeader('Content-Type','text/html');res.end('<iframe title="Game" src="/magnet-sort/embed/" style="width:390px;height:844px"></iframe>');return;}
        const relative=url.pathname.replace(/^\/magnet-sort\//,'');
        const file=path.resolve(root,relative.endsWith('/')?relative+'index.html':relative);
        if(!url.pathname.startsWith('/magnet-sort/')||!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');fs.createReadStream(file).pipe(res);
      });
      await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/magnet-sort/';
    }
    fs.mkdirSync('artifacts/platforms',{recursive:true});
    const web=base+(process.env.PUBLICATION_LAYOUT==='combined'?'':'web/');
    if(!process.env.PLATFORM_SMOKE_SKIP){await smoke(web,'artifacts/platforms/web');await smoke(base+'telegram/','artifacts/platforms/telegram',bridge);}
    const browser=await chromium.launch({headless:true});
    try {
      const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await bridge(page);await audioProbe(page);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(web);await page.waitForFunction(()=>!document.body.dataset.startup);
      await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
      await page.goto(base+'telegram/');await page.waitForFunction(()=>!document.body.dataset.startup);
      await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/telegram/resource-sw.js'));
      assert.equal(await page.evaluate(()=>tgTest.ready),1);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--platform-inset-top')),'36px');
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      await page.waitForFunction(()=>__audioProbe().states.includes('running'));
      await page.evaluate(()=>{tgTest.emit('deactivated');tgTest.emit('activated');});
      await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor(); // Platform resume preserves user pause.
      await page.getByRole('button',{name:'Resume',exact:true}).click();
      await page.waitForFunction(()=>__audioProbe().timers===1);
      await page.evaluate(()=>tgTest.emit('deactivated'));await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor();
      await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>__audioProbe().timers),0);
      assert.ok(await page.evaluate(()=>__audioProbe().rms)<.0001,'platform deactivation silences audio');
      await page.evaluate(()=>tgTest.emit('activated'));assert.equal(await page.getByRole('dialog',{name:'Paused',exact:true}).count(),0);
      // The SDK cannot grant autoplay: use the next actual trusted input if resume requires it.
      await page.locator('.magnet-tool').first().click();await page.waitForFunction(()=>__audioProbe().timers===1);
      await page.screenshot({path:'artifacts/platforms/telegram-portrait.png',fullPage:true});
      await page.setViewportSize({width:844,height:390});
      await page.evaluate(()=>{Telegram.WebApp.viewportStableHeight=390;Telegram.WebApp.viewportHeight=390;tgTest.emit('viewportChanged',{isStateStable:true});});
      await page.screenshot({path:'artifacts/platforms/telegram-landscape.png',fullPage:true});
      const box=await page.locator('.topbar').boundingBox();assert.ok(box.y>=36,'HUD respects top inset');
      for(const selector of ['.topbar','.hud','.board-host','.controls','.game-status']) {
        const box=await page.locator(selector).boundingBox();assert.ok(box.y+box.height<=366.5,selector+' fits above Telegram bottom controls');
      }
      await page.waitForFunction(async()=>{
        const names=(await caches.keys()).filter(n=>n.startsWith('magnet-sort-resources-/magnet-sort/telegram/-'));
        if(!names.length)return false;
        const manifest=await fetch('resource-cache.json').then(r=>r.json());
        const cache=await caches.open(names[names.length-1]);return (await cache.keys()).length===manifest.assets.length;
      },null,{timeout:30000});
      // A corrupted cache entry is repaired; HTML is never in any resource cache.
      await page.evaluate(async()=>{
        const names=(await caches.keys()).filter(n=>n.includes('/telegram/'));const cache=await caches.open(names[names.length-1]);
        const manifest=await fetch('resource-cache.json').then(r=>r.json());const url=new URL(manifest.assets[0].url,location.href).href;
        await cache.put(url,new Response('corrupt'));const response=await fetch(url);if((await response.text())==='corrupt')throw Error('Corrupt cache survived');
        for(const name of await caches.keys())for(const request of await (await caches.open(name)).keys())if(!new URL(request.url).pathname.includes('/assets/'))throw Error('Cached non-resource');
      });
      await page.reload();await page.waitForFunction(()=>!document.body.dataset.startup);assert.equal(await page.evaluate(()=>tgTest.ready),1);
      assert.deepEqual(errors,[]);await page.close();
      const plain=await browser.newPage();await plain.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({contentType:'text/javascript',body:'window.Telegram={WebApp:{initData:""}};'}));
      await plain.goto(base+'telegram/');await plain.getByText(/Open Magnet Sort from/).waitFor();assert.equal(await plain.locator('canvas').count(),0);await plain.close();
      if(server){
        const host=await browser.newPage({viewport:{width:800,height:1000},reducedMotion:'reduce'});await audioProbe(host);const sdk=[];host.on('request',r=>{if(r.url().includes('telegram.org'))sdk.push(r.url());});
        await host.goto(new URL('/host.html',base).href);const frame=host.frameLocator('iframe');await frame.locator('.magnet-tool:not(:disabled)').first().waitFor();
        await frame.getByRole('button',{name:'Pause',exact:true}).click();await frame.getByRole('button',{name:'Resume',exact:true}).click();
        const gameFrame=await (await host.locator('iframe').elementHandle()).contentFrame();
        await gameFrame.waitForFunction(()=>__audioProbe().contexts===1&&__audioProbe().timers===1&&__audioProbe().rms>.001);
        assert.deepEqual(sdk,[]);await host.screenshot({path:'artifacts/platforms/embed.png',fullPage:true});await host.close();
      }
    }finally{await browser.close();}
    console.log('Platform production checks passed: SDK isolation, bridge gate, ready once, safe areas, pause OR, iframe, scoped resource cache/hash repair and reload. Browser surrogate only.');
  }finally{if(server)await new Promise(r=>server.close(r));}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={bridge};
