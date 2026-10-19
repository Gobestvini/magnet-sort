import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings, createAudioSettings } from '../src/prototype/audio-settings.js';

test('audio preferences sanitize each field without sharing legacy progress', () => {
  assert.deepEqual(normalizeAudioSettings(null), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(normalizeAudioSettings([]), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(normalizeAudioSettings({musicEnabled:false,sfxEnabled:0,musicVolume:NaN,sfxVolume:Infinity}), {...DEFAULT_AUDIO_SETTINGS,musicEnabled:false});
  assert.deepEqual(normalizeAudioSettings({musicVolume:-.1,sfxVolume:1.1}), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(normalizeAudioSettings({musicVolume:0,sfxVolume:1,extra:'ignored'}), {...DEFAULT_AUDIO_SETTINGS,musicVolume:0,sfxVolume:1});
});

test('settings read once, persist independently and preserve volume across toggles', () => {
  const data = new Map([[AUDIO_STORAGE_KEY, JSON.stringify({musicEnabled:false,musicVolume:.24})],['magnet-sort.progress','untouched']]);
  let reads=0,writes=0;
  const storage={getItem:key=>{reads++;return data.get(key);},setItem:(key,value)=>{writes++;data.set(key,value);}};
  const store=createAudioSettings(()=>storage);
  assert.equal(store.get().musicVolume,.24);
  store.get().sfxEnabled=false;
  assert.equal(store.get().sfxEnabled,true);
  store.update({sfxEnabled:false});store.update({musicEnabled:true});store.update({musicEnabled:false});
  assert.equal(reads,1);assert.equal(writes,3);
  assert.deepEqual(store.get(),{...DEFAULT_AUDIO_SETTINGS,musicEnabled:false,musicVolume:.24,sfxEnabled:false});
  assert.deepEqual(createAudioSettings(()=>storage).get(),store.get());
  assert.equal(data.get('magnet-sort.progress'),'untouched');
});

test('corrupted JSON and unavailable storage leave working in-memory settings', () => {
  for(const getter of [()=>{throw Error('denied');},()=>({getItem:()=>'{broken',setItem:()=>{throw Error('quota');}})]){
    const store=createAudioSettings(getter);
    assert.deepEqual(store.get(),DEFAULT_AUDIO_SETTINGS);
    assert.equal(store.update({musicVolume:.2}).musicVolume,.2);
    assert.equal(store.update({sfxEnabled:false}).sfxEnabled,false);
  }
});
