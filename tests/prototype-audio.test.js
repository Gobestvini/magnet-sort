import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrototypeAudio, timelineAudioCues, MAX_AUDIO_VOICES, MAX_SFX_VOICES } from '../src/prototype/audio.js';
import { DEFAULT_AUDIO_SETTINGS } from '../src/prototype/audio-settings.js';
import { MUSIC_NOTES, MUSIC_DURATION } from '../src/prototype/audio-score.js';
import { makeTransferTimeline } from '../src/prototype/motion.js';
import { createV4State, applyV4Magnet } from '../src/prototype/model-v4.js';
import { v4Levels } from '../src/prototype/levels-v4.js';
import { canPlaceMagnet } from '../src/prototype/model.js';

function environment({rejectResume=false,deferred=false}={}){
  const contexts=[],timers=new Set(),nodes=[];let finishResume;
  const param=()=>({value:0,cancelAndHoldAtTime(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
  const node=()=>{const value={gain:param(),frequency:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){this.disconnected=true;}};nodes.push(value);return value;};
  class AudioContext {
    constructor(){this.state='suspended';this.currentTime=0;this.destination={};contexts.push(this);}
    createGain(){return node();}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}
    createOscillator(){const value=node();value.start=at=>{value.startAt=at;};value.stop=at=>{value.stopAt=at??this.currentTime;};return value;}
    resume(){if(rejectResume)return Promise.reject(Error('blocked'));if(deferred)return new Promise(resolve=>{finishResume=()=>{this.state='running';resolve();};});this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  return {AudioContext,contexts,nodes,timers,setInterval:callback=>{timers.add(callback);return callback;},clearInterval:callback=>timers.delete(callback),
    advance(time){contexts[0].currentTime=time;for(const n of nodes)if(n.stopAt<=time)n.onended?.();},finish:()=>finishResume?.()};
}
async function active(options={}){
  const env=environment(options),audio=createPrototypeAudio({...env,settings:{...DEFAULT_AUDIO_SETTINGS,musicEnabled:false},debug:true});
  audio.setLifecycle({blocked:false});await audio.unlockFromGesture();audio.beginRun(1);return {env,audio};
}
const kinds=audio=>audio.snapshot().journal.map(c=>c.kind);

test('context is lazy, blocked or fully muted input cannot unlock, unavailable audio fails softly',async()=>{
  const env=environment(),audio=createPrototypeAudio(env);
  assert.equal(audio.snapshot().contextCreated,false);assert.equal(await audio.unlockFromGesture(),false);
  audio.setLifecycle({blocked:false});audio.setSettings({...DEFAULT_AUDIO_SETTINGS,musicEnabled:false,sfxEnabled:false});
  assert.equal(await audio.unlockFromGesture(),false);assert.equal(env.contexts.length,0);
  const unavailable=createPrototypeAudio({AudioContext:null});unavailable.setLifecycle({blocked:false});
  assert.equal(await unavailable.unlockFromGesture(),false);assert.equal(unavailable.playUi(),false);
  const broken=createPrototypeAudio({AudioContext:class{constructor(){throw Error('not supported');}}});broken.setLifecycle({blocked:false});
  assert.equal(await broken.unlockFromGesture(),false);audio.dispose();unavailable.dispose();broken.dispose();
});

test('rejected resume can be retried and late completion cannot resurrect disposed audio',async()=>{
  const env=environment({rejectResume:true}),audio=createPrototypeAudio(env);audio.setLifecycle({blocked:false});
  assert.equal(await audio.unlockFromGesture(),false);assert.equal(env.contexts.length,1);
  env.contexts[0].resume=function(){this.state='running';return Promise.resolve();};
  assert.equal(await audio.unlockFromGesture(),true);audio.dispose();
  const delayed=environment({deferred:true}),other=createPrototypeAudio(delayed);other.setLifecycle({blocked:false});
  const pending=other.unlockFromGesture();other.dispose();delayed.finish();assert.equal(await pending,false);
  assert.equal(other.snapshot().timers,0);assert.equal(other.snapshot().activeVoices,0);
});

test('one music scheduler retains position across pause, mute and 20 runs without duplicating loops',async()=>{
  const env=environment(),audio=createPrototypeAudio({...env,debug:true});audio.setLifecycle({blocked:false});await audio.unlockFromGesture();
  const preferences={...DEFAULT_AUDIO_SETTINGS,musicVolume:.24,sfxVolume:.58};audio.setSettings(preferences);
  assert.equal(env.timers.size,1);env.advance(1.25);
  audio.setLifecycle({paused:true});const position=audio.snapshot().musicPosition;assert.ok(position>1);
  assert.equal(env.timers.size,0);assert.equal(audio.playGame('place'),false);assert.equal(audio.playUi(),true);
  env.advance(5);audio.setLifecycle({paused:false});assert.ok(Math.abs(audio.snapshot().musicPosition-position)<.03);
  for(let run=0;run<20;run++){
    audio.beginRun(run);audio.setLifecycle({paused:true});audio.setLifecycle({paused:false});
    assert.deepEqual(audio.snapshot().settings,preferences);
    assert.equal(env.contexts.length,1);assert.equal(env.timers.size,1);assert.ok(audio.snapshot().activeVoices<=MAX_AUDIO_VOICES);
    env.advance(5+run);
  }
  audio.setSettings({...DEFAULT_AUDIO_SETTINGS,musicEnabled:false});assert.equal(env.timers.size,0);
  assert.equal(audio.playUi(),true);
  audio.setLifecycle({blocked:true});assert.equal(audio.playUi(),false);assert.equal(audio.snapshot().contextState,'suspended');
  audio.dispose();audio.dispose();assert.equal(audio.snapshot().activeVoices,0);assert.equal(env.timers.size,0);
  assert.ok(env.nodes.every(n=>n.disconnected));
});

test('timeline intersections are idempotent, silent while paused, and skip old events after mute or long frames',async()=>{
  const {audio,env}=await active();
  const timeline={segments:[{type:'unitMoved',end:.1},{type:'unitMoved',end:.2},{type:'unitsCleared',accentStart:.3,flights:[{end:.5},{end:.6}]},{type:'stackSpawned',start:.8},{type:'magnetsChanged',start:1}]};
  audio.beginTimeline(timeline,1);env.advance(.1);audio.advanceTimeline(.1);audio.advanceTimeline(.1);audio.advanceTimeline(.05);
  assert.deepEqual(kinds(audio),['move']);
  audio.setLifecycle({paused:true});audio.advanceTimeline(.2);assert.deepEqual(kinds(audio),['move']);
  audio.setLifecycle({paused:false});env.advance(.2);audio.advanceTimeline(.2);assert.deepEqual(kinds(audio),['move','move']);
  audio.setSettings({...DEFAULT_AUDIO_SETTINGS,musicEnabled:false,sfxEnabled:false});env.advance(.5);audio.advanceTimeline(.5);
  audio.setSettings({...DEFAULT_AUDIO_SETTINGS,musicEnabled:false});await audio.unlockFromGesture();audio.advanceTimeline(.5);
  assert.deepEqual(kinds(audio),['move','move']);
  env.advance(1);audio.advanceTimeline(1);assert.ok(kinds(audio).includes('queue'));assert.ok(!kinds(audio).includes('collect'));
  assert.ok(audio.snapshot().journal.length<=4);audio.dispose();
});

test('voice caps, rate limits and result fanfare remain bounded and reset dedupe by run',async()=>{
  const {audio,env}=await active();
  for(let i=0;i<100;i++)audio.playGame('place');assert.ok(audio.snapshot().sfxVoices<=MAX_SFX_VOICES);
  env.advance(2);audio.playResult('won');audio.playResult('won');audio.playResult('lost');
  assert.equal(kinds(audio).filter(k=>k==='won').length,1);assert.equal(kinds(audio).filter(k=>k==='lost').length,0);
  env.advance(4);audio.beginRun(2);audio.playResult('lost');assert.equal(kinds(audio).filter(k=>k==='lost').length,1);
  audio.setSettings({...DEFAULT_AUDIO_SETTINGS,musicEnabled:false,sfxEnabled:false});assert.equal(audio.playUi(),false);audio.dispose();
});

test('score has a fixed 80-second loop, distinct A/B phrases and finite synthesis parameters',()=>{
  assert.equal(MUSIC_DURATION,80);assert.ok(MUSIC_NOTES.length>250);
  assert.ok(MUSIC_NOTES.every(n=>n.at>=0&&n.at+n.duration<=MUSIC_DURATION&&Number.isFinite(n.midi)&&n.gain>0&&n.gain<.2));
  assert.notDeepEqual(MUSIC_NOTES.filter(n=>n.instrument==='mallet'&&n.at<20).map(n=>n.midi),MUSIC_NOTES.filter(n=>n.instrument==='mallet'&&n.at>=40&&n.at<60).map(n=>n.midi));
});

test('audio on/off replay preserves all 12 levels model events and handles normal/reduced cue boundaries',async()=>{
  const {audio,env}=await active();
  for(const level of v4Levels){
    let state=createV4State(level,1),silent=createV4State(level,1);audio.beginRun(level.number??level.id);
    for(let turn=0;turn<3&&!state.terminal;turn++){
      const action={type:'placeMagnet',color:state.magnets[0],cell:state.cells.find(c=>canPlaceMagnet(state,c))};
      const result=applyV4Magnet(state,action),expected=applyV4Magnet(silent,action);
      for(const reduced of [false,true]){
        const timeline=makeTransferTimeline(state,result,reduced),cues=timelineAudioCues(timeline);
        assert.ok(cues.every(c=>c.at>=0&&c.at<=timeline.duration));
        audio.beginTimeline(timeline,result.state.turn);
        for(let time=0;time<=timeline.duration;time+=.016){env.advance(100+turn+time);audio.advanceTimeline(time);}
      }
      assert.deepEqual(result,expected);state=result.state;silent=expected.state;
    }
  }
  audio.dispose();
});
