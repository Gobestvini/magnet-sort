const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {route,keyboardPlace,readyTools}=require('./v4-browser-check.cjs');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:5175/';
const output=process.env.AUDIO_OUTPUT||'artifacts/audio';

// Observe real Web Audio without replacing synthesis, granting autoplay or adding a production hook.
async function probe(page){
  await page.addInitScript(()=>{
    const Original=window.AudioContext;
    const contexts=[],timers=new Set();
    const nativeSet=window.setInterval,nativeClear=window.clearInterval;
    window.setInterval=(callback,delay,...args)=>{const id=nativeSet(callback,delay,...args);if(delay===100)timers.add(id);return id;};
    window.clearInterval=id=>{timers.delete(id);nativeClear(id);};
    class ObservedAudioContext extends Original{
      constructor(...args){super(...args);this.probeVoices=new Set();this.probeAnalyser=this.createAnalyser();this.probeAnalyser.fftSize=2048;
        this.probeAnalyser.connect(this.destination);contexts.push(this);}
      createDynamicsCompressor(){const node=super.createDynamicsCompressor(),connect=node.connect.bind(node);
        node.connect=(destination,...args)=>connect(destination===this.destination?this.probeAnalyser:destination,...args);return node;}
      createOscillator(){const oscillator=super.createOscillator();this.probeVoices.add(oscillator);
        oscillator.addEventListener('ended',()=>this.probeVoices.delete(oscillator),{once:true});return oscillator;}
    }
    window.AudioContext=ObservedAudioContext;
    window.__audioProbe=()=>({contexts:contexts.length,states:contexts.map(c=>c.state),voices:contexts.reduce((sum,c)=>sum+(c.state==='closed'?0:c.probeVoices.size),0),timers:timers.size,
      rms:contexts.reduce((sum,c)=>{if(c.state!=='running')return sum;const data=new Float32Array(2048);c.probeAnalyser.getFloatTimeDomainData(data);return sum+Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length);},0)});
  });
}
async function ready(page){
  await page.bringToFront();await page.waitForFunction(()=>!document.body.dataset.startup&&!document.querySelector('.loading-screen'));
  if(await page.getByRole('button',{name:'Resume',exact:true}).count())await page.getByRole('button',{name:'Resume',exact:true}).click();
}
async function pause(page){await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor();}
async function levelState(page){return page.evaluate(()=>window.gameDebug?.snapshot());}
async function setVolume(page,label,value){const slider=page.getByRole('slider',{name:label+' volume',exact:true});await slider.fill(String(value));}

async function offlineSignal(page,preview=false){
  const source=fs.readFileSync('src/prototype/audio-score.js','utf8');
  const result=await page.evaluate(async({source,preview})=>{
    const module=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
    const {MUSIC_NOTES,MUSIC_DURATION,createAudioMix,scheduleTone,cueNotes}=module;
    async function render(music,sfx,duration){
      const rate=22050,context=new OfflineAudioContext(1,Math.ceil(duration*rate),rate),mix=createAudioMix(context);
      mix.music.gain.value=music;mix.sfx.gain.value=sfx;
      for(let cycle=0;cycle<Math.ceil(duration/MUSIC_DURATION);cycle++)for(const note of MUSIC_NOTES){
        const at=.02+cycle*MUSIC_DURATION+note.at;if(at<duration)scheduleTone(context,mix.music,note,at);
      }
      if(sfx)for(let at=1;at<Math.min(duration,5);at+=.2)for(const note of cueNotes(at<2?'place':at<3?'collect':'won'))scheduleTone(context,mix.sfx,note,at+note.at);
      const buffer=await context.startRendering(),data=buffer.getChannelData(0);
      let peak=0,total=0,finite=true;for(const sample of data){peak=Math.max(peak,Math.abs(sample));total+=sample*sample;if(!Number.isFinite(sample))finite=false;}
      const metrics={peak,rms:Math.sqrt(total/data.length),finite};
      return {metrics,data,rate};
    }
    const music=await render(.35,0,6),sfx=await render(0,.7,6),muted=await render(0,0,6),dense=await render(1,1,6);
    const output={music:music.metrics,sfx:sfx.metrics,muted:muted.metrics,dense:dense.metrics};
    if(preview){
      // Two complete cycles plus a separate SFX reel, rendered by the exact game patches.
      const song=await render(.65,0,MUSIC_DURATION*2+.3);
      const samples=song.data;
      const seam=Math.round((MUSIC_DURATION+.02)*song.rate);output.seamStep=Math.abs(samples[seam]-samples[seam-1]);
      function wav(data,rate){
        const bytes=new Uint8Array(44+data.length*2),view=new DataView(bytes.buffer),text=(at,value)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};
        text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,data.length*2,true);
        for(let i=0;i<data.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
        let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);
      }
      output.preview=wav(song.data,song.rate);
      const context=new OfflineAudioContext(1,22050*18,22050),mix=createAudioMix(context);mix.music.gain.value=0;mix.sfx.gain.value=.7;
      ['ui','select','place','reject','move','collect','arrive','spawn','queue','won','lost'].forEach((kind,i)=>cueNotes(kind).forEach(note=>scheduleTone(context,mix.sfx,note,.2+i*1.5+note.at)));
      const reel=await context.startRendering();output.effects=wav(reel.getChannelData(0),22050);
    }
    return output;
  },{source,preview});
  for(const name of ['music','sfx','muted','dense']){assert.equal(result[name].finite,true);assert.ok(result[name].peak<.98,`${name} must not clip`);}
  assert.ok(result.music.rms>.003);assert.ok(result.sfx.rms>.001);assert.equal(result.muted.peak,0);
  if(result.preview){fs.writeFileSync(path.join(output,'little-orbits-two-loops.wav'),Buffer.from(result.preview,'base64'));fs.writeFileSync(path.join(output,'effects-reel.wav'),Buffer.from(result.effects,'base64'));delete result.preview;delete result.effects;assert.ok(result.seamStep<.02);}
  return result;
}

