import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { COLORS, remainingUnits } from './model.js';
import { art } from './assets.js';

export function MagnetIcon({ color = 'violet' }) {
  const key = Object.entries(COLORS).find(([, info]) => info.hex === color)?.[0] ?? color;
  return h('img', { src: art('magnet-' + key), alt: '', draggable: false, decoding: 'sync' });
}

function Modal({ children, label, onClose, variant = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const target = onClose ? ref.current?.querySelector('button') : ref.current;
    target?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  function keys(event) {
    if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const nodes = [...ref.current.querySelectorAll('button,input')].filter(node => !node.disabled);
    const first = nodes[0], last = nodes.at(-1);
    if (document.activeElement === ref.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return h('div', { className: 'modal-backdrop ' + variant, role: 'dialog', tabIndex: -1, 'aria-modal': 'true', 'aria-label': label, ref, onKeyDown: keys },
    variant === 'victory-dialog' && h('div', { className: 'celebration', 'aria-hidden': 'true' },
      [0, 1, 2].map(index => h('img', { className: 'victory-star star-' + index, src: art('victory-star'), alt: '' })),
      ['violet', 'yellow', 'blue', 'yellow', 'violet', 'blue', 'yellow', 'violet'].map((color, index) => h('img', { className: 'confetti confetti-' + index, src: art('confetti-' + color), alt: '' }))),
    h('div', { className: 'modal-panel' }, onClose && h('button', { className: 'round-button modal-close', onClick: onClose, 'aria-label': 'Close pause' }, h('img', { src: art('close'), alt: '' })), children));
}

export function PrototypeApp({ level, levelIndex, totalLevels, state, phase, selected, paused, notice,
  reduced, clearingCount, canvasRef, hostRef, onSelect, onToolDown, onPause, onReset, onNext, onHint, onReduced, keyboardCell, onKeyboard, error, onRetryRenderer, loading, loadingProgress, tutorialTarget }) {
  const tutorial = levelIndex === 0 && state.turn === 0 && phase === 'playing';
  const tutorialMessage = tutorial && !notice.includes('occupied') && !notice.startsWith('Hint:');
  const result = state.terminal && phase !== 'resolving';
  const overlay = paused || result || Boolean(error) || loading;
  const locked = overlay || phase === 'resolving';
  const progress = state.cleared / state.initialUnits * 100;
  const reducedControl = h('label', { className: 'motion-option' }, 'Reduced motion',
    h('input', { type: 'checkbox', checked: reduced, onChange: onReduced }), h('span', { className: 'switch', 'aria-hidden': 'true' }));
  return h('main', { className: 'prototype-shell' },
    h('div', { className: 'game-view' + (levelIndex === 0 ? ' first-puzzle' : '') + (tutorial ? ' show-tutorial' : ''), inert: Boolean(overlay) },
      h('header', { className: 'topbar' },
        h('a', { className: 'brand', href: '#', onClick: event => event.preventDefault(), 'aria-label': 'Magnet Sort' },
          h('img', { src: art('logo-exact'), alt: '', draggable: false })),
        h('h1', { className: 'level-badge' }, 'LEVEL ', levelIndex + 1),
        h('button', { className: 'round-button', onClick: onPause, disabled: Boolean(error), 'aria-label': 'Pause' }, h('img', { src: art('pause'), alt: '' }))),
      h('section', { className: 'hud', 'aria-label': 'Puzzle progress' },
        h('div', { className: 'goal-panel cream-panel' },
          h('strong', null, 'CLEARED ', state.cleared, ' / ', state.initialUnits),
          h('div', { className: 'progress-track', role: 'progressbar', 'aria-label': 'Pieces cleared', 'aria-valuenow': state.cleared, 'aria-valuemin': 0, 'aria-valuemax': state.initialUnits },
            h('div', { key: state.turn, style: { width: progress + '%' } }))),
        h('div', { className: 'moves-panel cream-panel' }, h('span', null, 'MOVES'), h('strong', null, state.remainingMoves))),
      h('section', { className: 'board-panel', 'aria-label': 'Game board' },
        h('div', { className: 'board-host', ref: hostRef },
          h('canvas', { ref: canvasRef, tabIndex: overlay ? -1 : 0, 'aria-label': 'Board: arrow keys select a tile, Enter places a magnet', onKeyDown: onKeyboard, 'aria-describedby': 'keyboard-cell' }),
          tutorial && tutorialTarget && h('img', { className: 'tutorial-arrow', src: art('tutorial-arrow'), alt: '', style: { left: (tutorialTarget.x - 22) + 'px', top: (tutorialTarget.y - 5) + 'px' } }),
          clearingCount > 0 && h('span', { className: 'clear-burst', 'aria-hidden': 'true' }, '+' + clearingCount)),
        h('p', { id: 'keyboard-cell', className: 'sr-only' }, keyboardCell ? 'Tile: row ' + keyboardCell.row + ', column ' + keyboardCell.col : 'Use arrow keys to select a tile.')),
      h('p', { className: 'game-status' + (tutorialMessage ? ' tutorial-message cream-panel' : ''), role: 'status', 'aria-live': 'polite' },
        tutorialMessage ? h('span', null, h('strong', null, 'Place a magnet on an empty tile'), h('small', null, 'Pieces move one at a time')) : phase === 'resolving' ? 'Pulling one piece at a time…' : notice),
      h('section', { className: 'controls', 'aria-label': 'Magnets and actions' },
        h('div', { className: 'magnet-tray cream-panel' }, (levelIndex === 0 ? state.magnets : Object.keys(COLORS)).map(color => h('button', { key: color, type: 'button',
          className: 'magnet-tool ' + (selected === color ? 'is-selected ' : '') + (!state.magnets.includes(color) ? 'unavailable' : ''), style: { '--magnet-color': COLORS[color].hex },
          disabled: locked || !state.magnets.includes(color), 'aria-label': COLORS[color].label + ' magnet', 'aria-pressed': selected === color,
          onClick: () => onSelect(color), onPointerDown: event => onToolDown(event, color) }, h(MagnetIcon, { color }),
          tutorial && h('img', { className: 'tutorial-hand', src: art('tutorial-hand'), alt: '' })))),
        h('div', { className: 'action-row' },
          h('button', { className: 'secondary-button', disabled: locked, onClick: onHint, 'aria-label': 'Hint' }, h('img', { className: 'hint-icon', src: art('hint'), alt: '' }), ' Hint'),
          h('button', { className: 'secondary-button', onClick: onReset, 'aria-label': 'Restart' }, h('img', { className: 'restart-icon', src: art('restart'), alt: '' }), ' Restart')),
        h('p', { className: 'sr-only' }, level.lesson))),
    loading && h('div', { className: 'loading-screen' },
      h('div', { className: 'loading-frame' }, h('img', { className: 'loading-art', src: art('loading-art'), alt: 'Magnet Sort' }),
        h('h2', null, 'LOADING'), h('p', { role: 'status' }, 'Loading artwork…'),
        h('div', { className: 'loading-progress', role: 'progressbar', 'aria-label': 'Artwork loading', 'aria-valuenow': loadingProgress, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('div', { style: { width: loadingProgress + '%' } })), h('strong', null, loadingProgress + '%'))),
    error ? h(Modal, { label: 'Launch error' },
      h('h2', null, "COULDN'T OPEN THE BOARD"), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('p', null, 'Please try again'), h('button', { className: 'primary-button', onClick: onRetryRenderer }, 'Retry'),
      h('small', null, 'Check your connection and browser support')) :
    paused ? h(Modal, { label: 'Paused', onClose: onPause },
      h('h2', { className: 'art-heading' }, h('img', { src: art('paused-title'), alt: 'PAUSED' })), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('button', { className: 'primary-button', onClick: onPause }, 'Resume'),
      h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Restart'),
      reducedControl) :
    result ? h(Modal, { label: state.terminal === 'won' ? 'Victory' : 'Out of moves', variant: state.terminal === 'won' ? 'victory-dialog' : '' },
      h('div', { className: 'result-card', role: 'region', 'aria-label': 'Result' },
        state.terminal === 'won' ? h('div', { className: 'modal-magnet victory-magnet' }, h(MagnetIcon)) : h('h2', { className: 'art-heading defeat-heading' }, h('img', { src: art('defeat-title'), alt: 'OUT OF MOVES' })),
        state.terminal === 'won' ? h('img', { className: 'victory-ribbon', src: art('victory-ribbon'), alt: 'BOARD CLEARED!' }) : h('img', { className: 'defeat-magnet', src: art('defeat-magnet'), alt: '' }),
        h('p', null, state.terminal === 'won' ? 'Nice chain!' : 'Try a different magnet order'),
        state.terminal === 'lost' && h('small', null, remainingUnits(state) + ' pieces left'),
        h('button', { className: 'primary-button', onClick: state.terminal === 'won' ? onNext : onReset },
          state.terminal === 'won' ? levelIndex + 1 === totalLevels ? 'Play from start' : 'Next puzzle' : 'Try again'),
        state.terminal === 'won' && h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Play again'))) : null);
}
