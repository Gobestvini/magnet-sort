import { h } from 'preact';
import { useEffect, useRef, useLayoutEffect, useState } from 'preact/hooks';
import { COLORS, remainingUnits } from './model.js';
import { art } from './assets.js';
import { IdleBackdrop } from './IdleBackdrop.js';
import { magnetRadius, rangeArt, rangeHue } from './magnet-radius.js';
import { potentialStars } from './model-v4.js';
import { assetUrl } from '../art/urls.js';
import { TutorialGuide } from './TutorialGuide.js';
import { forecastText } from './spawn-forecast.js';
import { Leaderboards } from './Leaderboards.js';

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

function Modal({ children, label, onClose, variant = '', reduced = false,closeLabel='Close pause' }) {
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
    h('div', { className: 'modal-panel' }, onClose && h('button', { className: 'round-button modal-close', onClick: onClose, 'aria-label': closeLabel }, h('img', { src: art('close'), alt: '' })), children));
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

function DailyPanel({daily,mode,onDaily,onReturnCampaign,onRetryDaily,result=false}) {
  if(!daily)return null;
  const active=mode==='daily';
  const best=daily.best, describe=entry=>!entry?'—':entry.outcome==='won'?`${entry.moves} moves`:'Not completed';
  return h('section',{className:'daily-panel','aria-label':'Daily board'},
    h('strong',{className:'daily-date'},'DAILY · ',active?daily.date:daily.today,' UTC'),
    h('p',{className:'daily-description'},'One shared board per UTC day. Local results on this device; the day uses your device clock.'),
    active&&daily.date!==daily.today&&h('p',null,'This attempt stays on ',daily.date,'. Return to campaign to open today’s board.'),
    h('div',{className:'daily-calendar','aria-label':'Last seven UTC days'},daily.calendar.map(day=>h('span',{
      key:day.date,'data-date':day.date,'data-completed':String(day.completed),'aria-label':day.date+(day.completed?' completed':' not completed')
    },h('small',null,day.date.slice(5)),h('b',{'aria-hidden':'true'},day.completed?'✓':'·')))),
    active&&h('p',{className:'daily-best'},h('strong',null,'Local best'),h('span',null,'Without help: ',describe(best?.bestUnassisted)),h('span',null,'With help: ',describe(best?.bestAssisted))),
    !daily.status.saved&&h('p',{className:'daily-save-warning',role:'status'},daily.status.reason==='conflict'?'Daily progress changed in another tab. This tab is not saving.':
      ['invalid-data','unsupported-version'].includes(daily.status.reason)?'The saved daily board is incompatible. It has been kept.':'Daily progress cannot be saved. You can play in this tab.'),
    active?[
      result&&h('button',{type:'button',className:'secondary-button light-button','aria-label':'Retry daily',onClick:onRetryDaily},'Retry daily'),
      h('button',{type:'button',className:'secondary-button light-button','aria-label':'Return to campaign',onClick:onReturnCampaign},'Return to campaign')
    ]:h('button',{type:'button',className:'secondary-button light-button','aria-label':'Daily board',onClick:onDaily},'Daily board'));
}

function ChallengeClaim({descriptor}) {
  return h('div',{className:'challenge-claim'},
    h('strong',null,'Shared score, unverified'),
    h('p',null,`Level ${descriptor.levelNumber} · ${descriptor.moves} moves · ${descriptor.assisted?'with help':'without help'}`),
    h('small',null,'The link reproduces the starting board and rules. The claimed score is not verified.'));
}
function ChallengeResult({challenge,state,attempt}) {
  const comparison=challenge?.comparison;if(!comparison)return null;
  return h('section',{className:'challenge-comparison','aria-label':'Challenge comparison'},
    h('p',null,`Your result: ${state.movesUsed} moves · ${attempt.assisted?'with help':'without help'}`),
    h(ChallengeClaim,{descriptor:challenge.descriptor}),
    state.terminal==='won'&&h('p',null,comparison.comparable?({better:'Fewer moves than the shared score.',equal:'The same number of moves as the shared score.',worse:'More moves than the shared score.'}[comparison.outcome]):'Different help categories. These results are shown separately.'),
    h('small',null,'Challenge results do not change campaign achievements.'));
}

