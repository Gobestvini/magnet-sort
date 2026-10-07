import { h } from 'preact';
import { useId } from 'preact/hooks';

const paths = {
  pause: 'M21 16V48M43 16V48',
  play: 'M23 14L48 32 23 50Z',
  undo: 'M22 17L9 29 22 40M11 29H38C58 29 58 53 37 53',
  retry: 'M49 20A23 23 0 1 0 54 38M49 8V23H34',
  hint: 'M20 36C2 13 47-5 49 22C49 31 43 34 41 40H23M24 47H40M28 54H36',
  move: 'M12 32H52M32 12V52',
  close: 'M18 18L46 46M46 18L18 46',
  home: 'M9 29L32 10 55 29M16 26V54H48V26M27 54V37H37V54',
  time: 'M32 20V34L42 40M25 6H39M32 6V13M48 14L52 18',
  share: 'M32 39V8M20 20L32 8 44 20M16 32V53H48V32',
  link: 'M28 19L35 12C49-2 66 16 53 29L42 40C31 51 17 37 26 29M36 45L29 52C15 66-2 48 11 35L22 24C33 13 47 27 38 35',
  users: 'M8 54C8 35 30 33 30 54M35 54C35 38 56 36 56 54',
};

export function Icon({ name, className = '', filled = false }) {
  const gradientId = useId();
  if (name === 'star') return h('svg', { className: 'icon star-icon ' + className, viewBox: '0 0 64 64', 'aria-hidden': 'true' },
    h('defs', null, h('linearGradient', { id: gradientId, x2: '.4', y2: '1' },
      h('stop', { 'stop-color': filled ? '#fff49a' : '#dce0e5' }),
      h('stop', { offset: '.55', 'stop-color': filled ? '#ffd438' : '#b1b7c3' }),
      h('stop', { offset: '1', 'stop-color': filled ? '#ffaa0c' : '#9097a5' }))),
    h('path', { d: 'M29 6Q32 0 35 6L43 22 59 25Q64 26 60 31L48 43 51 59Q52 64 47 61L32 53 17 61Q12 64 13 59L16 43 4 31Q0 26 5 25L21 22Z', fill: 'url(#' + gradientId + ')', stroke: filled ? '#db8505' : '#7c8291', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
    filled && h('path', { d: 'M9 28L24 25 32 9', fill: 'none', stroke: '#fffdd1', 'stroke-width': '2.5', 'stroke-linecap': 'round' }));
  return h('svg', { className: 'icon ' + className, viewBox: '0 0 64 64', fill: 'none', stroke: 'currentColor', 'stroke-width': '6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    name === 'time' && h('circle', { cx: '32', cy: '36', r: '23' }),
    name === 'users' && [h('circle', { key: 'a', cx: '19', cy: '20', r: '10', fill: 'currentColor', stroke: 'none' }), h('circle', { key: 'b', cx: '46', cy: '24', r: '8', fill: 'currentColor', stroke: 'none' })],
    h('path', { d: paths[name] ?? paths.move, fill: name === 'play' ? 'currentColor' : 'none' }));
}
