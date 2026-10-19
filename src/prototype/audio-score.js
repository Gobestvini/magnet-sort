// Original composition for Magnet Sort, "Little Orbits", 2026-10-19.
// D major, 32 bars in 4/4, A / A' / B / A-return. No recordings or random notes.
export const MUSIC_BPM = 96;
export const BEAT = 60 / MUSIC_BPM;
export const MUSIC_DURATION = 32 * 4 * BEAT;
const harmony = [
  { bass: 38, pad: [57, 61, 64] }, // Dmaj9
  { bass: 35, pad: [54, 57, 62] }, // Bm7
  { bass: 31, pad: [54, 57, 62] }, // Gmaj9
  { bass: 33, pad: [52, 59, 61] }, // Aadd9
];
// Beat offset, MIDI pitch, beat length. Rests are intentional breathing space.
const phraseA = [
  [[0,74,1],[1.5,78,.5],[2,81,1],[3.5,78,.5]],
  [[0,78,1.5],[2,76,.5],[2.75,74,.75]],
  [[.5,74,.5],[1,78,1],[2.5,81,.5],[3,83,.75]],
  [[0,81,1],[1.5,76,.5],[2.5,73,1]],
  [[0,74,.75],[1,76,.5],[2,78,.75],[3,81,.75]],
  [[.5,78,1],[2,74,.5],[3,73,.5]],
  [[0,71,1],[1.5,74,.5],[2,78,1]],
  [[0,76,1.5],[2,73,1],[3.5,69,.5]],
];
const phraseB = [
  [[0,81,1],[1.5,83,.5],[2.5,85,1]],
  [[0,83,1.5],[2,81,.5],[3,78,.75]],
  [[.5,83,.5],[1.5,81,.5],[2.5,78,1]],
  [[0,80,1],[1.5,76,.5],[2.5,73,1]],
  [[0,81,.75],[1,78,.5],[2,76,1]],
  [[0,78,1],[1.5,74,.5],[2.5,73,.75]],
  [[0,74,1.5],[2,71,1]],
  [[0,73,1],[1.5,76,.5],[2.5,69,1]],
];

function compose() {
  const notes = [];
  const add = (bar, beat, midi, length, instrument, gain) => notes.push({
    at: (bar * 4 + beat) * BEAT, midi, duration: length * BEAT, instrument, gain,
  });
  for (let bar = 0; bar < 32; bar++) {
    const chord = harmony[bar % 4];
    chord.pad.forEach((midi, i) => add(bar, i * .025, midi, 3.6, 'pad', .024));
    add(bar, 0, chord.bass, 1.45, 'bass', .095);
    add(bar, 2.5, chord.bass + (bar % 4 === 3 ? 7 : 12), .85, 'bass', .055);
    const phrase = (bar >= 16 && bar < 24 ? phraseB : phraseA)[bar % 8];
    for (const [beat, midi, length] of phrase) add(bar, beat, midi, length, 'mallet', .11);
    // A' adds a quiet answering note; final bar leaves room for the return to D.
    if (bar >= 8 && bar < 16 && bar % 2 === 0) add(bar, 3.5, chord.pad[2] + 12, .35, 'mallet', .045);
    add(bar, 0, 38, .20, 'pulse', .065);
    if (bar % 8 !== 7) {
      add(bar, 2, 38, .15, 'pulse', .045);
      add(bar, 1, 78, .08, 'brush', .012);
      add(bar, 3, 78, .08, 'brush', .012);
    }
  }
  return Object.freeze(notes.sort((a, b) => a.at - b.at).map(Object.freeze));
}
export const MUSIC_NOTES = compose();

const cues = {
  ui: [[0,76,.065,.075,'mallet']], select: [[0,74,.10,.08,'mallet'],[.055,81,.12,.05,'mallet']],
  place: [[0,50,.12,.11,'bass'],[.035,74,.15,.07,'mallet']],
  reject: [[0,55,.11,.065,'bass'],[.07,52,.10,.05,'bass']],
  move: [[0,74,.065,.055,'mallet']],
  collect: [[0,74,.20,.09,'mallet'],[.055,78,.24,.075,'mallet'],[.11,81,.28,.065,'mallet']],
  arrive: [[0,81,.10,.04,'mallet']], spawn: [[0,62,.10,.07,'mallet']], queue: [[0,69,.09,.045,'mallet']],
  won: [[0,74,.22,.11,'mallet'],[.16,78,.22,.10,'mallet'],[.32,81,.25,.10,'mallet'],[.54,86,.65,.10,'mallet'],[.54,74,.65,.055,'pad']],
  lost: [[0,69,.28,.08,'mallet'],[.24,66,.28,.075,'mallet'],[.48,62,.55,.07,'mallet']],
};
export const CUE_NAMES = Object.freeze(Object.keys(cues));
export function cueNotes(name, variant = 0) {
  return (cues[name] ?? []).map(([at, midi, duration, gain, instrument]) => ({
    at, midi: midi + (name === 'arrive' ? [0,2,5,7][variant % 4] : name === 'move' ? [0,2,4][variant % 3] : 0), duration, gain, instrument,
  }));
}

export function createAudioMix(context) {
  const music = context.createGain(), sfx = context.createGain(), master = context.createGain();
  const musicFilter = context.createBiquadFilter(), sfxFilter = context.createBiquadFilter();
  musicFilter.type = sfxFilter.type = 'lowpass'; musicFilter.frequency.value = 4200; sfxFilter.frequency.value = 5200;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 6; limiter.attack.value = .003; limiter.release.value = .15;
  master.gain.value = .85;
  music.connect(musicFilter); musicFilter.connect(master); sfx.connect(sfxFilter); sfxFilter.connect(master);
  master.connect(limiter); limiter.connect(context.destination);
  return { music, sfx, master, dispose() { for (const node of [music,sfx,master,musicFilter,sfxFilter,limiter]) node.disconnect(); } };
}

export function rampGain(param, value, now, duration = .018) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
  else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
  param.linearRampToValueAtTime(value, now + duration);
}

// Each note owns one oscillator and its envelope; callers own channel and timing.
export function scheduleTone(context, destination, note, when) {
  const source = context.createOscillator(), envelope = context.createGain();
  const end = when + note.duration;
  source.type = note.instrument === 'bass' || note.instrument === 'brush' ? 'triangle' : 'sine';
  const frequency = 440 * 2 ** ((note.midi - 69) / 12);
  source.frequency.setValueAtTime(frequency, when);
  if (note.instrument === 'pulse') source.frequency.exponentialRampToValueAtTime(38, end);
  const attack = note.instrument === 'pad' ? .14 : .006;
  const peak = when + Math.min(attack, note.duration * .2);
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(note.gain, peak);
  if (note.instrument === 'pad') {
    envelope.gain.setValueAtTime(note.gain * .8, Math.max(peak, end - .22));
    envelope.gain.linearRampToValueAtTime(0, end);
  } else {
    envelope.gain.exponentialRampToValueAtTime(.00005, end);
    envelope.gain.linearRampToValueAtTime(0, end + .008);
  }
  source.connect(envelope); envelope.connect(destination);
  source.start(when); source.stop(end + .012);
  return { source, envelope, end: end + .012 };
}
