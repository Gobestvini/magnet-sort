import * as THREE from 'three';

export const art = name => `/art/mockup/${name}.png`;
const boardAssets = ['tile', 'blocker', ...['violet', 'blue', 'coral'].flatMap(color => [`ring-${color}`, `magnet-${color}`])];
const uiAssets = ['background', 'logo-exact', 'panel', 'modal', 'button-purple', 'button-green', 'button-light',
  'tool-neutral-frame', 'tool-selected-frame', 'pause', 'close', 'hint', 'restart', 'progress-empty', 'progress-full',
  'paused-title', 'defeat-title', 'defeat-magnet', 'victory-ribbon', 'switch-off', 'switch-thumb', 'loading-art', 'loading-track', 'loading-fill', 'tutorial-arrow',
  'victory-star', 'confetti-violet', 'confetti-yellow', 'confetti-blue', 'tutorial-hand'];

function decodeArtwork(name) {
  const image = new Image();
  image.src = art(name);
  return image.decode();
}

// Decode every shared texture before creating the scene. A failed batch releases
// its successful loads too, so Retry never accumulates orphan GPU resources.
export async function loadBoardTextures(onProgress = () => {}) {
  const loader = new THREE.TextureLoader();
  let completed = 0;
  const progress = () => onProgress(Math.round(++completed / (boardAssets.length + uiAssets.length) * 100));
  const results = await Promise.allSettled([...boardAssets.map(async name => {
    const texture = await loader.loadAsync(art(name));
    texture.colorSpace = THREE.SRGBColorSpace;
    progress();
    return [name, texture];
  }), ...uiAssets.map(async name => { await decodeArtwork(name); progress(); })]);
  if (results.some(result => result.status === 'rejected')) {
    for (const result of results) if (result.status === 'fulfilled' && result.value) result.value[1].dispose();
    throw new Error('Could not load the board artwork');
  }
  return Object.fromEntries(results.slice(0, boardAssets.length).map(result => result.value));
}
