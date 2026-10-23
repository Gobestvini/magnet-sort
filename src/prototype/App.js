import { h } from 'preact';
import { useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import { COLORS, remainingUnits } from './model.js';
import { art } from './assets.js';
import { IdleBackdrop } from './IdleBackdrop.js';
import { magnetRadius, rangeArt, rangeHue } from './magnet-radius.js';
import { potentialStars } from './model-v4.js';
import { assetUrl } from '../art/urls.js';
import { TutorialGuide } from './TutorialGuide.js';
import { forecastText } from './spawn-forecast.js';

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
    style:{'--magnet-color':COLORS[color].hex,'--range-hue':rangeHue(color)+'deg'},disabled:locked,'data-magnet-color':color,
    'aria-label':COLORS[color].label+' magnet, '+magnetRadius(state,color)+' hex '+(magnetRadius(state,color)===1?'ring':'rings'),'aria-pressed':selected===color,
    onClick:event=>{ if(event.detail===0)onSelect(color); },onPointerDown:event=>onToolDown(event,color)
  },h(MagnetIcon,{color}),h('span',{className:'magnet-range','data-radius':magnetRadius(state,color),'aria-hidden':'true'},h('img',{src:rangeArt(magnetRadius(state,color)),alt:''})))));
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

function SaveStatus({ status, onFreshSave, onReloadSave }) {
  if (!status || status.reason === 'transient') return null;
  const message = status.saved ? 'Progress saved on this device.' : ({
    'invalid-data': 'Your saved progress could not be read. This game is running without saving.',
    'unsupported-version': 'Your save belongs to another game version. This game is running without saving.',
    conflict: 'Progress changed in another tab. Reload to use that save. This tab is not saving.',
    'action-limit': 'This attempt is too long to save. You can keep playing in this tab.'
  }[status.reason] ?? 'Progress could not be saved. You can keep playing in this tab.');
  return h('div', { className: 'save-status', 'aria-label': 'Save status' },
    h('p', { role: 'status' }, message),
    status.reason === 'conflict' ? h('button', { className: 'secondary-button light-button', onClick: onReloadSave }, 'Reload saved game') :
    !status.saved && status.reason !== 'action-limit' &&
      h('button', { className: 'secondary-button light-button', onClick: onFreshSave }, 'Start fresh save'));
}

