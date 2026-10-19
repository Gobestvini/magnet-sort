import { normalizeAudioSettings } from './audio-settings.js';
import { MUSIC_NOTES, MUSIC_DURATION, cueNotes, createAudioMix, scheduleTone, rampGain } from './audio-score.js';

export const MAX_AUDIO_VOICES = 16;
export const MAX_SFX_VOICES = 8;
const LOOKAHEAD = .25, STALE_CUE = .18;

export function timelineAudioCues(timeline) {
  const cues = [];
  timeline.segments.forEach((segment, index) => {
    const add = (kind, at, suffix = '', variant = index) => cues.push({ kind, at, id: `${index}:${kind}:${suffix}`, variant });
    if (segment.type === 'unitMoved') add('move', segment.end);
    else if (segment.type === 'unitsCleared') {
      add('collect', segment.accentStart);
      segment.flights.forEach((flight, i) => add('arrive', flight.end, i, i));
    } else if (segment.type === 'stackSpawned') add('spawn', segment.start);
    else if (segment.type === 'magnetsChanged') add('queue', segment.start);
  });
  return cues.sort((a, b) => a.at - b.at);
}

export function createPrototypeAudio({
  AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  settings: initialSettings, debug = false,
  setInterval: startTimer = globalThis.setInterval, clearInterval: stopTimer = globalThis.clearInterval,
} = {}) {
  let settings = normalizeAudioSettings(initialSettings);
  let context = null, mix = null, disposed = false, unlocked = false, epoch = 0;
  let lifecycle = { paused: false, blocked: true };
  const voices = new Set(), journal = [];
  let timer = null, musicPlaying = false, musicPosition = 0, musicOrigin = 0, musicNext = 0;
  let duckUntil = 0, run = 0, turn = 0, resultPlayed = false;
  let cues = [], cueIndex = 0, cueTime = -1;
  const lastCueAt = new Map();

  const musicOn = () => settings.musicEnabled && settings.musicVolume > 0;
  const sfxOn = () => settings.sfxEnabled && settings.sfxVolume > 0;
  const running = () => !disposed && unlocked && context?.state === 'running';
  function record(kind, id) {
    if (!debug) return;
    journal.push({ kind, id, run, turn, at: context.currentTime });
    if (journal.length > 96) journal.shift();
  }
  function release(voice) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    try { voice.source.disconnect(); voice.envelope.disconnect(); } catch { /* Already released by the browser. */ }
  }
  function prune() { for (const voice of voices) if (voice.end <= context.currentTime) release(voice); }
  function stopVoices(channel) {
    if (!context) return;
    const now = context.currentTime;
    for (const voice of voices) {
      if (channel && voice.channel !== channel) continue;
      if (voice.stopping) continue;
      voice.stopping = true;
      try {
        rampGain(voice.envelope.gain, 0, now, .012);
        voice.source.stop(now + .014);
        voice.end = now + .014;
      } catch { release(voice); }
    }
  }
  function tone(note, channel, at) {
    prune();
    if (voices.size >= MAX_AUDIO_VOICES || (channel === 'sfx' && [...voices].filter(v => v.channel === 'sfx').length >= MAX_SFX_VOICES)) return false;
    let voice;
    try {
      voice = { ...scheduleTone(context, mix[channel], note, at), channel, stopping: false };
      voices.add(voice); voice.source.onended = () => release(voice);
      return true;
    } catch {
      if (voice) release(voice);
      return false;
    }
  }
  function locateMusic(position) {
    const cycle = Math.floor(position / MUSIC_DURATION), offset = position % MUSIC_DURATION;
    const index = MUSIC_NOTES.findIndex(note => note.at >= offset - .000001);
    return index < 0 ? (cycle + 1) * MUSIC_NOTES.length : cycle * MUSIC_NOTES.length + index;
  }
  function pumpMusic() {
    if (!musicPlaying || !running()) return;
    const now = context.currentTime, position = Math.max(0, now - musicOrigin);
    // A delayed timer skips old notes instead of catching up with an audible burst.
    musicNext = Math.max(musicNext, locateMusic(Math.max(0, position - .015)));
    while (true) {
      const note = MUSIC_NOTES[musicNext % MUSIC_NOTES.length];
      const at = musicOrigin + Math.floor(musicNext / MUSIC_NOTES.length) * MUSIC_DURATION + note.at;
      if (at > now + LOOKAHEAD) break;
      if (at >= now - .015) tone(note, 'music', Math.max(now + .003, at));
      musicNext++;
    }
  }
  function stopMusic() {
    if (musicPlaying) musicPosition = Math.max(0, context.currentTime - musicOrigin);
    musicPlaying = false;
    if (timer !== null) { stopTimer(timer); timer = null; }
    stopVoices('music');
  }
  function sync() {
    if (disposed || !context || !mix) return;
    const now = context.currentTime;
    const canMusic = running() && !lifecycle.blocked && !lifecycle.paused && musicOn();
    if (lifecycle.blocked || !sfxOn()) duckUntil = 0;
    const ducking = canMusic && duckUntil > now;
    rampGain(mix.music.gain, canMusic ? settings.musicVolume * (ducking ? .28 : 1) : 0, now);
    if (ducking) {
      mix.music.gain.setValueAtTime(settings.musicVolume * .28, duckUntil);
      mix.music.gain.linearRampToValueAtTime(settings.musicVolume, duckUntil + .2);
    }
    rampGain(mix.sfx.gain, !lifecycle.blocked && sfxOn() ? settings.sfxVolume : 0, now);
    if (!canMusic) stopMusic();
    else if (!musicPlaying) {
      musicPlaying = true; musicOrigin = now + .025 - musicPosition; musicNext = locateMusic(musicPosition);
      pumpMusic(); timer = startTimer(pumpMusic, 100);
    }
    if (lifecycle.blocked || !sfxOn()) { stopVoices('sfx'); duckUntil = 0; }
    // Channel mute finishes its gain ramp. Backgrounding can suspend immediately.
    if (lifecycle.blocked) {
      if (context.state === 'running') {
        try { void Promise.resolve(context.suspend()).catch(() => {}); } catch { /* Audio is already muted by the buses. */ }
      }
    }
  }
  function ensureContext() {
    if (disposed || lifecycle.blocked || (!musicOn() && !sfxOn()) || typeof AudioContext !== 'function') return false;
    if (!context) {
      try {
        context = new AudioContext(); mix = createAudioMix(context);
        mix.music.gain.value = mix.sfx.gain.value = 0;
        context.onstatechange = () => { if (!disposed) sync(); };
      } catch {
        try { void Promise.resolve(context?.close()).catch(() => {}); } catch { /* Optional audio initialization. */ }
        context = null; mix = null; return false;
      }
    }
    return true;
  }
  function unlockFromGesture() {
    if (!ensureContext()) return Promise.resolve(false);
    const generation = epoch;
    if (context.state === 'running') { unlocked = true; sync(); return Promise.resolve(true); }
    try {
      // resume must be invoked synchronously while the trusted input is active.
      const promise = context.resume();
      return Promise.resolve(promise).then(() => {
        if (disposed || generation !== epoch) return false;
        unlocked = context.state === 'running'; sync(); return unlocked;
      }, () => false);
    } catch { return Promise.resolve(false); }
  }
  function play(kind, { ui = false, id = kind, variant = 0 } = {}) {
    if (!running() || lifecycle.blocked || (!ui && lifecycle.paused) || !sfxOn()) return false;
    const now = context.currentTime;
    const throttle = kind === 'move' || kind === 'arrive' ? .04 : kind === 'spawn' || kind === 'queue' ? .08 : 0;
    if (now - (lastCueAt.get(kind) ?? -Infinity) < throttle) return false;
    let played = false;
    for (const note of cueNotes(kind, variant)) played = tone(note, 'sfx', now + .004 + note.at) || played;
    if (played) { lastCueAt.set(kind, now); record(kind, id); }
    return played;
  }
  function advanceTimeline(time) {
    if (disposed || lifecycle.blocked || lifecycle.paused || time <= cueTime) return;
    const pending = [];
    while (cueIndex < cues.length && cues[cueIndex].at <= time) {
      const cue = cues[cueIndex++];
      if (cue.at > cueTime && time - cue.at <= STALE_CUE) pending.push(cue);
    }
    // A long frame is allowed one recent cue per family, at most two total.
    const recent = [...new Map(pending.map(cue => [cue.kind, cue])).values()];
    recent.sort((a, b) => (a.kind === 'collect' ? -1 : b.kind === 'collect' ? 1 : b.at - a.at));
    for (const cue of recent.slice(0, 2)) play(cue.kind, { id: `${run}:${turn}:${cue.id}`, variant: cue.variant });
    cueTime = time;
  }
  function playResult(result) {
    if (resultPlayed || !['won', 'lost'].includes(result) || lifecycle.paused || lifecycle.blocked) return;
    resultPlayed = true;
    if (play(result, { id: `${run}:${result}` }) && musicPlaying) {
      duckUntil = context.currentTime + 1.3;
      rampGain(mix.music.gain, settings.musicVolume * .28, context.currentTime, .03);
      mix.music.gain.setValueAtTime(settings.musicVolume * .28, duckUntil);
      mix.music.gain.linearRampToValueAtTime(settings.musicVolume, duckUntil + .2);
    }
  }
  function beginRun(value) {
    run = value; turn = 0; resultPlayed = false; cues = []; cueIndex = 0; cueTime = -1;
    lastCueAt.clear(); duckUntil = 0; stopVoices('sfx'); sync();
  }
  function snapshot() {
    if (context) prune();
    return { settings: { ...settings }, contextCreated: Boolean(context), contextState: context?.state ?? 'unavailable',
      activeVoices: voices.size, sfxVoices: [...voices].filter(v => v.channel === 'sfx').length,
      timers: timer === null ? 0 : 1, musicLoops: Number(musicPlaying),
      musicPosition: (musicPlaying ? Math.max(0, context.currentTime - musicOrigin) : musicPosition) % MUSIC_DURATION,
      paused: lifecycle.paused, blocked: lifecycle.blocked, run, turn, disposed, journal: debug ? [...journal] : [] };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; epoch++; stopMusic();
    for (const voice of [...voices]) { try { voice.source.stop(); } catch { /* May have ended. */ } release(voice); }
    cues = []; journal.length = 0; lastCueAt.clear();
    if (context) {
      context.onstatechange = null;
      try { mix?.dispose(); } catch { /* Already disconnected. */ }
      try { void Promise.resolve(context.close()).catch(() => {}); } catch { /* Context may be closed. */ }
    }
  }
  return {
    unlockFromGesture, playUi: kind => play(kind ?? 'ui', { ui: true }), playGame: (kind, variant) => play(kind, { variant }), playResult,
    setSettings(value) { settings = normalizeAudioSettings(value); sync(); return { ...settings }; },
    setLifecycle(value) {
      if (Object.entries(value).every(([key, setting]) => lifecycle[key] === setting)) return;
      const wasPaused = lifecycle.paused;
      lifecycle = { ...lifecycle, ...value };
      if (lifecycle.paused && !wasPaused) { stopVoices('sfx'); duckUntil = 0; }
      sync();
    },
    beginRun,
    beginTimeline(timeline, value) { cues = timelineAudioCues(timeline); cueIndex = 0; cueTime = -1; turn = value; },
    advanceTimeline, snapshot, dispose,
  };
}
