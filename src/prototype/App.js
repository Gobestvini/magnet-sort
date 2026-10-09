import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { COLORS, remainingUnits } from './model.js';

export function MagnetIcon({ color = '#a019ff' }) {
  const id = 'magnet-' + color.replace('#', '');
  return h('svg', { viewBox: '0 0 100 100', fill: 'none', 'aria-hidden': 'true' },
    h('defs', null,
      h('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' },
        h('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.6' }),
        h('stop', { offset: '.3', 'stop-color': color }),
        h('stop', { offset: '.65', 'stop-color': color }),
        h('stop', { offset: '1', 'stop-color': '#261055' })),
      h('linearGradient', { id: id + '-tip', x2: '1', y2: '1' },
        h('stop', { 'stop-color': '#fff' }), h('stop', { offset: '1', 'stop-color': '#bcb7cf' }))),
    h('path', { d: 'M14 14h21v40a15 15 0 0 0 30 0V14h21v40a36 36 0 0 1-72 0Z', fill: '#381274', transform: 'translate(0 5)' }),
    h('path', { d: 'M14 14h21v40a15 15 0 0 0 30 0V14h21v40a36 36 0 0 1-72 0Z', fill: 'url(#' + id + ')', stroke: color, 'stroke-width': '2' }),
    h('path', { d: 'M17 35v20a33 33 0 0 0 66 0V35', stroke: '#fff', 'stroke-opacity': '.5', 'stroke-width': '2', 'stroke-linecap': 'round' }),
    h('path', { d: 'M14 14h21v20H14zm51 0h21v20H65z', fill: 'url(#' + id + '-tip)', stroke: '#fff', 'stroke-width': '1.5' }));
}