export function PrototypeApp({ level, levelIndex, totalLevels, state, phase, selected, paused, notice,
  reduced, runId, canvasRef, hostRef, dragRef, collectionRef, counterRef, progressRef, onSelect, onToolDown, onPause, onReset, onNext, onHint, onReduced, keyboardCell, onKeyboard, error, onRetryRenderer, loading, loadingProgress, getTutorialTarget, audioSettings, onAudioChange, saveStatus, onFreshSave, onReloadSave, spawnForecast, canUndo, onUndo }) {
  const tutorial = levelIndex === 0 && state.turn === 0 && phase === 'playing';
  const tutorialMessage = tutorial && !notice.includes('occupied') && !notice.startsWith('Hint:');
  const result = state.terminal && phase !== 'resolving';
  const overlay = paused || result || Boolean(error) || loading;
  const locked = overlay || phase === 'resolving';
  const goal=state.goal??state.initialUnits;
  const progress = Math.min(100,state.cleared / goal * 100);
  return h('main', { className: 'prototype-shell' },
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
          h('div', { className: 'moves-panel cream-panel' }, h('span', null, 'MOVES'), h('strong', null, state.movesUsed??state.turn))),
      spawnForecast && h('p', { className: 'spawn-forecast', title: 'Up to this many stacks, if space remains',
        'aria-label': forecastText(spawnForecast) + '. Up to this many stacks, if space remains.' }, forecastText(spawnForecast))),
      h('section', { className: 'board-panel', 'aria-label': 'Game board' },
        h('div', { className: 'board-host', ref: hostRef },
          h('canvas', { ref: canvasRef, tabIndex: overlay ? -1 : 0, 'aria-label': 'Board: arrow keys select a tile, Enter places a magnet', onKeyDown: onKeyboard, 'aria-describedby': 'keyboard-cell' })),
        h('p', { id: 'keyboard-cell', className: 'sr-only' }, keyboardCell ? 'Tile: row ' + keyboardCell.row + ', column ' + keyboardCell.col : 'Use arrow keys to select a tile.')),
      h('p', { className: 'game-status' + (tutorialMessage ? ' tutorial-message cream-panel' : ''), role: 'status', 'aria-live': 'polite' },
        tutorialMessage ? h('span', null, h('strong', null, `Collect ${goal} pieces!`), h('small', null, 'Drag a magnet onto an empty tile. You can also tap.')) : phase === 'resolving' ? 'Pulling one piece at a time…' : notice),
      h('section', { className: 'controls', 'aria-label': 'Magnets and actions' },
        h(MagnetTray,{state,selected,locked,reduced,onSelect,onToolDown}),
        h('div', { className: 'action-row' },
          h('button', { type: 'button', className: 'secondary-button undo-button', onClick: onUndo, disabled: !canUndo, 'aria-label': 'Undo last move' }, 'Undo'),
          h('button', { className: 'secondary-button restart-button', onClick: onReset, 'aria-label': 'Restart' }, h('img', { className: 'restart-icon', src: art('restart'), alt: '' }), ' Restart')),
        h('p', { className: 'sr-only' }, 'Collect the goal using up to three magnets matching exposed stack colors. The badge shows one or two hex rings. Magnets pull exposed matching colors directly, including over crosses. Every ten pieces go to the progress bar.'))),
    tutorial && !overlay && h(TutorialGuide, {color:selected,getTarget:getTutorialTarget,runId,reduced}),
    loading && h('div', { className: 'loading-screen' },
      h('div', { className: 'loading-frame' }, h('img', { className: 'loading-logo', src: art('logo-exact'), alt: 'Magnet Sort' }),
        h('div', { className: 'loading-magnets', 'aria-hidden': 'true' }, ['blue', 'violet', 'coral'].map(color => h(MagnetIcon, { color }))),
        h('div', { className: 'loading-progress', role: 'progressbar', 'aria-label': 'Artwork loading', 'aria-valuenow': loadingProgress, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('div', { style: { width: loadingProgress + '%' } })),
        h('img', { src: assetUrl('art/loading/studio.webp'), alt: 'A game by Plus Vibe', style: { width:'42%', height:'90px', objectFit:'contain', margin:'20px auto' } }))),
    error ? h(Modal, { key:'error', reduced, label: 'Launch error' },
      h('h2', null, "COULDN'T OPEN THE BOARD"), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('p', null, 'Please try again'), h('button', { className: 'primary-button', onClick: onRetryRenderer }, 'Retry'),
      h('small', null, 'Check your connection and browser support')) :
    paused ? h(Modal, { key:'pause', reduced, label: 'Paused', onClose: onPause, variant: 'pause-dialog' },
      h('h2', { className: 'live-heading' }, 'PAUSED'), h('div', { className: 'modal-magnet' }, h(MagnetIcon)),
      h('div', { className: 'audio-settings', 'aria-label': 'Audio settings' },
        [['music','Music'],['sfx','Sounds']].map(([channel,label])=>h('div',{key:channel,className:'audio-setting'},
          h('div',{className:'audio-setting-heading'},h('span',{id:channel+'-name'},label),
            h('button',{type:'button',className:'audio-toggle','aria-label':label,'aria-pressed':audioSettings[channel+'Enabled'],
              onClick:event=>onAudioChange({[channel+'Enabled']:!audioSettings[channel+'Enabled']},event)},audioSettings[channel+'Enabled']?'On':'Off')),
          h('label',{className:'audio-volume',htmlFor:channel+'-volume'},
            h('span',{className:'sr-only'},label+' volume'),
            h('input',{id:channel+'-volume',type:'range',min:0,max:100,step:1,value:Math.round(audioSettings[channel+'Volume']*100),
              'aria-label':label+' volume','aria-valuetext':Math.round(audioSettings[channel+'Volume']*100)+'%',
              onInput:event=>onAudioChange({[channel+'Volume']:Number(event.currentTarget.value)/100},event)}),
            h('output',{'aria-hidden':'true'},Math.round(audioSettings[channel+'Volume']*100)+'%'))))),
      h('button', { className: 'primary-button', onClick: onPause }, 'Resume'),
      h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Restart'),
      h(SaveStatus, { status: saveStatus, onFreshSave, onReloadSave })) :
    result ? h(Modal, { key:state.terminal, reduced, label: state.terminal === 'won' ? 'Victory' : 'Board full', variant: state.terminal === 'won' ? 'victory-dialog' : 'defeat-dialog' },
      h('div', { className: 'result-card', role: 'region', 'aria-label': 'Result' },
        state.terminal === 'won' ? null : h('h2', { className: 'live-heading defeat-heading' }, 'BOARD FULL'),
        state.terminal === 'won' ? h('h2', { className: 'result-title' }, 'LEVEL COMPLETE!') : h('p',{className:'defeat-reason'},'No empty tiles left'),
        state.terminal === 'lost' && h('img',{className:'defeat-illustration',src:art('defeat-illustration'),alt:'',draggable:false}),
        state.terminal === 'won' && h('div',{className:'earned-stars','aria-label':`${state.stars??0} stars earned`},[1,2,3].map(n=>h('img',{src:art('victory-star-v2'),alt:'',className:n<=(state.stars??0)?'earned':'unearned'}))),
        h('div', {className:'victory-stats'}, h('p',null,state.movesUsed??state.turn,h('small',null,'MOVES')),h('p',null,`${state.cleared} / ${goal}`,h('small',null,'COLLECTED'))),
        state.terminal === 'lost' && h('small', null, remainingUnits(state) + ' pieces left'),
        state.terminal === 'lost' && h('button', { type:'button', className:'secondary-button light-button undo-button', onClick:onUndo, disabled:!canUndo, 'aria-label':'Undo last move' }, 'Undo last move'),
        h('button', { className: state.terminal === 'won'?'primary-button':'secondary-button defeat-retry', onClick: state.terminal === 'won' ? onNext : onReset },
          state.terminal === 'won' ? levelIndex + 1 === totalLevels ? 'Play from start' : 'Next level' : 'Try again'),
        state.terminal === 'won' && h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Play again'))) : null);
}
