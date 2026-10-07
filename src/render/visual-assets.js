import { Texture } from 'pixi.js';
import { artUrl, cellSvg, chipSvg, magnetSvg, PALETTE } from './art.js';

export async function createVisualAssets() {
  const textures = new Map();
  try {
    const sources = [['empty', cellSvg()], ['blocked', cellSvg('blocked')], ['crate', cellSvg('crate')]];
    for (const color of Object.keys(PALETTE)) {
      for (const layers of [1, 2, 3]) sources.push([color + '-' + layers, chipSvg(color, layers, false)]);
      sources.push(['magnet-' + color, magnetSvg(color)]);
    }
    const results = await Promise.allSettled(sources.map(async ([key, svg]) => {
      const image = new Image();
      image.src = artUrl(svg);
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Vector texture canvas unavailable');
      context.drawImage(image, 0, 0);
      textures.set(key, Texture.from(canvas));
    }));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    return { get: key => textures.get(key) ?? Texture.WHITE, dispose() { for (const texture of textures.values()) texture.destroy(true); textures.clear(); } };
  } catch (error) {
    for (const texture of textures.values()) texture.destroy(true);
    throw error;
  }
}