function Modal({ children, label, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  function keys(event) {
    if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const nodes = [...ref.current.querySelectorAll('button,input')].filter(node => !node.disabled);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return h('div', { className: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': label, ref, onKeyDown: keys },
    h('div', { className: 'modal-panel' }, onClose && h('button', { className: 'round-button modal-close', onClick: onClose, 'aria-label': 'Close pause' }, '×'), children));
}

export function PrototypeApp({ level, levelIndex, totalLevels, state, phase, selected, paused, notice,
  reduced, clearingCount, canvasRef, hostRef, onSelect, onToolDown, onPause, onReset, onNext, onHint, onReduced, keyboardCell, onKeyboard, error, onRetryRenderer }) {
  const result = state.terminal && phase !== 'resolving';
  const overlay = paused || result || Boolean(error);
  const locked = overlay || phase === 'resolving';
  const progress = state.cleared / state.initialUnits * 100;
  const reducedControl = h('label', { className: 'motion-option' }, 'Reduced motion',
    h('input', { type: 'checkbox', checked: reduced, onChange: onReduced }), h('span', { className: 'switch', 'aria-hidden': 'true' }));
  return h('main', { className: 'prototype-shell' },
    h('div', { className: 'game-view', inert: Boolean(overlay) },
      h('header', { className: 'topbar' },
        h('a', { className: 'brand', href: '#', onClick: event => event.preventDefault(), 'aria-label': 'Magnet Sort' },
          h('span', { className: 'brand-magnet' }, h(MagnetIcon, { color: '#ff5736' })),
          h('span', { className: 'brand-words' }, h('b', null, 'MAGNET'), h('b', null, 'SORT'))),
        h('h1', { className: 'level-badge' }, 'LEVEL ', levelIndex + 1),
        h('button', { className: 'round-button', onClick: onPause, disabled: Boolean(error), 'aria-label': 'Pause' }, 'Ⅱ')),
      h('section', { className: 'hud', 'aria-label': 'Puzzle progress' },
        h('div', { className: 'goal-panel cream-panel' },
          h('strong', null, 'CLEARED ', state.cleared, ' / ', state.initialUnits),
          h('div', { className: 'progress-track', role: 'progressbar', 'aria-label': 'Pieces cleared', 'aria-valuenow': state.cleared, 'aria-valuemin': 0, 'aria-valuemax': state.initialUnits },
            h('div', { style: { width: progress + '%' } }))),
        h('div', { className: 'moves-panel cream-panel' }, h('span', null, 'MOVES'), h('strong', null, state.remainingMoves))),
      h('section', { className: 'board-panel', 'aria-label': 'Game board' },
        h('div', { className: 'board-host', ref: hostRef },
          h('canvas', { ref: canvasRef, tabIndex: overlay ? -1 : 0, 'aria-label': 'Board: arrow keys select a tile, Enter places a magnet', onKeyDown: onKeyboard, 'aria-describedby': 'keyboard-cell' }),
          clearingCount > 0 && h('span', { className: 'clear-burst', 'aria-hidden': 'true' }, '+' + clearingCount)),
        h('p', { id: 'keyboard-cell', className: 'sr-only' }, keyboardCell ? 'Tile: row ' + keyboardCell.row + ', column ' + keyboardCell.col : 'Use arrow keys to select a tile.')),
      h('p', { className: 'game-status', role: 'status', 'aria-live': 'polite' }, phase === 'resolving' ? 'Pulling one piece at a time…' : notice),
      h('section', { className: 'controls', 'aria-label': 'Magnets and actions' },
        h('div', { className: 'magnet-tray cream-panel' }, state.magnets.map(color => h('button', { key: color, type: 'button',
          className: 'magnet-tool ' + (selected === color ? 'is-selected' : ''), style: { '--magnet-color': COLORS[color].hex },
          disabled: locked, 'aria-label': COLORS[color].label + ' magnet', 'aria-pressed': selected === color,
          onClick: () => onSelect(color), onPointerDown: event => onToolDown(event, color) }, h(MagnetIcon, { color: COLORS[color].hex })))),
        h('div', { className: 'action-row' },
          h('button', { className: 'secondary-button', disabled: locked, onClick: onHint, 'aria-label': 'Hint' }, h('svg', { className: 'hint-icon', viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' }, h('path', { d: 'M8 16c0-3-3-4-3-8a7 7 0 0 1 14 0c0 4-3 5-3 8Z', fill: '#fff8c7', stroke: '#fff', 'stroke-width': '1.5' }), h('path', { d: 'M9 19h6m-5 3h4', stroke: '#fff', 'stroke-width': '2', 'stroke-linecap': 'round' })), ' Hint'),
          h('button', { className: 'secondary-button', onClick: onReset, 'aria-label': 'Restart' }, h('span', { 'aria-hidden': 'true' }, '↻'), ' Restart')),
        h('div', { className: 'lesson-card cream-panel' }, h('strong', null, level.title), h('p', null, level.lesson)),
        h('div', { className: 'settings-inline' }, reducedControl))),
    error ? h(Modal, { label: 'Launch error' },
      h('h2', null, "COULDN'T OPEN THE BOARD"), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('p', null, 'Please try again'), h('button', { className: 'primary-button', onClick: onRetryRenderer }, 'Retry'),
      h('small', null, 'Requires a browser with WebGL 2')) :
    paused ? h(Modal, { label: 'Paused', onClose: onPause },
      h('h2', null, 'PAUSED'), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('button', { className: 'primary-button', onClick: onPause }, 'Resume'),
      h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Restart'),
      reducedControl) :
    result ? h(Modal, { label: state.terminal === 'won' ? 'Victory' : 'Out of moves' },
      h('div', { className: 'result-card', role: 'region', 'aria-label': 'Result' },
        h('div', { className: 'modal-magnet ' + (state.terminal === 'won' ? 'victory-magnet' : 'resting-magnet') }, h(MagnetIcon)),
        h('h2', { className: 'result-title' }, state.terminal === 'won' ? 'BOARD CLEARED!' : 'OUT OF MOVES'),
        h('p', null, state.terminal === 'won' ? 'Nice chain!' : 'Try a different magnet order'),
        state.terminal === 'lost' && h('small', null, remainingUnits(state) + ' pieces left'),
        h('button', { className: 'primary-button', onClick: state.terminal === 'won' ? onNext : onReset },
          state.terminal === 'won' ? levelIndex + 1 === totalLevels ? 'Play from start' : 'Next puzzle' : 'Try again'),
        state.terminal === 'won' && h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Play again'))) : null);
}
