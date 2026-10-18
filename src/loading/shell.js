import { shellPaths } from '../art/catalog.js';
import { assetUrl } from '../art/urls.js';
import { createVisibleProgress } from './visible-progress.js';

export function createLoadingShell() {
  const preloader = document.querySelector('#startup-preloader');
  const error = document.querySelector('#startup-error');
  const root = document.querySelector('#ui-root');
  const shell = document.createElement('section');
  shell.id = 'startup-shell'; shell.hidden = true; shell.setAttribute('aria-label', 'Loading Magnet Sort');
  const content = document.createElement('div'); content.className = 'startup-content'; shell.append(content);
  const meter = document.createElement('div'); meter.className = 'startup-meter'; meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-label', 'Loading game resources'); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100');
  const state = createVisibleProgress();
  let frame = 0, disposed = false, failed = false, fullFrame = false, resolveDone, rejectDone;
  const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  void done.catch(() => {});
  root.inert = true;
  document.body.append(shell);
  const visibility = () => state.step(performance.now(), false);
  document.addEventListener('visibilitychange', visibility);
  const timeout = setTimeout(fail, 90000);
  function fail() {
    if (disposed || failed) return;
    failed = true; clearTimeout(timeout); cancelAnimationFrame(frame);
    preloader.hidden = true; shell.hidden = true; error.hidden = false;
    error.querySelector('button').focus();
    rejectDone(new Error('Could not load game resources'));
  }
  function tick(now) {
    if (disposed || failed) return;
    const view = state.step(now, !document.hidden);
    meter.style.setProperty('--loaded', `${view.displayed * 100}%`);
    if (view.ready && !document.hidden) {
      if (fullFrame) { resolveDone(); return; }
      fullFrame = true;
    }
    frame = requestAnimationFrame(tick);
  }
  const ready = Promise.all(shellPaths.map(async path => {
    const image = new Image(); image.src = assetUrl(path); await image.decode(); image.alt = ''; return image;
  })).then(images => {
    if (disposed || failed) throw new Error('Loading cancelled');
    const [background, logo, blue, violet, coral, studio] = images;
    shell.style.backgroundImage = `url("${background.src}")`;
    logo.className = 'startup-logo'; logo.alt = 'Magnet Sort';
    const magnets = document.createElement('div'); magnets.className = 'startup-magnets'; magnets.setAttribute('aria-hidden', 'true'); magnets.append(blue, violet, coral);
    const fill = document.createElement('div'); fill.className = 'startup-fill';
    const window = document.createElement('div'); window.className = 'startup-meter-window'; window.append(fill); meter.append(window);
    studio.className = 'studio-logo'; studio.alt = 'A game by Plus Vibe';
    content.append(logo, magnets, meter, studio);
    preloader.hidden = true; shell.hidden = false;
    performance.mark('loading-shell-ready');
    frame = requestAnimationFrame(tick);
  });
  void ready.catch(fail);
  function dispose() {
    if (disposed) return;
    disposed = true; clearTimeout(timeout); cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', visibility); shell.remove();
    rejectDone(new Error('Loading cancelled'));
  }
  return {
    ready, fail, dispose,
    setProgress(percent) { state.resources(percent, 101); meter.setAttribute('aria-valuenow', `${Math.round(percent)}`); },
    async finish() { clearTimeout(timeout); state.complete(); await done; },
    reveal() {
      if (disposed || failed) return;
      meter.setAttribute('aria-valuenow', '100'); root.inert = false;
      delete document.body.dataset.startup; performance.mark('game-revealed'); dispose();
    },
  };
}
