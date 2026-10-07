const MAX_CUES_PER_ACTION = 8;
const CUES = {
  actionAccepted: { start: 300, end: 210, duration: 0.055, gain: 0.022, type: 'triangle' },
  tokenMoved: { start: 500, end: 250, duration: 0.09, gain: 0.018, type: 'sine' },
  stackMerged: { start: 260, end: 410, duration: 0.085, gain: 0.032, type: 'triangle' },
  stackCleared: { start: 660, end: 990, duration: 0.15, gain: 0.038, type: 'sine' },
};

export function createAudioFeedback({ AudioContext = globalThis.AudioContext, navigator = globalThis.navigator, soundEnabled = true, hapticsEnabled = true } = {}) {
  let context = null;
  let soundOn = Boolean(soundEnabled);
  let hapticsOn = Boolean(hapticsEnabled);
  let disposed = false;
  let runEpoch = 0;
  let nextSoundTime = 0;
  const seenEvents = new Set();
  const voices = new Map();

  function stopVoices() {
    for (const [oscillator, gain] of voices) {
      try { oscillator.stop(); } catch { /* A voice may already have ended. */ }
      try { oscillator.disconnect(); } catch { /* Browser cleanup can race onended. */ }
      try { gain.disconnect(); } catch { /* Browser cleanup can race onended. */ }
    }
    voices.clear();
    nextSoundTime = context?.currentTime ?? 0;
  }

  function cancelVibration() {
    try { navigator?.vibrate?.(0); } catch { /* Haptics are always optional. */ }
  }

  function ensureContext() {
    if (disposed || !soundOn || typeof AudioContext !== 'function') return null;
    if (!context) {
      try { context = new AudioContext(); }
      catch { return null; }
    }
    return context;
  }

  function activateFromGesture() {
    const audio = ensureContext();
    if (!audio) return Promise.resolve(false);
    if (audio.state === 'running') return Promise.resolve(true);
    if (typeof audio.resume !== 'function') return Promise.resolve(false);
    try { return Promise.resolve(audio.resume()).then(() => audio.state === 'running', () => false); }
    catch { return Promise.resolve(false); }
  }

  function suspend() {
    stopVoices();
    cancelVibration();
    if (!context || context.state !== 'running' || typeof context.suspend !== 'function') return Promise.resolve(false);
    try { return Promise.resolve(context.suspend()).then(() => true, () => false); }
    catch { return Promise.resolve(false); }
  }

  function resumeAfterVisibility() {
    if (!soundOn || disposed || !context || context.state === 'closed') return Promise.resolve(false);
    return activateFromGesture();
  }

  function setSettings({ soundEnabled: nextSound, hapticsEnabled: nextHaptics } = {}) {
    if (typeof nextSound === 'boolean' && nextSound !== soundOn) {
      soundOn = nextSound;
      if (!soundOn) void suspend();
    }
    if (typeof nextHaptics === 'boolean' && nextHaptics !== hapticsOn) {
      hapticsOn = nextHaptics;
      if (!hapticsOn) cancelVibration();
    }
    return { soundEnabled: soundOn, hapticsEnabled: hapticsOn };
  }

  function playCue(name) {
    const audio = context;
    const cue = CUES[name];
    if (!soundOn || !audio || audio.state !== 'running' || !cue || voices.size >= MAX_CUES_PER_ACTION) return false;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const startAt = Math.max(audio.currentTime + 0.004, nextSoundTime);
      const endAt = startAt + cue.duration;
      oscillator.type = cue.type;
      oscillator.frequency.setValueAtTime(cue.start, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(cue.end, endAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(cue.gain, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      voices.set(oscillator, gain);
      oscillator.onended = () => {
        voices.delete(oscillator);
        try { oscillator.disconnect(); } catch { /* Already disconnected. */ }
        try { gain.disconnect(); } catch { /* Already disconnected. */ }
      };
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.004);
      nextSoundTime = endAt + 0.012;
      return true;
    } catch {
      stopVoices();
      return false;
    }
  }

  function playEvents(events) {
    if (disposed || !Array.isArray(events)) return { played: 0, vibrated: false };
    const cues = [];
    let cleared = false;
    let merged = false;
    let accepted = false;
    for (const event of events) {
      if (!event || !Number.isInteger(event.turn) || !Number.isInteger(event.seq)) continue;
      const key = `${runEpoch}:${event.turn}:${event.seq}`;
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);
      if (event.type === 'actionAccepted') { accepted = true; cues.push('actionAccepted'); }
      else if (event.type === 'tokenMoved' && !cues.includes('tokenMoved')) cues.push('tokenMoved');
      else if (event.type === 'stackMerged') { merged = true; cues.push('stackMerged'); }
      else if (event.type === 'stackCleared') { cleared = true; cues.push('stackCleared'); }
      if (cues.length >= MAX_CUES_PER_ACTION) break;
    }
    let played = 0;
    for (const cue of cues) if (playCue(cue)) played += 1;
    const pattern = cleared ? [18, 22, 32] : merged ? [14] : accepted ? [8] : null;
    let vibrated = false;
    if (hapticsOn && pattern && typeof navigator?.vibrate === 'function') {
      try { vibrated = navigator.vibrate(pattern) === true; } catch { vibrated = false; }
    }
    return { played, vibrated };
  }

  function beginRun() {
    runEpoch += 1;
    seenEvents.clear();
    stopVoices();
    return runEpoch;
  }

  function snapshot() {
    return {
      contextCreated: Boolean(context),
      contextState: context?.state ?? 'unavailable',
      soundEnabled: soundOn,
      hapticsEnabled: hapticsOn,
      activeVoices: voices.size,
      seenEventCount: seenEvents.size,
      runEpoch,
      disposed,
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopVoices();
    seenEvents.clear();
    cancelVibration();
    if (context && context.state !== 'closed' && typeof context.close === 'function') {
      try { void Promise.resolve(context.close()).catch(() => {}); } catch { /* Teardown is best-effort. */ }
    }
  }

  return { activateFromGesture, suspend, resumeAfterVisibility, setSettings, playEvents, beginRun, snapshot, dispose };
}
