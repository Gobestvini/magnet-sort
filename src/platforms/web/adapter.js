export function createWebPlatform() {
  return { id: 'web', async init() {}, ready() {}, subscribePause(listener) { listener(false); return () => {}; }, dispose() {} };
}
