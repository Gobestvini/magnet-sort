import { Application } from 'pixi.js';
import { createVisualAssets } from './visual-assets.js';

export async function createPixiApplication(host, canvas) {
  const app = new Application();
  const width = Math.max(1, Math.round(host.clientWidth));
  const height = Math.max(1, Math.round(host.clientHeight));
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  let visualAssets;

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
    visualAssets = await createVisualAssets();

    return {
      stage: app.stage,
      canvas: app.canvas,
      visualAssets,
      resize(nextWidth, nextHeight) {
        app.renderer.resize(Math.max(1, Math.round(nextWidth)), Math.max(1, Math.round(nextHeight)));
      },
      render() {
        app.renderer.render({ container: app.stage });
      },
      destroy() {
        app.destroy(false, { children: true });
        visualAssets.dispose();
      },
    };
  } catch (error) {
    visualAssets?.dispose();
    try {
      if (app.renderer) app.destroy(false, { children: true });
    } catch {
      // Initialization can fail before Pixi has a renderer to dispose.
    }
    throw error;
  }
}
