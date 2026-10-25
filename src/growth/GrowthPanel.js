import { h } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { art } from '../prototype/assets.js';
import './growth.css';

const labels = { progress: 'Progress and rewards', privacy: 'Privacy', shop: 'Shop' };
const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
const action = (label, onClick, props = {}) => h('button', {
  type: 'button', className: 'secondary-button light-button growth-button', onClick, ...props,
}, label);
const pluralWins = count => `${count} campaign ${count === 1 ? 'win' : 'wins'}`;

function MetaStatus({ meta, onReloadMeta }) {
  const status = meta?.status;
  if (!status || (status.saved && !status.clockRollback)) return null;
  const text = status.clockRollback ? 'The device date moved backwards. Correct the date to continue earning rewards. Your unlocked cosmetics are still available.' : ({
    conflict: 'Rewards changed in another tab. Reload local rewards to use the latest progress.',
    'invalid-data': 'Saved rewards could not be read. The existing record has been kept.',
    'unsupported-version': 'These saved rewards belong to a different game version. The existing record has been kept.',
  }[status.reason] ?? 'Rewards cannot be saved on this device right now. You can keep playing; new rewards will not be saved.');
  return h('aside', { className: 'growth-warning', role: 'status' },
    h('p', null, text), status.reason === 'conflict' && action('Reload rewards', onReloadMeta));
}

function ProgressView({ meta, onClaimQuest, onSelectEmblem, onSelectFrame, onReloadMeta }) {
  if (!meta) return h('p', { role: 'status' }, 'Rewards are not available yet.');
  const canSave = meta.status?.saved === true && !meta.status?.clockRollback;
  return h('div', { className: 'growth-progress' },
    h(MetaStatus, { meta, onReloadMeta }),
    h('div', { className: 'growth-stamp-ribbon', 'aria-label': `${meta.stamps} cosmetic stamps` },
      h('span', { className: 'growth-stamp-symbol', 'aria-hidden': 'true' }, '✦'),
      h('strong', null, meta.stamps), h('span', null, 'COSMETIC STAMPS')),
    h('section', { className: 'growth-section', 'aria-labelledby': 'growth-weekly-title' },
      h('div', { className: 'growth-section-heading' }, h('h3', { id: 'growth-weekly-title' }, 'Weekly quests'),
        h('span', { className: 'growth-week-tag' }, meta.weekId)),
      h('p', { className: 'growth-caption' }, 'Resets ', meta.weekEndsAt, ' at 00:00 UTC. Same board counts once per week; improving a finished board adds only the extra chips.'),
      h('ul', { className: 'growth-quests' }, (meta.quests ?? []).map(quest => h('li', { key: quest.id, className: 'growth-quest', 'data-claimed': String(quest.claimed) },
        h('div', { className: 'growth-quest-top' }, h('strong', null, quest.label),
          h('span', { className: 'growth-quest-reward' }, '+', quest.reward, ' ✦')),
        h('div', { className: 'growth-quest-bottom' },
          h('div', { className: 'growth-quest-meter' },
            h('progress', { max: quest.target, value: quest.progress, 'aria-label': quest.label }),
            h('span', { className: 'growth-count' }, quest.progress, ' / ', quest.target)),
          action(quest.claimed ? 'Claimed' : quest.complete ? 'Collect stamp' : 'In progress', () => onClaimQuest?.(quest.id), {
            disabled: !canSave || !quest.complete || quest.claimed,
            'aria-label': quest.claimed ? `${quest.label}, reward collected` : `Collect reward: ${quest.label}`,
          })))))),
    h('section', { className: 'growth-section', 'aria-labelledby': 'growth-collection-title' },
      h('div', { className: 'growth-section-heading' }, h('h3', { id: 'growth-collection-title' }, 'Magnet collection'),
        h('span', { className: 'growth-count' }, meta.uniqueWins, ' unique wins')),
      h('p', { className: 'growth-caption' }, 'Each campaign board counts once for this collection. Pick an unlocked emblem to wear beside the logo.'),
      h('div', { className: 'growth-emblems' }, (meta.emblems ?? []).map(emblem => h('button', {
        type: 'button', key: emblem.id, className: 'growth-emblem', disabled: !meta.status?.saved || !emblem.unlocked,
        'aria-pressed': emblem.selected, 'data-unlocked': String(emblem.unlocked),
        'aria-label': `${emblem.label}, ${emblem.selected ? 'selected' : emblem.unlocked ? 'unlocked' : 'locked, ' + pluralWins(emblem.threshold) + ' needed'}`,
        onClick: () => onSelectEmblem?.(emblem.id),
      }, h('img', { src: art('magnet-' + emblem.color), alt: '', draggable: false }),
      h('strong', null, emblem.label), h('small', null, emblem.selected ? 'Equipped' : emblem.unlocked ? 'Select' : pluralWins(emblem.threshold)))))),
    h('section', { className: 'growth-section', 'aria-labelledby': 'growth-frames-title' },
      h('h3', { id: 'growth-frames-title' }, 'Stamp frames'),
      h('p', { className: 'growth-caption' }, '3 stamps unlock the Golden frame; 6 unlock the Star frame. Stamps are not spent. All frames can be earned from quests without watching ads.'),
      h('div', { className: 'growth-frames' }, (meta.frames ?? []).map(frame => h('button', {
        type: 'button', key: frame.id, className: 'growth-frame-choice', 'data-frame': frame.id,
        disabled: !meta.status?.saved || !frame.unlocked, 'aria-pressed': frame.selected,
        'aria-label': `${frame.label}, ${frame.selected ? 'selected' : frame.unlocked ? 'unlocked' : 'locked, ' + frame.threshold + ' stamps needed'}`,
        onClick: () => onSelectFrame?.(frame.id),
      }, h('span', { className: 'growth-frame-preview', 'aria-hidden': 'true' }, h('img', { src: art('magnet-violet'), alt: '', draggable: false })),
      h('strong', null, frame.label), h('small', null, frame.selected ? 'Equipped' : frame.unlocked ? 'Select' : `${frame.threshold} stamps`))))),
    h('p', { className: 'growth-local-note' }, 'Quest stamps, emblems and frames are local cosmetics on this device. Clearing this game’s browser data removes them. They are separate from purchases.'));
}

