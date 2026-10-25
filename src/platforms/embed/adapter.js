import { readWebChallenge, webChallengeLink } from '../challenge-links.js';

export function createEmbedPlatform(options = {}) {
  let disposed = false;
  return {
    id: 'embed', async init() {}, ready() {},
    getLaunchChallenge() { return disposed ? {payload:null,error:null} : readWebChallenge((options.location ?? globalThis.location)?.search); },
    // Embed never opens an OS or Telegram chooser. Its visible/copy link leads
    // to the public web game, rather than an iframe or host-specific URL.
    challengeLink: payload => webChallengeLink(payload),
    shareChallenge: payload => ({ status: 'unsupported', url: webChallengeLink(payload) }),
    subscribePause(listener) { if (!disposed) listener(false); return () => {}; },
    dispose() { disposed = true; }
  };
}
