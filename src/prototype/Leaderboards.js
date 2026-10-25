import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { leaderboardMessage } from './leaderboards-client.js';

function Row({ row, mode, own = false }) {
  return h('li', { className: 'leaderboard-row' + (own ? ' leaderboard-own' : ''), 'data-player-id': row.playerId },
    h('span', { className: 'leaderboard-rank' }, row.rank),
    h('span', { className: 'leaderboard-player' }, row.displayName || 'Player', own && h('small', null, 'You')),
    h('strong', { className: 'leaderboard-score' }, mode === 'daily' ? `${row.moves} moves` : `${row.completedLevels} levels`,
      mode === 'campaign' && h('small', null, `${row.stars} stars`)));
}

export function Leaderboards({ view, onClose, onTab, onRetry, onJoin, onLeave, onRetryPublication, onDiscardPending, onRemove, reduced }) {
  const ref = useRef(null), [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', escape, true);
    return () => { window.removeEventListener('keydown', escape, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const nodes = [...ref.current.querySelectorAll('button,a[href]')].filter(node => !node.disabled && !node.hidden);
    const first = nodes[0], last = nodes.at(-1);
    if (!ref.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const ownInRows = view.rows.some(row => row.playerId === view.ownRow?.playerId);
  return h('div', { className: 'modal-backdrop leaderboard-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leaderboards', ref, onKeyDown: keys, 'data-reduced': reduced },
    h('section', { className: 'modal-panel leaderboard-panel' },
      h('div', { className: 'leaderboard-heading' }, h('h2', null, 'LEADERBOARDS'), h('button', { type: 'button', className: 'secondary-button light-button', onClick: onClose, 'aria-label': 'Close leaderboards' }, 'Close')),
      h('div', { className: 'leaderboard-tabs', role: 'tablist', 'aria-label': 'Leaderboard mode' }, ['campaign', 'daily'].map(mode => h('button', {
        key: mode, type: 'button', className: 'secondary-button light-button', role: 'tab', 'aria-selected': view.tab === mode,
        onClick: () => onTab(mode), 'aria-controls': 'leaderboard-results'
      }, mode === 'daily' ? 'Daily' : 'Campaign'))),
      h('p', { className: 'leaderboard-rules' }, view.tab === 'daily' ? `Daily · ${view.date} UTC. Fewer moves wins on this shared board.` : 'Most completed levels, then total best stars. Campaign boards use different seeds.'),
      h('p', { className: 'leaderboard-help' }, 'Hint and Undo are allowed for everyone. Equal scores share a place.'),
      h('div', { id: 'leaderboard-results', className: 'leaderboard-results', role: 'tabpanel', 'aria-label': view.tab === 'daily' ? 'Daily leaderboard' : 'Campaign leaderboard', 'aria-busy': view.status === 'loading' },
        view.status === 'loading' && h('p', { role: 'status' }, 'Loading leaderboard…'),
        view.status === 'empty' && h('p', { role: 'status' }, 'No results yet. Be the first to complete a ranked board.'),
        view.status === 'error' && h('div', { role: 'status' }, h('p', null, leaderboardMessage(view.error)), h('button', { className: 'secondary-button light-button', onClick: onRetry }, 'Retry leaderboard')),
        ['ready', 'empty'].includes(view.status) && h('div', null,
          view.rows.length > 0 && h('ol', { className: 'leaderboard-list', 'aria-label': 'Top 50 players' }, view.rows.map(row => h(Row, { key: row.playerId, row, mode: view.tab, own: row.playerId === view.ownRow?.playerId }))),
          view.ownRow && !ownInRows && h('div', { className: 'leaderboard-own-outside' }, h('p', null, 'Your place'), h('ol', { className: 'leaderboard-list' }, h(Row, { row: view.ownRow, mode: view.tab, own: true }))),
          !view.ownRow && h('p', { className: 'leaderboard-no-score' }, 'You have no submitted win in this ranking.'))),
      h('section', { className: 'leaderboard-participation', 'aria-label': 'Leaderboard participation' },
        !view.eligible ? h('p', {role:'status'}, 'Friend challenges are not ranked. You can read these leaderboards; return to Campaign or Daily to share your wins.') :
        !view.canParticipate ? h('div', null, h('p', null, 'Play from the Magnet Sort bot in Telegram to submit your results. You can read the rankings here.'),
          h('a', { className: 'secondary-button light-button', href: 'https://t.me/MagnetSortPuzzleBot?startapp', target: '_blank', rel: 'noopener noreferrer' }, 'Play in Telegram')) :
        h('div', null,
          view.authError && h('p', { role: 'status' }, leaderboardMessage(view.authError)),
          !view.consent ? h('div', null, h('p', null, 'Join to show your Telegram first name and automatically submit wins from your ranked attempts.'),
            h('button', { type: 'button', className: 'secondary-button light-button', onClick: onJoin, disabled: !view.available || view.deleting }, 'Join leaderboards')) :
          h('div', null,
            h('p', null, 'Sharing wins is on. Your local game always stays on this device.'),
            h('p', { className: 'leaderboard-publication', role: 'status' }, ({ sending: 'Sending ranked result…', registered: 'This attempt is registered. A win will be submitted.', sent: 'Result submitted.', pending: 'A saved win is waiting to be sent.', error: 'Result not sent. ' + leaderboardMessage(view.publicationError) })[view.publication] ?? 'Ready for your next ranked attempt.'),
            view.savedResultMode && view.publication !== 'sent' && h('p', {role:'status'},`Saved ${view.savedResultMode === 'daily' ? 'Daily' : 'Campaign'} result submitted.`),
            view.pendingCount > 0 && h('p', null, `One unsent win per mode is kept. Your saved ${view.pendingMode === 'daily' ? 'Daily' : 'Campaign'} result stays available after leaving this board. Submit it before another win in the same mode.`),
            view.rankingSaveFailed && h('p', null, 'The unsent result could not be saved on this device. Keep this tab open until it is submitted.'),
            (view.publication === 'error' || view.publication === 'pending') && h('button', { type: 'button', className: 'secondary-button light-button', onClick: onRetryPublication }, 'Retry submission'),
            view.pendingCount > 0 && view.publication !== 'sending' && h('button', { type:'button',className:'leaderboard-text-button',onClick:onDiscardPending }, 'Discard saved result'),
            h('button', { type: 'button', className: 'secondary-button light-button', onClick: onLeave }, 'Pause sharing')),
          view.signedIn && h('div', { className: 'leaderboard-delete' },
            h('button', { type: 'button', className: 'leaderboard-text-button', onClick: () => setConfirmRemove(!confirmRemove), disabled: view.deleting }, 'Remove my leaderboard data'),
            confirmRemove && h('div', null, h('p', null, 'Remove your online records and sign-in? Your local progress stays. Records may remain in encrypted backups until those backups expire.'),
              h('button', { type: 'button', className: 'secondary-button light-button', disabled: view.deleting, onClick: () => { setConfirmRemove(false); onRemove(); } }, view.deleting ? 'Removing…' : 'Confirm remove online data')))))));
}