function PrivacyView({ analytics = {}, onConsent }) {
  const supported = analytics.available === true && analytics.configured === true;
  return h('div', { className: 'growth-privacy' },
    h('div', { className: 'growth-privacy-status', 'data-enabled': String(analytics.consent === true) },
      h('span', { className: 'growth-status-dot', 'aria-hidden': 'true' }),
      h('strong', null, analytics.consent ? 'Analytics is on' : 'Analytics is off')),
    h('section', { className: 'growth-section' }, h('h3', null, 'Help us improve the puzzles'),
      h('p', null, 'Optional gameplay analytics helps us see whether players understand the first move, finish levels and return to play. Your choice does not change access to the game or rewards.'),
      h('ul', { className: 'growth-privacy-list' },
        h('li', null, 'Only after you allow it: a random identifier and gameplay events such as level starts, moves, results, platform and game version.'),
        h('li', null, 'No Telegram profile, chat data, full URLs or advertising identifier is included in gameplay events.'),
        h('li', null, 'Usage data is retained for up to 35 days. You can switch analytics off and request deletion here.')),
      h('p', { className: 'growth-caption' }, 'The service receives your network connection to deliver requests. We do not use your Telegram account to identify analytics data.'),
      !supported && h('p', { className: 'growth-warning', role: 'status' }, 'Gameplay analytics is not available in this version or on this platform. It remains off.'),
      h('div', { className: 'growth-privacy-actions' },
        action(analytics.consent ? 'Analytics enabled' : 'Allow analytics', () => onConsent?.(true), {
          className: 'secondary-button light-button growth-button', disabled: !supported || analytics.consent === true,
        }),
        action('Disable and delete usage data', () => onConsent?.(false)))),
    h('section', { className: 'growth-section' }, h('h3', null, 'Local progress and purchases'),
      h('p', null, 'Game saves and free cosmetic rewards stay on this device independently of analytics. Confirmed purchases are stored separately so they can be restored with the same payment account.'),
      h('p', { className: 'growth-caption' }, 'Turning analytics off does not delete your game progress or purchases.')),
    h('p', { className: 'growth-local-note' }, 'Privacy questions: ', h('a', { href: 'mailto:support@plusvibegames.com' }, 'support@plusvibegames.com')));
}

