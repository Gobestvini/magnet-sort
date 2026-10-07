import { Application } from 'pixi.js';

export async function createPixiApplication(host, canvas) {
  const app = new Application();
  const width = Math.max(1, Math.round(host.clientWidth));
  const height = Math.max(1, Math.round(host.clientHeight));
  const resolution = Math.min(window.devicePixelRatio || 1, 2);

  try {
    await app.init({
      width,
      height,
      canvas,
      resolution,
      autoDensity: true,
      autoStart: false,
      sharedTicker: false,
      antialias: true,
      backgroundColor: 0xfffaf2,
      preference: 'webgl',
    });
    // The application runtime owns the only RAF. Pixi's private ticker stays stopped.
    app.stop();
    app.ticker?.stop();
    app.canvas.dataset.renderer = 'pixi';

    return {
      stage: app.stage,
      canvas: app.canvas,
      resize(nextWidth, nextHeight) {
        app.renderer.resize(Math.max(1, Math.round(nextWidth)), Math.max(1, Math.round(nextHeight)));
      },
      render() {
        app.renderer.render({ container: app.stage });
      },
      destroy() {
        app.destroy(false, { children: true });
      },
    };
  } catch (error) {
    try {
      if (app.renderer) app.destroy(false, { children: true });
    } catch {
      // Initialization can fail before Pixi has a renderer to dispose.
    }
    throw error;
  }
}