// A viewport overlay follows the actual projected empty tile. It has no input
// handlers or animation clock, and never covers stack faces or intercepts taps.
function HintMarker({ hint, getTarget }) {
  const ref = useRef(null), [target, setTarget] = useState(null);
  useLayoutEffect(() => {
    const host = ref.current?.closest('.prototype-shell')?.querySelector('.board-host');
    if (!host) return;
    const measure = () => {
      const next = getTarget();
      setTarget(previous => next && previous && next.x === previous.x && next.y === previous.y && next.size === previous.size ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(host);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, { passive:true });
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure); };
  }, [hint, getTarget]);
  return h('div', { ref, className:'hint-marker', 'aria-hidden':'true', 'data-color':hint.color,
    'data-target-cell':`${hint.cell.col},${hint.cell.row}`, hidden:!target,
    style:target ? {left:`${target.x}px`,top:`${target.y}px`,width:`${target.size * .85}px`,height:`${target.size * .66}px`} : {} },
    h('span', null, '?'));
}

export function PrototypeApp({ level, levelIndex, totalLevels, state, phase, selected, paused, notice,
  reduced, runId, canvasRef, hostRef, dragRef, collectionRef, counterRef, progressRef, onSelect, onToolDown, onPause, onReset, onNext, onHint, onReduced, keyboardCell, onKeyboard, error, onRetryRenderer, loading, loadingProgress, getTutorialTarget, hintChoice, getHintTarget, audioSettings, onAudioChange, saveStatus, onFreshSave, onReloadSave, spawnForecast, canUndo, onUndo, mode='campaign',daily,onDaily,onReturnCampaign,onRetryDaily,
  leaderboards,onLeaderboards,onCloseLeaderboards,onLeaderboardTab,onLeaderboardRetry,onLeaderboardJoin,onLeaderboardLeave,onLeaderboardRetrySubmission,onLeaderboardDiscardPending,onLeaderboardRemove,
  challenge,shareDialog,canShare,onPlayChallenge,onCancelChallenge,onRetryChallenge,onShareChallenge,onCopyChallenge,onCloseShare,attempt }) {
  const inDaily=mode==='daily',inChallenge=mode==='challenge',dailyUnavailable=Boolean(daily?.error)&&!inChallenge;
  const dailyPanel=(result=false)=>!inChallenge&&h(DailyPanel,{daily,mode,onDaily,onReturnCampaign,onRetryDaily,result});
  const tutorial = mode==='campaign' && levelIndex === 0 && state.turn === 0 && phase === 'playing';
  const tutorialMessage = tutorial && !hintChoice && !notice.includes('occupied') && !notice.startsWith('Hint:');
  const result = state.terminal && phase !== 'resolving';
  const overlay = paused || result || Boolean(error) || loading || dailyUnavailable || challenge?.preview || Boolean(shareDialog);
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
        h('h1', { className: 'level-badge'+(inDaily?' daily-badge':'')+(inChallenge?' challenge-badge':''),'aria-label':inDaily?'Daily board '+daily.date:inChallenge?'Friend challenge':undefined }, inChallenge?'CHALLENGE':inDaily?'DAILY':'LEVEL ', inDaily?h('small',{className:'daily-date'},daily.date.slice(5)):inChallenge?null:levelIndex + 1),
        h('button', { className: 'round-button', onClick: onPause, disabled: Boolean(error), 'aria-label': 'Pause' }, h('img', { src: art('pause'), alt: '' }))),
      h('section', { className: 'hud', 'aria-label': 'Puzzle progress' },
        h('div', { className: 'goal-panel cream-panel' },
          h('strong', null, 'COLLECTED ', h('span', { className: 'cleared-count', ref: counterRef }, state.cleared), ' / ', goal),
          h('div', { className: 'progress-track', ref: progressRef, role: 'progressbar', 'aria-label': 'Pieces collected', 'aria-valuenow': Math.min(goal,state.cleared), 'aria-valuemin': 0, 'aria-valuemax': goal },
            h('div', { style: { width: progress + '%' } }))),
        h('div', { className: 'moves-group' },
          !inChallenge&&h('div', { className:'potential-stars', 'data-reduced':reduced, role:'img', 'aria-label':`Potential stars: ${potentialStars(goal,state.movesUsed??state.turn)} of 3` },
            [1,2,3].map(n=>h('img',{key:n,src:art('moves-star'),alt:'',className:n<=potentialStars(goal,state.movesUsed??state.turn)?'lit':'dim'}))),
          h('div', { className: 'moves-panel cream-panel' }, h('span', null, 'MOVES'), h('strong', null, state.movesUsed??state.turn))),
      spawnForecast && h('p', { className: 'spawn-forecast', title: 'Up to this many stacks, if space remains',
        'aria-label': forecastText(spawnForecast) + '. Up to this many stacks, if space remains.' }, forecastText(spawnForecast))),
      h('section', { className: 'board-panel', 'aria-label': 'Game board' },
        h('div', { className: 'board-host', ref: hostRef },
          h('canvas', { ref: canvasRef, tabIndex: overlay ? -1 : 0, 'aria-label': 'Board: arrow keys select a tile, Enter places a magnet', onKeyDown: onKeyboard, 'aria-describedby': 'keyboard-cell hint-cell' })),
        h('p', { id: 'keyboard-cell', className: 'sr-only' }, keyboardCell ? 'Tile: row ' + keyboardCell.row + ', column ' + keyboardCell.col : 'Use arrow keys to select a tile.'),
        h('p', { id:'hint-cell', className:'sr-only' }, hintChoice ? `Hint tile: row ${hintChoice.cell.row}, column ${hintChoice.cell.col}. ${notice}` : '')),
      h('p', { className: 'game-status' + (tutorialMessage ? ' tutorial-message cream-panel' : '') + (notice.startsWith('Hint:') ? ' hint-message' : ''), role: 'status', 'aria-live': 'polite' },
        tutorialMessage ? h('span', null, h('strong', null, `Collect ${goal} pieces!`), h('small', null, 'Drag a magnet onto an empty tile. You can also tap.')) : phase === 'resolving' ? 'Pulling one piece at a time…' : notice),
      h('section', { className: 'controls', 'aria-label': 'Magnets and actions' },
        h(MagnetTray,{state,selected,locked,reduced,onSelect,onToolDown}),
        h('div', { className: 'action-row' },
          h('button', { type: 'button', className: 'secondary-button undo-button', onClick: onUndo, disabled: !canUndo, 'aria-label': 'Undo last move' }, 'Undo'),
          h('button', { type:'button', className:'secondary-button hint-button', onClick:onHint, disabled:locked, 'aria-label':'Hint' }, 'Hint'),
          h('button', { className: 'secondary-button restart-button', onClick: onReset, 'aria-label': 'Restart' }, h('img', { className: 'restart-icon', src: art('restart'), alt: '' }), ' Restart')),
        h('p', { className: 'sr-only' }, 'Collect the goal using up to three magnets matching exposed stack colors. The badge shows one or two hex rings. Magnets pull exposed matching colors directly, including over crosses. Every ten pieces go to the progress bar.'))),
    tutorial && !overlay && !hintChoice && !notice.startsWith('Hint:') && h(TutorialGuide, {color:selected,getTarget:getTutorialTarget,runId,reduced}),
    hintChoice && !locked && h(HintMarker, {hint:hintChoice,getTarget:getHintTarget}),
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
    challenge?.preview ? h(Modal,{key:'challenge-preview',label:challenge.error?'Challenge unavailable':'Friend challenge',reduced,variant:'pause-dialog challenge-dialog'},
      h('h2',null,challenge.error?'CHALLENGE UNAVAILABLE':'FRIEND CHALLENGE'),
      challenge.error?h('p',null,challenge.error==='unsupported'?'This link uses another game version or rule set. Update the game or return to campaign.':'This challenge link could not be read. Your campaign has been kept.'):
        h(ChallengeClaim,{descriptor:challenge.descriptor}),
      !challenge.error&&h('button',{className:'primary-button challenge-action',onClick:onPlayChallenge},'Play challenge'),
      !challenge.error&&h('button',{className:'secondary-button light-button challenge-action',onClick:onCancelChallenge},'Cancel'),
      challenge.error&&h('button',{className:'secondary-button light-button challenge-action',onClick:onReturnCampaign},'Return to campaign'),
      challenge.error&&h('button',{className:'secondary-button light-button challenge-action',onClick:onReloadSave},'Update game')) :
    shareDialog ? h(Modal,{key:'challenge-share',label:'Share challenge',reduced,variant:'pause-dialog challenge-dialog',onClose:onCloseShare,closeLabel:'Close share'},
      h('h2',null,'SHARE CHALLENGE'),h(ChallengeClaim,{descriptor:shareDialog.descriptor}),
      h('label',{className:'challenge-link-label'},'Challenge link',h('input',{className:'challenge-link',readOnly:true,value:shareDialog.url,'aria-label':'Challenge link',onFocus:event=>event.currentTarget.select()})),
      h('p',{className:'challenge-status',role:'status','aria-live':'polite'},shareDialog.copy==='copied'?'Link copied.':shareDialog.copy==='error'?'Could not copy. Select the link and copy it manually.':
        ({opening:'Opening sharing…',opened:'Share window opened. Choose where to share; delivery is not confirmed.',cancelled:'Sharing cancelled. You can still copy the link.',unsupported:'Sharing is unavailable here. Copy the link.',error:'Sharing could not open. Copy the link.'}[shareDialog.status])),
      h('button',{className:'secondary-button light-button challenge-action',onClick:onCopyChallenge},'Copy link'),
      h('button',{className:'secondary-button light-button challenge-action',onClick:onCloseShare},'Close')) :
    dailyUnavailable ? h(Modal,{key:'daily-error',label:'Daily unavailable',reduced,variant:'pause-dialog'},
      h('h2',null,'DAILY UNAVAILABLE'),h('p',null,'This saved daily board could not be opened. Its data has been kept. Return to campaign or update the game.'),
      h('button',{className:'secondary-button light-button daily-recovery-button',onClick:onReturnCampaign,'aria-label':'Return to campaign'},'Return to campaign'),
      h('button',{className:'secondary-button light-button daily-recovery-button',onClick:onReloadSave,'aria-label':'Update game'},'Update game')) :
    leaderboards?.open ? h(Leaderboards, { view:leaderboards,onClose:onCloseLeaderboards,onTab:onLeaderboardTab,onRetry:onLeaderboardRetry,
      onJoin:onLeaderboardJoin,onLeave:onLeaderboardLeave,onRetryPublication:onLeaderboardRetrySubmission,onDiscardPending:onLeaderboardDiscardPending,onRemove:onLeaderboardRemove,reduced }) :
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
      leaderboards&&h('button',{type:'button',className:'secondary-button light-button leaderboard-entry',onClick:onLeaderboards},'Leaderboards'),
      h('button', { className: 'secondary-button light-button'+(inDaily?' daily-retry-button':'')+(inChallenge?' challenge-action':''), onClick: inChallenge?onRetryChallenge:onReset,'aria-label':inChallenge?'Retry challenge':inDaily?'Retry daily':'Restart' }, inChallenge?'Retry challenge':inDaily?'Retry daily':'Restart'),
      inChallenge&&h('button',{className:'secondary-button light-button challenge-action',onClick:onReturnCampaign},'Return to campaign'),
      !inDaily&&!inChallenge&&h(SaveStatus, { status: saveStatus, onFreshSave, onReloadSave }),dailyPanel()) :
    result ? h(Modal, { key:state.terminal, reduced, label: state.terminal === 'won' ? 'Victory' : 'Board full', variant: state.terminal === 'won' ? 'victory-dialog' : 'defeat-dialog' },
      h('div', { className: 'result-card', role: 'region', 'aria-label': 'Result' },
        state.terminal === 'won' ? null : h('h2', { className: 'live-heading defeat-heading' }, 'BOARD FULL'),
        state.terminal === 'won' ? h('h2', { className: 'result-title' }, inChallenge?'CHALLENGE COMPLETE!':inDaily?'DAILY COMPLETE!':'LEVEL COMPLETE!') : h('p',{className:'defeat-reason'},'No empty tiles left'),
        state.terminal === 'lost' && h('img',{className:'defeat-illustration',src:art('defeat-illustration'),alt:'',draggable:false}),
        !inChallenge&&state.terminal === 'won' && h('div',{className:'earned-stars','aria-label':`${state.stars??0} stars earned`},[1,2,3].map(n=>h('img',{src:art('victory-star-v2'),alt:'',className:n<=(state.stars??0)?'earned':'unearned'}))),
        h('div', {className:'victory-stats'}, h('p',null,state.movesUsed??state.turn,h('small',null,'MOVES')),h('p',null,`${state.cleared} / ${goal}`,h('small',null,'COLLECTED'))),
        state.terminal === 'lost' && h('small', null, remainingUnits(state) + ' pieces left'),
        state.terminal === 'lost' && h('button', { type:'button', className:'secondary-button light-button undo-button', onClick:onUndo, disabled:!canUndo, 'aria-label':'Undo last move' }, 'Undo last move'),
        !inDaily&&!inChallenge&&h('button', { className: state.terminal === 'won'?'primary-button':'secondary-button defeat-retry', onClick: state.terminal === 'won' ? onNext : onReset },
          state.terminal === 'won' ? levelIndex + 1 === totalLevels ? 'Play from start' : 'Next level' : 'Try again'),
        !inDaily&&!inChallenge&&state.terminal === 'won' && h('button', { className: 'secondary-button light-button', onClick: onReset }, 'Play again'),
        inChallenge&&h(ChallengeResult,{challenge,state,attempt}),
        inChallenge&&h('button',{className:'secondary-button light-button challenge-action',onClick:onRetryChallenge},'Retry challenge'),
        inChallenge&&h('button',{className:'secondary-button light-button challenge-action',onClick:onReturnCampaign},'Return to campaign'),
        state.terminal==='won'&&canShare&&h('button',{className:'secondary-button light-button challenge-action',onClick:onShareChallenge},'Challenge a friend'),
        leaderboards&&h('button',{type:'button',className:'secondary-button light-button leaderboard-entry',onClick:onLeaderboards},'Leaderboards'),dailyPanel(true))) : null);
}
