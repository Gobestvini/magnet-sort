const unsupported = () => Promise.resolve({ status: 'unsupported' });

export function createStandalonePlatform() {
  return {
    async initialize() { return { status: 'ok', value: { sdkVersion: null } }; },
    async start() { return { status: 'ok', value: undefined }; },
    async getEntry() { return { status: 'ok', value: null }; },
    shareResult: unsupported,
    getLeaderboard: unsupported,
    rewarded: unsupported,
    interstitial: unsupported,
    onPause() { return () => {}; },
    dispose() {},
    snapshot() { return { kind: 'standalone', initialized: true, started: true, supportedAPIs: [] }; },
  };
}
