import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

// CSS owns the decorative sweep. No second RAF or game-state timer.
export function IdleBackdrop({ active }) {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return h('div', { className: 'idle-grid', 'aria-hidden': 'true', 'data-active': active && visible ? 'true' : 'false' },
    h('div', { className: 'idle-grid-sweep' }));
}
