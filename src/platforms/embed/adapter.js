export function createEmbedPlatform() {
  return { id: 'embed', async init() {}, ready() {}, subscribePause(listener) { listener(false); return () => {}; }, dispose() {} };
}
