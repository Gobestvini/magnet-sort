import * as THREE from 'three';
import { rangeArt } from './magnet-radius.js';
import { boardAssets, uiAssets } from '../art/catalog.js';
import { assetUrl } from '../art/urls.js';
export { boardAssets } from '../art/catalog.js';

// Runtime URLs must share Vite's deployment base (including GitHub Pages subpaths).
export const art = name => assetUrl(`art/mockup/${name}.png`);

function decodeArtwork(name) {
  const image = new Image();
  image.src = name.startsWith('range-') ? rangeArt(Number(name.at(-1))) : art(name);
  return image.decode();
}

// Decode every shared texture before creating the scene. A failed batch releases
// its successful loads too, so Retry never accumulates orphan GPU resources.
export async function loadBoardTextures(onProgress = () => {}) {
  let completed = 0;
  const progress = () => onProgress(Math.round(++completed / (boardAssets.length + uiAssets.length + 3) * 100));
  await document.fonts.load('1000 82px Nunito'); progress();
  const loader = new THREE.TextureLoader();
  const images = [...uiAssets, 'range-1', 'range-2'];
  const results = await Promise.allSettled([...boardAssets.map(async name => {
    const texture = await loader.loadAsync(art(name));
    texture.colorSpace = THREE.SRGBColorSpace;
    progress();
    return [name, texture];
  }), ...images.map(async name => { await decodeArtwork(name); progress(); })]);
  if (results.some(result => result.status === 'rejected')) {
    for (const result of results) if (result.status === 'fulfilled' && result.value) result.value[1].dispose();
    throw new Error('Could not load the board artwork');
  }
  return Object.fromEntries(results.slice(0, boardAssets.length).map(result => result.value));
}
