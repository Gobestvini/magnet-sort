import { createAdProvider } from '../commerce/providers.js';
import { ADS_ENABLED, AD_MODE } from '../growth/config.js';

const scripts = {
  crazygames:'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  poki:'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
  yandex:'https://sdk.games.s3.yandex.net/sdk.js',
  playgama:'https://bridge.playgama.com/v2/stable/playgama-bridge.js',
  gamedistribution:'https://html5.api.gamedistribution.com/main.min.js',
  gamepix:'https://integration.gamepix.com/sdk/v3/gamepix.sdk.js',
};
const settled = value => { void Promise.resolve(value).catch(()=>{}); };
export function loadPortalScript(url, { document: doc = document, signal, timeoutMs = 12_000 } = {}) {
  return new Promise((resolve, reject) => {
    const node = doc.createElement('script'); node.src = url; node.async = true;
    const finish = error => { clearTimeout(timer); node.onload = node.onerror = null; signal?.removeEventListener('abort', abort); if(error){node.remove();reject(error);}else resolve(node); };
    const abort = () => finish(new Error('Portal SDK cancelled'));
    const timer = setTimeout(() => finish(new Error('Portal SDK timeout')), timeoutMs);
    node.onload = () => finish(); node.onerror = () => finish(new Error('Portal SDK unavailable'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, {once:true}); doc.head.append(node);
  });
}
export function createPortalPlatform(id, { load = loadPortalScript, scope = globalThis, enabled = ADS_ENABLED,
  mode = AD_MODE, gameId = import.meta.env?.VITE_GD_GAME_ID ?? '', initTimeoutMs = 12_000 } = {}) {
  if (!Object.hasOwn(scripts,id)) throw new Error('Unknown portal');
  const abort = new AbortController(), pauses = new Set(), events = new Set(), cleanup = [];
  let sdk, provider, disposed = false, expired = false, readySent = false, playing = false, sdkPaused = false, initialization;
  function pause(value) { if(disposed)return;sdkPaused=value;for(const listener of pauses)listener(value); }
  function event(data) { for(const listener of events)listener(data); if(data?.name==='SDK_GAME_PAUSE')pause(true);if(data?.name==='SDK_GAME_START')pause(false); }
  function gameplay(active) {
    if(disposed||!readySent||playing===active)return;
    playing=active;
    try {
      if(id==='crazygames')sdk?.game?.[active?'gameplayStart':'gameplayStop']?.();
      if(id==='poki')sdk?.[active?'gameplayStart':'gameplayStop']?.();
      if(id==='yandex')sdk?.features?.GameplayAPI?.[active?'start':'stop']?.();
      if(id==='playgama')settled(sdk?.platform?.sendMessage?.(active?'gameplay_started':'gameplay_stopped'));
      if(id==='gamepix'&&active)sdk?.lifecycle?.gameStart?.();
    } catch { /* Optional SDK telemetry cannot block play. */ }
  }
  return {
    id,
    init() {
      initialization ??= (async()=>{
        let timer, abortWait;
        const halted = new Promise(resolve=>{
          abortWait=()=>resolve();abort.signal.addEventListener('abort',abortWait,{once:true});
          timer=setTimeout(()=>{expired=true;sdk=undefined;abort.abort();},initTimeoutMs);
        });
        const initialize=async()=>{
        // An absent publisher ID is not a reason to stop ordinary play.
        if(id==='gamedistribution'&&!gameId)return;
        if(id==='gamedistribution')scope.GD_OPTIONS={gameId,onEvent:event};
        if(id==='gamepix')scope.GamePixConfig={lifecycle:'manual'};
        try {
          await load(scripts[id],{signal:abort.signal});
          if(disposed||expired)return;
          if(id==='crazygames'){sdk=scope.CrazyGames?.SDK;await sdk?.init?.();}
          if(id==='poki'){sdk=scope.PokiSDK;await sdk?.init?.();}
          if(id==='yandex')sdk=await scope.YaGames?.init?.();
          if(id==='playgama'){sdk=scope.bridge;await sdk?.initialize?.();}
          if(id==='gamedistribution')sdk=scope.gdsdk;
          if(id==='gamepix'){
            sdk=scope.GamePix;
            for(const [name,value] of [['pause',true],['resume',false]]) {
              const handler=()=>pause(value);sdk?.events?.on?.(name,handler);
              cleanup.push(()=>sdk?.events?.off?.(name,handler));
            }
          }
          if(disposed||expired)return;
          provider=createAdProvider({id,sdk,enabled,adMode:mode,subscribe:fn=>{events.add(fn);return()=>events.delete(fn);}});
        } catch { /* SDK denial/no connection leaves a playable, ads-off game. */ }
        };
        try { await Promise.race([initialize(),halted]); }
        finally {clearTimeout(timer);abort.signal.removeEventListener('abort',abortWait);}
      })();
      return initialization;
    },
    ready() {
      if(disposed||readySent)return;readySent=true;
      try {
        if(id==='poki')sdk?.gameLoadingFinished?.();
        if(id==='yandex')sdk?.features?.LoadingAPI?.ready?.();
        if(id==='playgama')settled(sdk?.platform?.sendMessage?.('game_ready'));
        if(id==='gamepix')settled(sdk?.lifecycle?.loaded?.());
      } catch { /* Readiness is best effort after actual first playable. */ }
    },
    gameplay,
    commerceProvider:()=>provider,
    subscribePause(listener){if(!disposed){pauses.add(listener);listener(sdkPaused);}return()=>pauses.delete(listener);},
    dispose(){if(disposed)return;gameplay(false);disposed=true;abort.abort();provider?.dispose();cleanup.forEach(fn=>fn());pauses.clear();events.clear();},
  };
}
