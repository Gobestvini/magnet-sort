import { h } from 'preact';
import { useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import { COLORS, remainingUnits } from './model.js';
import { art } from './assets.js';
import { IdleBackdrop } from './IdleBackdrop.js';
import { VictoryParticles } from './VictoryParticles.js';
import { potentialStars } from './model-v4.js';

export function MagnetIcon({ color = 'violet' }) {
  const key = Object.entries(COLORS).find(([, info]) => info.hex === color)?.[0] ?? color;
  return h('img', { src: art('magnet-' + key), alt: '', draggable: false, decoding: 'sync' });
}

function MagnetTray({state, selected, locked, reduced, onSelect, onToolDown}) {
  const ref=useRef(null), positions=useRef(new Map());
  useLayoutEffect(()=>{
    const next=new Map(), animations=[];
    const buttons=[...ref.current.querySelectorAll('button')];
    for(const [i,node] of buttons.entries()){
      const rect=node.getBoundingClientRect(), color=node.dataset.magnetColor;
      const old=positions.current.get(color);next.set(color,rect);
      if(!reduced&&positions.current.size){
        const fresh=i===buttons.length-1;
        animations.push(node.animate(fresh?[{opacity:0,transform:'translateY(12px) scale(.85)'},{opacity:1,transform:'none'}]:[
          {transform:`translateX(${old?old.left-rect.left:0}px)`},{transform:'none'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'}));
      }
    }
    positions.current=next;
    return ()=>animations.forEach(a=>a.cancel());
  },[state.queueTurn,reduced]);
  return h('div',{className:'magnet-tray cream-panel',ref},state.magnets.map(color=>h('button',{
    key:color,type:'button',className:'magnet-tool '+(selected===color?'is-selected':''),
    style:{'--magnet-color':COLORS[color].hex},disabled:locked,'data-magnet-color':color,
    'aria-label':COLORS[color].label+' magnet','aria-pressed':selected===color,
    onClick:()=>onSelect(color),onPointerDown:event=>onToolDown(event,color)
  },h(MagnetIcon,{color}))));
}

function Modal({ children, label, onClose, variant = '', reduced = false }) {
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
  return h('div', { className: 'modal-backdrop ' + variant, 'data-reduced':reduced, role: 'dialog', tabIndex: -1, 'aria-modal': 'true', 'aria-label': label, ref, onKeyDown: keys },
    h('div', { className: 'modal-panel' }, onClose && h('button', { className: 'round-button modal-close', onClick: onClose, 'aria-label': 'Close pause' }, h('img', { src: art('close'), alt: '' })), children));
}

export function PrototypeApp({ level, levelIndex, totalLevels, state, phase, selected, paused, notice,
  reduced, runId, canvasRef, hostRef, dragRef, collectionRef, counterRef, progressRef, onSelect, onToolDown, onPause, onReset, onNext, onHint, onReduced, keyboardCell, onKeyboard, error, onRetryRenderer, loading, loadingProgress, tutorialTarget }) {
  const tutorial = levelIndex === 0 && state.turn === 0 && phase === 'playing';
  const tutorialMessage = tutorial && !notice.includes('occupied') && !notice.startsWith('Hint:');
  const result = state.terminal && phase !== 'resolving';
  const overlay = paused || result || Boolean(error) || loading;
  const locked = overlay || phase === 'resolving';
  const goal=state.goal??state.initialUnits;
  const progress = Math.min(100,state.cleared / goal * 100);
  return h('main', { className: 'prototype-shell' },
    result && state.terminal === 'won' && h(VictoryParticles,{key:runId,seed:runId,reduced,active:!paused&&!error&&!loading}),
    h(IdleBackdrop, { active: phase === 'playing' && !paused && !loading && !error && !reduced }),
    h('div', { className: 'collection-layer', ref: collectionRef, 'aria-hidden': 'true' }),
    h('img', { className: 'drag-magnet', ref: dragRef, hidden: true, alt: '', 'aria-hidden': 'true', draggable: false }),
    h('div', { className: 'game-view' + (tutorial ? ' show-tutorial' : ''), inert: Boolean(overlay) },
      h('header', { className: 'topbar' },
        h('a', { className: 'brand', href: '#', onClick: event => event.preventDefault(), 'aria-label': 'Magnet Sort' },
          h('img', { src: art('logo-exact'), alt: '', draggable: false })),
        h('h1', { className: 'level-badge' }, 'LEVEL ', levelIndex + 1),
        h('button', { className: 'round-button', onClick: onPause, disabled: Boolean(error), 'aria-label': 'Pause' }, h('img', { src: art('pause'), alt: '' }))),
      h('section', { className: 'hud', 'aria-label': 'Puzzle progress' },
        h('div', { className: 'goal-panel cream-panel' },
          h('strong', null, 'COLLECTED ', h('span', { className: 'cleared-count', ref: counterRef }, state.cleared), ' / ', goal),
          h('div', { className: 'progress-track', ref: progressRef, role: 'progressbar', 'aria-label': 'Pieces collected', 'aria-valuenow': Math.min(goal,state.cleared), 'aria-valuemin': 0, 'aria-valuemax': goal },
            h('div', { style: { width: progress + '%' } }))),
        h('div', { className: 'moves-group' },
          h('div', { className:'potential-stars', 'data-reduced':reduced, role:'img', 'aria-label':`Potential stars: ${potentialStars(goal,state.movesUsed??state.turn)} of 3` },
            [1,2,3].map(n=>h('img',{key:n,src:art('moves-star'),alt:'',className:n<=potentialStars(goal,state.movesUsed??state.turn)?'lit':'dim'}))),
          h('div', { className: 'moves-panel cream-panel' }, h('span', null, 'MOVES'), h('strong', null, state.movesUsed??state.turn)))),
      h('section', { className: 'board-panel', 'aria-label': 'Game board' },
        h('div', { className: 'board-host', ref: hostRef },
          h('canvas', { ref: canvasRef, tabIndex: overlay ? -1 : 0, 'aria-label': 'Board: arrow keys select a tile, Enter places a magnet', onKeyDown: onKeyboard, 'aria-describedby': 'keyboard-cell' }),
          tutorial && tutorialTarget && h('img', { className: 'tutorial-arrow', src: art('tutorial-arrow'), alt: '', style: { left: (tutorialTarget.x - 22) + 'px', top: (tutorialTarget.y - 5) + 'px' } })),
        h('p', { id: 'keyboard-cell', className: 'sr-only' }, keyboardCell ? 'Tile: row ' + keyboardCell.row + ', column ' + keyboardCell.col : 'Use arrow keys to select a tile.')),
      h('p', { className: 'game-status' + (tutorialMessage ? ' tutorial-message cream-panel' : ''), role: 'status', 'aria-live': 'polite' },
        tutorialMessage ? h('span', null, h('strong', null, `Collect ${goal} pieces!`), h('small', null, 'Place a magnet. New stacks appear after every move.')) : phase === 'resolving' ? 'Pulling one piece at a time…' : notice),
      h('section', { className: 'controls', 'aria-label': 'Magnets and actions' },
        h(MagnetTray,{state,selected,locked,reduced,onSelect,onToolDown}),
        h('div', { className: 'action-row' },
          h('button', { className: 'secondary-button', onClick: onReset, 'aria-label': 'Restart' }, h('img', { className: 'restart-icon', src: art('restart'), alt: '' }), ' Restart')),
        h('p', { className: 'sr-only' }, 'Collect the goal using three available magnets. Pieces move between neighboring tiles; crosses block paths.'))),
    loading && h('div', { className: 'loading-screen' },
      h('div', { className: 'loading-frame' }, h('img', { className: 'loading-logo', src: art('logo-exact'), alt: 'Magnet Sort' }),
        h('div', { className: 'loading-magnets', 'aria-hidden': 'true' }, ['blue', 'violet', 'coral'].map(color => h(MagnetIcon, { color }))),
        h('h2', null, 'LOADING'), h('p', { role: 'status' }, 'Loading artwork…'),
        h('div', { className: 'loading-progress', role: 'progressbar', 'aria-label': 'Artwork loading', 'aria-valuenow': loadingProgress, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('div', { style: { width: loadingProgress + '%' } })), h('strong', null, loadingProgress + '%'))),
    error ? h(Modal, { key:'error', reduced, label: 'Launch error' },
      h('h2', null, "COULDN'T OPEN THE BOARD"), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('p', null, 'Please try again'), h('button', { className: 'primary-button', onClick: onRetryRenderer }, 'Retry'),
      h('small', null, 'Check your connection and browser support')) :
    paused ? h(Modal, { key:'pause', reduced, label: 'Paused', onClose: onPause },
      h('h2', { className: 'live-heading' }, 'PAUSED'), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('button', { className: 'primary-button', onClick: onPause }, 'Resume'),
      h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Restart')) :
    result ? h(Modal, { key:state.terminal, reduced, label: state.terminal === 'won' ? 'Victory' : 'Board full', variant: state.terminal === 'won' ? 'victory-dialog' : '' },
      h('div', { className: 'result-card', role: 'region', 'aria-label': 'Result' },
        state.terminal === 'won' ? null : h('h2', { className: 'live-heading defeat-heading' }, 'BOARD FULL'),
        state.terminal === 'won' ? h('h2', { className: 'result-title' }, 'LEVEL COMPLETE!') : h('div', { className: 'modal-magnet resting-magnet' }, h(MagnetIcon)),
        h('div',{className:'earned-stars','aria-label':`${state.stars??0} stars earned`},[1,2,3].map(n=>h('img',{src:art('victory-star-v2'),alt:'',className:n<=(state.stars??0)?'earned':'unearned'}))),
        h('div', {className:'victory-stats'}, h('p',null,state.movesUsed??state.turn,h('small',null,'MOVES')),h('p',null,`${state.cleared} / ${goal}`,h('small',null,'COLLECTED'))),
        state.terminal === 'lost' && h('small', null, remainingUnits(state) + ' pieces left'),
        h('button', { className: 'primary-button', onClick: state.terminal === 'won' ? onNext : onReset },
          state.terminal === 'won' ? levelIndex + 1 === totalLevels ? 'Play from start' : 'Next level' : 'Try again'),
        state.terminal === 'won' && h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Play again'))) : null);
}
