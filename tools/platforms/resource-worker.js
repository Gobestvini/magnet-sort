// Build embeds the public manifest so a CDN update cannot mix manifest/worker releases.
const MANIFEST = __MAGNET_SORT_RESOURCE_MANIFEST__;
const scope = self.registration.scope;
const prefix = `magnet-sort-resources-${new URL(scope).pathname}-`;
const cacheName = prefix + MANIFEST.version;
const assets = new Map(MANIFEST.assets.map(asset => [new URL(asset.url, scope).href, asset]));
const inFlight = new Map();
let warming;

async function cached(url) {
  // Only this application's resource caches; never consult the web PWA/API caches.
  const names = await caches.keys();
  for (const name of [cacheName, ...names.filter(name => name.startsWith(prefix) && name !== cacheName).reverse()]) {
    const response = await (await caches.open(name)).match(url, { ignoreVary: true });
    if (response) return response;
  }
}

async function resource(url) {
  if (inFlight.has(url)) return (await inFlight.get(url)).clone();
  const pending = (async () => {
    let response;
    try { response = await cached(url); } catch { /* Storage denied: use network. */ }
    const asset = assets.get(url);
    if (!asset) return response ?? fetch(url);
    const valid=async response=>{
      if(!response.ok || response.redirected) return false;
      const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
      return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')===asset.sha256;
    };
    if(response && !await valid(response)) {
      try {
        for(const name of (await caches.keys()).filter(name=>name.startsWith(prefix))) await (await caches.open(name)).delete(url);
      } catch { /* A broken cache must not prevent network repair. */ }
      response=undefined;
    }
    if(!response) {
      response=await fetch(url,{credentials:'omit',priority:'low'});
      if(!await valid(response)) throw new Error('Resource checksum mismatch');
    }
    try { await (await caches.open(cacheName)).put(url, response.clone()); } catch { /* Quota/denied storage must not block play. */ }
    return response;
  })();
  inFlight.set(url, pending);
  try { return (await pending).clone(); } finally { inFlight.delete(url); }
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
// This worker never serves navigation, catalogs, sessions or API responses.
// Activating immediately cannot swap the running document or its hashed URLs.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode === 'navigate' || url.search || !assets.has(url.href) || !url.href.startsWith(new URL('assets/', scope).href)) return;
  event.respondWith(resource(url.href));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'MAGNET_SORT_WARM_RESOURCES' || !event.source?.url?.startsWith(scope)) return;
  warming ??= (async () => {
    let next=0, failed=0;
    const urls=[...assets.keys()];
    await Promise.all(Array.from({length:2},async()=>{
      while(next<urls.length) {
        try { await resource(urls[next++]); } catch { failed++; }
      }
    }));
    // Keep the previous two releases for open tabs. Failed warming retains all
    // old caches; the next launch retries only missing resources.
    if(!failed) try {
      const old=(await caches.keys()).filter(name=>name.startsWith(prefix) && name!==cacheName);
      await Promise.all(old.slice(0,-2).map(name=>caches.delete(name)));
    } catch { /* Storage is optional. */ }
    return {version:MANIFEST.version,failed};
  })();
  const work=warming.then(result=>event.source.postMessage({type:'MAGNET_SORT_RESOURCES_WARMED',...result}));
  event.waitUntil(work);
  void work.finally(()=>{warming=undefined;});
});
