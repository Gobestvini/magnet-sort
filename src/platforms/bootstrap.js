import { createLoadingShell } from '../loading/shell.js';
import { installResourceCache } from '../loading/resource-cache.js';
import { setRuntimePlatform, clearRuntimePlatform } from './runtime-context.js';

// Shared startup owns the shell, platform and game; adapters own their SDKs.
export function startGame(platform) {
  const shell = createLoadingShell();
  let runtime, unsubscribe, cache, disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true; unsubscribe?.(); cache?.dispose(); platform.dispose(); runtime?.dispose(); clearRuntimePlatform(platform); shell.dispose();
  }
  const ready = (async () => {
    try {
      await platform.init();
      await shell.ready;
      if (disposed) return;
      setRuntimePlatform(platform);
      const client = await import('../prototype/runtime.js');
      if (disposed) { client.dispose(); return; }
      runtime = client;
      const apiUrl = import.meta.env.VITE_LEADERBOARDS_API_URL;
      runtime.configureLeaderboards({ apiUrl, ...(typeof platform.leaderboardAuth === 'function' ? { authenticate: () => platform.leaderboardAuth() } : {}) });
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
      unsubscribe?.(); platform.dispose(); runtime?.dispose(); clearRuntimePlatform(platform);
      shell.fail();
      if (error?.name === 'TelegramLaunchError') document.querySelector('#startup-error p').textContent = error.message;
      throw error;
    }
  })();
  void ready.catch(() => {});
  return { ready, dispose };
}
