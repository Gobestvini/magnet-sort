import { createLoadingShell } from '../loading/shell.js';
import { installResourceCache } from '../loading/resource-cache.js';

// Shared startup owns the shell, platform and game; adapters own their SDKs.
export function startGame(platform) {
  const shell = createLoadingShell();
  let runtime, unsubscribe, cache, disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true; unsubscribe?.(); cache?.dispose(); platform.dispose(); runtime?.dispose(); shell.dispose();
  }
  const ready = (async () => {
    try {
      await platform.init();
      await shell.ready;
      if (disposed) return;
      const client = await import('../prototype/runtime.js');
      if (disposed) { client.dispose(); return; }
      runtime = client;
      unsubscribe = platform.subscribePause(runtime.setPlatformPaused);
      if (!await runtime.startRuntime(shell.setProgress)) throw Error('Game startup failed');
      if (disposed) return;
      await shell.finish();
      if (disposed) return;
      shell.reveal();
      platform.ready();
      cache = installResourceCache();
    } catch (error) {
      if (disposed) return;
      unsubscribe?.(); platform.dispose(); runtime?.dispose();
      shell.fail();
      if (error?.name === 'TelegramLaunchError') document.querySelector('#startup-error p').textContent = error.message;
      throw error;
    }
  })();
  void ready.catch(() => {});
  return { ready, dispose };
}
