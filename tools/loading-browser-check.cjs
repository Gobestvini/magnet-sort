const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const output = 'artifacts/loading-browser'; fs.mkdirSync(output, { recursive:true });
const image = (name, url) => new RegExp('/' + name + '(?:-[^/]+)?\\.(?:png|webp)(?:\\?|$)').test(url);
async function main() {
  let server, browser;
  try {
    let base = process.env.GAME_BASE_URL;
    if (!base) {
      const dist = path.resolve('dist'), prefix = '/magnet-sort/';
      const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.json':'application/json' };
      server = http.createServer((req,res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(dist, decodeURIComponent(url.pathname).slice(prefix.length) || 'index.html');
        if (!url.pathname.startsWith(prefix) || !file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${server.address().port}${prefix}`;
    }
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const [width,height] of [[360,800],[390,844],[844,390],[1440,900],[1920,1080],[2560,1080]]) {
      const context = await browser.newContext({ viewport:{width,height}, reducedMotion: width === 844 ? 'reduce' : 'no-preference' });
      const page = await context.newPage(), errors = [], responses = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if(r.status() >= 400) responses.push([r.status(),r.url()]); });
      let releaseStudio;
      const studioGate = new Promise(resolve => { releaseStudio = resolve; });
      let releaseGame;
      const gameGate = new Promise(resolve => { releaseGame = resolve; });
      await page.route('**/*', async route => {
        if (image('studio',route.request().url())) await studioGate;
        if (image('chip-blue',route.request().url())) await gameGate;
        await route.continue();
      });
      await page.goto(base, { waitUntil:'domcontentloaded' });
      await page.locator('#startup-preloader').waitFor({ state:'visible' });
      assert.equal(await page.locator('#ui-root').evaluate(el => el.inert), true);
      assert.equal(await page.locator('canvas').count(), 0, 'game must wait for shell decode');
      if (width === 844) assert.equal(await page.locator('.startup-spinner').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.screenshot({ path:`${output}/preloader-${width}.png` }); releaseStudio();
      await page.locator('#startup-shell').waitFor({ state:'visible' });
      await page.screenshot({ path:`${output}/loading-${width}.png` });
      assert.equal(await page.locator('#startup-shell').innerText(), '', 'no visible loading labels or percentages');
      const bounds = await page.locator('#startup-shell img').evaluateAll(imgs => imgs.map(img => ({...['x','y','width','height'].reduce((r,k) => (r[k]=img.getBoundingClientRect()[k],r),{}),ready:img.complete&&img.naturalWidth>0})));
      assert(bounds.every(r => r.ready && r.x >= -1 && r.y >= -1 && r.x+r.width <= width+1 && r.y+r.height <= height+1));
      const meter = await page.locator('.startup-meter').boundingBox();
      assert(meter.width <= 360 && meter.height === 30, 'bar proportions must stay stable on wide screens');
      const previewStyle = await page.addStyleTag({content:'/* Progress preview only. */'});
      for (const percent of [0,8,50,100]) {
        await previewStyle.evaluate((node,value) => { node.textContent = `.startup-meter{--loaded:${value}%!important}`; }, percent);
        const fill = await page.locator('.startup-fill').boundingBox();
        const window = await page.locator('.startup-meter-window').boundingBox();
        assert(fill.x >= window.x - .5 && fill.x + fill.width <= window.x + window.width + .5, 'fill stays inside the rounded window');
        if ([390,844,1920].includes(width)) await page.locator('.startup-meter').screenshot({path:`${output}/bar-${width}-${percent}.png`});
        if (percent === 50) await page.screenshot({path:`${output}/loading-${width}.png`});
      }
      await previewStyle.evaluate(node => node.remove());
      releaseGame();
      await page.waitForFunction(() => !document.body.dataset.startup);
      const duration = await page.evaluate(() => performance.getEntriesByName('game-revealed')[0].startTime - performance.getEntriesByName('loading-shell-ready')[0].startTime);
      assert(duration >= 1000, `visible minimum: ${duration}`);
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      await page.getByRole('dialog',{name:'Paused'}).waitFor();
      assert.deepEqual(errors, []); assert.deepEqual(responses, []);
      results.push({width,height,duration}); await context.close();
    }
    for (const failedAsset of ['studio','chip-blue','entry','runtime','stylesheet']) {
      const context = await browser.newContext(), page = await context.newPage();
      await page.route('**/*', route => {
        const url = route.request().url();
        const blocked = failedAsset === 'entry' ? /\/(?:src\/main\.js|assets\/index-[^/]+\.js)(?:\?|$)/.test(url)
          : failedAsset === 'runtime' ? /\/(?:src\/prototype\/runtime\.js|assets\/runtime-[^/]+\.js)(?:\?|$)/.test(url)
          : failedAsset === 'stylesheet' ? /\/(?:src\/prototype\/prototype\.css|assets\/runtime-[^/]+\.css)(?:\?|$)/.test(url)
          : image(failedAsset,url);
        return blocked ? route.abort() : route.continue();
      });
      await page.goto(base, {waitUntil:'domcontentloaded'});
      await page.locator('#startup-error').waitFor({state:'visible'});
      assert.equal(await page.locator('#ui-root').evaluate(el => el.inert), true);
      await page.unroute('**/*');
      await page.getByRole('button',{name:'Retry',exact:true}).click();
      await page.waitForFunction(() => !document.body.dataset.startup);
      await context.close();
    }
    fs.writeFileSync(`${output}/results.json`,JSON.stringify({base,results,errorsAndRetry:['studio','chip-blue','entry','runtime','stylesheet']},null,2));
    console.log('Loading browser PASS: 6 viewports through 2560px, stable bar and clipped fill at 0/8/50/100, reduced motion, staged decode, visible minimum, dependency errors and Retry.');
  } finally { await browser?.close(); if(server) await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
