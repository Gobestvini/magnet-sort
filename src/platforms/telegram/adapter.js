// Adapted from White Tower: bridge/lifecycle only; no account or game services.
export class TelegramLaunchError extends Error {
  constructor() {
    super(...arguments);
    this.name = "TelegramLaunchError";
  }
}
const unavailable = () => new TelegramLaunchError("Could not connect to Telegram. Check the connection and retry.");
export function loadTelegramBridge(signal) {
  const read = () => window.Telegram?.WebApp;
  const bridge = read();
  if (signal.aborted) return Promise.reject(unavailable());
  if (bridge) return Promise.resolve(bridge);
  return new Promise((resolve, reject) => {
    const script = document.getElementById("platform-bridge");
    const finish = (error) => {
      clearTimeout(timer);
      script?.removeEventListener("load", loaded);
      script?.removeEventListener("error", failed);
      signal.removeEventListener("abort", failed);
      const value = read();
      if (error || !value) reject(error ?? unavailable());
      else resolve(value);
    };
    const loaded = () => finish();
    const failed = () => finish(unavailable());
    const timer = setTimeout(failed, 1e4);
    script?.addEventListener("load", loaded);
    script?.addEventListener("error", failed);
    signal.addEventListener("abort", failed, { once: true });
    if (!script) failed();
  });
}
function supports(bridge, minimum) {
  const major = Number(bridge.version.split(".")[0]);
  return Number.isFinite(major) && major >= minimum;
}
function inset(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
export function createTelegramPlatform(options = {}) {
  const root = options.root ?? document.documentElement;
  const load = options.load ?? loadTelegramBridge;
  const abort = new AbortController();
  const listeners = /* @__PURE__ */ new Set();
  const subscriptions = [];
  const styles = /* @__PURE__ */ new Map();
  const previousAttribute = root.getAttribute("data-platform-viewport");
  let disposed = false, readySent = false, paused = false, bridge, initialization;
  function write(name, value) {
    if (!styles.has(name)) styles.set(name, { value: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name) });
    root.style.setProperty(name, value);
  }
  function viewport(data) {
    if (disposed || !bridge) return;
    const visible = bridge.viewportHeight;
    write("--platform-visible-height", typeof visible === "number" && Number.isFinite(visible) && visible > 0 ? `${visible}px` : "100dvh");
    if (data?.isStateStable === false) return;
    const height = bridge.viewportStableHeight;
    if (typeof height === "number" && Number.isFinite(height) && height > 0) write("--platform-height", `${height}px`);
    if (supports(bridge, 8)) for (const edge of ["top", "bottom", "left", "right"]) {
      write(`--platform-inset-${edge}`, `${Math.max(inset(bridge.safeAreaInset?.[edge]), inset(bridge.contentSafeAreaInset?.[edge]))}px`);
    }
  }
  function setPaused(value) {
    if (disposed) return;
    paused = value;
    for (const listener of listeners) listener(paused);
  }
  function subscribe(event, handler) {
    subscriptions.push([event, handler]);
    bridge.onEvent(event, handler);
  }
  return {
    id: "telegram",
    init() {
      initialization ??= (async () => {
        if (disposed) return;
        const value = await load(abort.signal);
        if (disposed) return;
        if (typeof value.initData !== "string" || !value.initData.trim()) {
          throw new TelegramLaunchError("Open Magnet Sort from the game bot\u2019s Mini App button in Telegram, then retry.");
        }
        if (typeof value.ready !== "function" || typeof value.expand !== "function" || typeof value.onEvent !== "function" || typeof value.offEvent !== "function" || typeof value.version !== "string") throw unavailable();
        bridge = value;
        root.setAttribute("data-platform-viewport", "");
        viewport();
        subscribe("viewportChanged", viewport);
        if (supports(value, 8)) {
          paused = value.isActive === false;
          subscribe("activated", () => setPaused(false));
          subscribe("deactivated", () => setPaused(true));
          subscribe("safeAreaChanged", () => viewport());
          subscribe("contentSafeAreaChanged", () => viewport());
        }
        value.expand();
        viewport();
      })();
      return initialization;
    },
    ready() {
      if (disposed || readySent || !bridge) return;
      readySent = true;
      bridge.ready();
    },
    subscribePause(listener) {
      if (disposed) return () => {
      };
      listeners.add(listener);
      listener(paused);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      listeners.clear();
      for (const [event, handler] of subscriptions) bridge?.offEvent(event, handler);
      subscriptions.length = 0;
      for (const [name, previous] of styles) {
        if (previous.value) root.style.setProperty(name, previous.value, previous.priority);
        else root.style.removeProperty(name);
      }
      if (bridge) {
        if (previousAttribute === null) root.removeAttribute("data-platform-viewport");
        else root.setAttribute("data-platform-viewport", previousAttribute);
      }
    }
  };
}
