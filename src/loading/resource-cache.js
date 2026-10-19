// Optional resource cache shared by every platform. Never caches HTML or SDK/API.
export function installResourceCache() {
  let disposed = false;
  const send = worker => {
    if (!disposed && worker?.scriptURL === new URL('resource-sw.js', new URL(import.meta.env.BASE_URL, location.href)).href)
      worker.postMessage({ type: 'MAGNET_SORT_WARM_RESOURCES' });
  };
  const changed = () => send(navigator.serviceWorker.controller);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    void navigator.serviceWorker.register(new URL('resource-sw.js', new URL(import.meta.env.BASE_URL, location.href))).then(registration => {
      if (disposed) return;
      if (registration.active) send(registration.active);
      // An installing worker receives the request through controllerchange.
    }).catch(() => {}); // Denied storage/iframe policy leaves normal HTTP loading.
  }
  return { dispose() { disposed = true; if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', changed); } };
}
