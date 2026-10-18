// One allowlist for the loader and production asset graph; originals stay in public/.
const colors = ['violet', 'blue', 'coral', 'gold', 'lime', 'teal', 'pink'];
export const boardAssets = ['tile', 'tile-blocked', ...colors.flatMap(color => [`chip-${color}`, `magnet-${color}`, `tile-magnetic-${color}`])];
export const uiAssets = ['defeat-panel', 'defeat-illustration', 'moves-star', 'background-v2', 'background-grid-mask-v2', 'victory-panel-v2', 'logo-exact', 'panel', 'modal', 'button-purple', 'button-green', 'button-light',
  'tool-neutral-frame', 'tool-selected-frame', 'pause', 'close', 'hint', 'restart', 'progress-empty', 'progress-full', 'switch-off', 'switch-thumb', 'tutorial-arrow',
  'victory-star-v2', 'confetti-violet', 'confetti-yellow', 'confetti-blue', 'tutorial-hand'];
export const shellPaths = ['background-v2', 'logo-exact', 'magnet-blue', 'magnet-violet', 'magnet-coral'].map(name => `art/mockup/${name}.png`).concat('art/loading/studio.webp');
export const runtimePaths = [...new Set([...boardAssets, ...uiAssets].map(name => `art/mockup/${name}.png`).concat(shellPaths, ['art/range-map-1.png', 'art/range-map-2.png', 'fonts/Nunito.ttf']))];
