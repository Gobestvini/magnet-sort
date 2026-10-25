import { readWebChallenge, webChallengeLink } from '../challenge-links.js';

export function createWebPlatform(options = {}) {
  let disposed = false;
  const location = () => options.location ?? globalThis.location;
  return {
    id: 'web', async init() {}, ready() {},
    getLaunchChallenge() { return disposed ? {payload:null,error:null} : readWebChallenge(location()?.search); },
    challengeLink(payload) { return webChallengeLink(payload, location()?.href); },
    async shareChallenge(payload) {
      const url = webChallengeLink(payload, location()?.href);
      const navigator = options.navigator ?? globalThis.navigator;
      if (disposed || typeof navigator?.share !== 'function') return { status: 'unsupported', url };
      const data = { title: 'Magnet Sort challenge', text: 'Try the same board. Shared score, unverified.', url };
      try {
        if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) return { status: 'unsupported', url };
        // Called directly by the victory button, before yielding the gesture.
        await navigator.share(data);
        return { status: disposed ? 'unsupported' : 'opened', url };
      } catch (error) { return { status: error?.name === 'AbortError' ? 'cancelled' : 'error', url }; }
    },
    subscribePause(listener) { if (!disposed) listener(false); return () => {}; },
    dispose() { disposed = true; }
  };
}