function ShopView({ commerce = {}, aurora, onPurchase, onRestore }) {
  const busy = Boolean(commerce.busy), loading = commerce.loading === true;
  const products = (Array.isArray(commerce.products) ? commerce.products : []).filter(product =>
    typeof product?.id === 'string' && typeof product.title === 'string' && typeof product.description === 'string' &&
    product.currency === 'XTR' && Number.isSafeInteger(product.amount) && product.amount > 0);
  const entitlements = new Set(Array.isArray(commerce.entitlements) ? commerce.entitlements : []);
  return h('div', { className: 'growth-shop' },
    h('p', { className: 'growth-shop-intro' }, 'Support Magnet Sort with a permanent cosmetic. Every campaign level and free reward remains available without a purchase.'),
    loading ? h('p', { className: 'growth-store-state', role: 'status' }, 'Loading available products…') :
      !commerce.purchases || products.length === 0 ? h('p', { className: 'growth-store-state', role: 'status' },
        'The shop is not available here yet. You can still play every level and earn free cosmetics.') :
        h('div', { className: 'growth-products' }, products.map(product => {
          const owned = entitlements.has(product.entitlement ?? product.id);
          return h('section', { key: product.id, className: 'growth-product', 'aria-label': product.title },
            h('div', { className: 'growth-aurora-preview', 'aria-hidden': 'true' },
              h('img', { src: art('magnet-violet'), alt: '', draggable: false }), h('span', null, '✦')),
            h('h3', null, product.title), h('p', null, product.description),
            h('p', { className: 'growth-price' }, product.amount, ' XTR ', h('small', null, '(Telegram Stars)')),
            action(owned ? 'Owned' : busy ? 'Payment in progress…' : `Buy for ${product.amount} Stars`, () => onPurchase?.(product.id), {
              disabled: busy || owned, className: 'primary-button growth-button',
              'aria-label': owned ? `${product.title}, owned` : `Buy ${product.title} for ${product.amount} Telegram Stars`,
            }));
        })),
    aurora && h('p', { className: 'growth-owned-message' }, 'Aurora is unlocked and applied to your game.'),
    action('Restore purchases', onRestore, { disabled: busy || loading || !commerce.purchases }),
    h('p', { className: 'growth-caption' }, 'A payment is confirmed by the server before its cosmetic is unlocked. To restore a Telegram purchase, use the same Telegram account.'),
    h('p', { className: 'growth-local-note' }, 'Purchase support and refunds: use /paysupport in the game’s Telegram bot or email ',
      h('a', { href: 'mailto:support@plusvibegames.com' }, 'support@plusvibegames.com'), '.'));
}

export function GrowthPanel({ view = 'progress', data = {}, onClose, onConsent, onClaimQuest,
  onSelectEmblem, onSelectFrame, onReloadMeta, onPurchase, onRestore }) {
  const ref = useRef(null), busyRef = useRef(false);
  busyRef.current = Boolean(data.commerce?.busy);
  const label = labels[view] ?? labels.progress;
  function nodes() {
    return [...(ref.current?.querySelectorAll(focusable) ?? [])].filter(node =>
      !node.closest('[inert]') && node.getClientRects().length > 0);
  }
  useLayoutEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('.growth-close')?.focus({ preventScroll: true });
    const keepFocus = event => {
      // A payment/ad provider may briefly own a native or external iframe dialog.
      if (!busyRef.current && ref.current && !ref.current.contains(event.target))
        (nodes()[0] ?? ref.current).focus({ preventScroll: true });
    };
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.removeEventListener('focusin', keepFocus);
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [view]);
  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose?.(); return; }
    if (event.key !== 'Tab' || busyRef.current) return;
    const available = nodes(), first = available[0], last = available.at(-1);
    if (!first) { event.preventDefault(); ref.current?.focus(); return; }
    if (!ref.current.contains(document.activeElement) || document.activeElement === ref.current) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const content = view === 'privacy' ? h(PrivacyView, { analytics: data.analytics, onConsent }) :
    view === 'shop' ? h(ShopView, { commerce: data.commerce, aurora: data.aurora, onPurchase, onRestore }) :
      h(ProgressView, { meta: data.meta, onClaimQuest, onSelectEmblem, onSelectFrame, onReloadMeta });
  return h('div', { className: 'growth-overlay', ref, role: 'dialog', 'aria-modal': 'true',
    'aria-label': label, tabIndex: -1, onKeyDown: keys, 'data-view': view },
  h('div', { className: 'growth-panel cream-panel' },
    h('header', { className: 'growth-header' }, h('div', null,
      h('p', { className: 'growth-eyebrow' }, 'MAGNET SORT'), h('h2', null, label)),
    h('button', { type: 'button', className: 'round-button growth-close', onClick: onClose, 'aria-label': 'Close ' + label.toLowerCase() },
      h('img', { src: art('close'), alt: '', draggable: false }))),
    h('div', { className: 'growth-content' }, content,
      data.message && h('p', { className: 'growth-message', role: 'status', 'aria-live': 'polite' }, data.message))));
}