async function uiFlow(browser,viewport,touch,play){
  const planned=play?await route():null;
  const page=await browser.newPage({viewport,hasTouch:touch,isMobile:touch,reducedMotion:play?'no-preference':'reduce'}),errors=[];
  await probe(page);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?seed='+(planned?.seed??1));await ready(page);
  assert.equal((await page.evaluate(()=>__audioProbe())).contexts,0,'no context before a gesture');
  const initial=await levelState(page),dev=Boolean(initial);
  await page.locator('.magnet-tool').first()[touch?'tap':'click']();
  await page.waitForFunction(()=>__audioProbe().states.includes('running'));
  await page.waitForFunction(()=>__audioProbe().rms>.001);
  if(dev)assert.equal((await levelState(page)).audio.journal.filter(c=>c.kind==='select').length,1,'pointerdown/click deduped');
  await pause(page);await page.waitForTimeout(250);
  assert.equal((await page.evaluate(()=>__audioProbe())).timers,0);
  assert.ok((await page.evaluate(()=>__audioProbe())).rms<.0001,'pause is silent after UI cue');
  const musicButton=page.getByRole('button',{name:'Music',exact:true}),soundsButton=page.getByRole('button',{name:'Sounds',exact:true});
  await musicButton.click();await soundsButton.click();await setVolume(page,'Music',24);await setVolume(page,'Sounds',58);
  assert.equal(await musicButton.getAttribute('aria-pressed'),'false');assert.equal(await soundsButton.getAttribute('aria-pressed'),'false');
  await page.reload();await ready(page);assert.equal((await page.evaluate(()=>__audioProbe())).contexts,0);
  await pause(page);assert.equal(await musicButton.getAttribute('aria-pressed'),'false');assert.equal(await page.getByRole('slider',{name:'Music volume',exact:true}).inputValue(),'24');
  await soundsButton.click();await page.waitForFunction(()=>__audioProbe().states.includes('running'));
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  assert.equal((await page.evaluate(()=>__audioProbe())).timers,0,'SFX only does not schedule music');
  await pause(page);await musicButton.click();await soundsButton.click();
  await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForFunction(()=>__audioProbe().rms>.001);
  await pause(page);await soundsButton.click();
  // Range input keeps focus through rerenders; arrows adjust volume without a move.
  const slider=page.getByRole('slider',{name:'Music volume',exact:true});await slider.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await slider.inputValue(),'25');assert.equal(await slider.evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('Tab');assert.equal(await soundsButton.evaluate(n=>n===document.activeElement),true);
  await page.getByRole('button',{name:'Close pause',exact:true}).focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).evaluate(n=>n===document.activeElement),true);
  await setVolume(page,'Music',0);await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForTimeout(220);
  assert.equal((await page.evaluate(()=>__audioProbe())).timers,0);assert.ok((await page.evaluate(()=>__audioProbe())).rms<.0001,'zero music volume is silent');
  await pause(page);await setVolume(page,'Music',25);
  await page.waitForTimeout(350);
  const geometry=await page.locator('.audio-toggle').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height};}));
  assert.ok(geometry.every(r=>r.width>=44&&r.height>=44));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,`pause-${viewport.width}x${viewport.height}.png`),fullPage:true});
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  if(play){
    if(dev){
      const before=(await levelState(page)).state;
      await page.locator('.magnet-tool').first().click();await keyboardPlace(page,before.stacks[0].cell);
      assert.equal((await levelState(page)).state.turn,0);assert.ok((await levelState(page)).audio.journal.some(c=>c.kind==='reject'));
      await readyTools(page);await pause(page);await page.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).click();
      const action=planned.actions[0],tool=page.locator(`[data-magnet-color="${action.color}"]`),box=await tool.boundingBox();
      const target=await page.evaluate(cell=>gameDebug.screenPosition(cell),action.cell);
      const selectCount=(await levelState(page)).audio.journal.filter(c=>c.kind==='select').length;
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:8});await page.mouse.up();
      assert.equal((await levelState(page)).state.turn,1);assert.equal((await levelState(page)).audio.journal.filter(c=>c.kind==='select').length,selectCount+1,'drag has one selection sound');
      await readyTools(page);await pause(page);await page.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).click();
      const home=await page.locator('.magnet-tool').first().boundingBox(),rejectCount=(await levelState(page)).audio.journal.filter(c=>c.kind==='reject').length;
      await page.mouse.move(home.x+home.width/2,home.y+home.height/2);await page.mouse.down();await page.mouse.move(1,1,{steps:5});await page.mouse.up();
      assert.equal((await levelState(page)).state.turn,0);assert.equal((await levelState(page)).audio.journal.filter(c=>c.kind==='reject').length,rejectCount,'drop outside is a silent cancellation');
      await pause(page);await page.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).click();
    }
    let turn=0;
    for(const action of planned.actions){await readyTools(page);await page.locator(`[data-magnet-color="${action.color}"]`).click();await keyboardPlace(page,action.cell);assert.equal(Number(await page.locator('.moves-panel strong').textContent()),++turn,'planned action must be accepted');}
    await page.getByRole('region',{name:'Result',exact:true}).waitFor({timeout:30000});
    if(dev){
      const cues=(await levelState(page)).audio.journal;assert.equal(cues.filter(c=>c.kind==='won').length,1);assert.ok(cues.some(c=>c.kind==='collect'));assert.ok(cues.some(c=>c.kind==='arrive'));assert.ok(cues.some(c=>c.kind==='spawn'));assert.ok(cues.some(c=>c.kind==='queue'));
      await page.setViewportSize({width:viewport.width-10,height:viewport.height});assert.equal((await levelState(page)).audio.journal.filter(c=>c.kind==='won').length,1);
    }
    await page.getByRole('button',{name:'Next level',exact:true}).click();
    assert.match(await page.locator('.level-badge').textContent(),/2/);assert.equal((await page.evaluate(()=>__audioProbe())).contexts,1);
    await pause(page);assert.equal(await page.getByRole('slider',{name:'Music volume',exact:true}).inputValue(),'25');assert.equal(await page.getByRole('slider',{name:'Sounds volume',exact:true}).inputValue(),'58');
    await page.getByRole('button',{name:'Resume',exact:true}).click();
  }
  for(let i=0;i<(play?20:2);i++){
    await pause(page);await page.getByRole('dialog',{name:'Paused',exact:true}).getByRole('button',{name:'Restart',exact:true}).click();await page.waitForTimeout(30);
    const probeState=await page.evaluate(()=>__audioProbe());assert.equal(probeState.contexts,1);assert.ok(probeState.timers<=1);assert.ok(probeState.voices<=16);
  }
  if(dev){
    const preferences=(await levelState(page)).audio.settings;
    for(let index=0;index<12;index++){
      await page.evaluate(index=>gameDebug.loadLevel(index,1),index);const current=await levelState(page);
      assert.equal(current.levelIndex,index);assert.equal(current.audio.musicLoops,1);assert.deepEqual(current.audio.settings,preferences);
      assert.equal((await page.evaluate(()=>__audioProbe())).contexts,1);
    }
    // Headless tabs do not reliably change native focus. Exercise the browser event boundary explicitly.
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(40);
    assert.equal((await levelState(page)).audio.blocked,true,'blur blocks audio');assert.equal((await page.evaluate(()=>__audioProbe())).timers,0);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal((await levelState(page)).paused,true,'focus does not automatically resume');await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal((await levelState(page)).audio.blocked,true,'hidden blocks audio');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal((await levelState(page)).paused,true);await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.evaluate(()=>gameDebug.setPlatformPaused(true));await page.waitForTimeout(60);
    assert.equal((await levelState(page)).audio.blocked,true);assert.equal((await page.evaluate(()=>__audioProbe())).timers,0);
    await page.getByRole('button',{name:'Resume',exact:true}).click();assert.equal((await levelState(page)).paused,true,'platform pause cannot be overridden by UI');
    await page.evaluate(()=>gameDebug.setPlatformPaused(false));
    const disposed=await page.evaluate(()=>{const snapshot=gameDebug.snapshot;gameDebug.dispose();return snapshot().audio;});
    assert.equal(disposed.activeVoices,0);assert.equal(disposed.disposed,true);await page.waitForTimeout(50);
    const end=await page.evaluate(()=>__audioProbe());assert.equal(end.timers,0);assert.equal(end.voices,0);assert.deepEqual(end.states,['closed']);
  }
  assert.deepEqual(errors,[]);await page.close();return {viewport,dev,touch};
}
async function failureFlow(browser){
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.AudioContext=undefined;window.webkitAudioContext=undefined;
    Object.defineProperty(window,'localStorage',{get(){throw Error('storage denied by test');}});
  });
  const planned=await route();await page.goto(base+'?seed='+planned.seed);await ready(page);
  const action=planned.actions[0];await page.locator(`[data-magnet-color="${action.color}"]`).click();await keyboardPlace(page,action.cell);await readyTools(page);
  assert.equal(await page.locator('.moves-panel strong').textContent(),'1');
  await pause(page);await setVolume(page,'Music',42);assert.equal(await page.getByRole('slider',{name:'Music volume',exact:true}).inputValue(),'42');
  await page.getByRole('button',{name:'Resume',exact:true}).click();assert.deepEqual(errors,[]);await page.close();
}
async function lossFlow(browser){
  const {pathToFileURL}=require('node:url');
  const [{createV4State,applyV4Magnet},{canPlaceMagnet},{v4Levels}]=await Promise.all(['src/prototype/model-v4.js','src/prototype/model.js','src/prototype/levels-v4.js'].map(file=>import(pathToFileURL(path.resolve(file)).href)));
  let state=createV4State(v4Levels[0],3);const actions=[];
  for(let i=0;i<150&&!state.terminal;i++){const action={type:'placeMagnet',color:state.magnets[0],cell:state.cells.find(cell=>canPlaceMagnet(state,cell))};actions.push(action);state=applyV4Magnet(state,action).state;}
  assert.equal(state.terminal,'lost');
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];await probe(page);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?seed=3');await ready(page);
  for(const action of actions){await readyTools(page);await page.locator(`[data-magnet-color="${action.color}"]`).click();await keyboardPlace(page,action.cell);}
  await page.getByRole('heading',{name:'BOARD FULL',exact:true}).waitFor({timeout:30000});
  const snapshot=await levelState(page);if(snapshot)assert.equal(snapshot.audio.journal.filter(c=>c.kind==='lost').length,1);
  await page.getByRole('button',{name:'Try again',exact:true}).click();assert.equal(await page.locator('.moves-panel strong').textContent(),'0');
  assert.equal((await page.evaluate(()=>__audioProbe())).contexts,1);assert.deepEqual(errors,[]);await page.close();
}
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--autoplay-policy=no-user-gesture-required'],args:['--autoplay-policy=user-gesture-required']});
  try{
    const signalPage=await browser.newPage();await signalPage.goto(base);await ready(signalPage);
    const signal=await offlineSignal(signalPage,process.env.AUDIO_PREVIEW==='1');await signalPage.close();
    if(process.env.AUDIO_PREVIEW_ONLY!=='1'){
      const results=[];
      for(const [viewport,touch,play] of [[{width:320,height:720},true,false],[{width:390,height:844},true,false],[{width:844,height:390},true,false],[{width:1280,height:800},false,true]]){
        if(process.env.AUDIO_VIEWPORT&&String(viewport.width)!==process.env.AUDIO_VIEWPORT)continue;
        results.push(await uiFlow(browser,viewport,touch,play));
      }
      await lossFlow(browser);
      await failureFlow(browser);
      fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({base,signal,results},null,2));
    }else fs.writeFileSync(path.join(output,'signal.json'),JSON.stringify(signal,null,2));
    console.log('Audio signal and UI checks passed:',JSON.stringify(signal));
  }finally{await browser.close();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={probe,offlineSignal};
