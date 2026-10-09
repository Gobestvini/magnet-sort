import { h } from 'preact';
import { COLORS, remainingUnits } from './model.js';

export function MagnetIcon({ color = '#9463ed' }) {
  return h('svg', { viewBox: '0 0 48 48', fill: 'none', 'aria-hidden': 'true' },
    h('path', { d: 'M10 8v19a14 14 0 0 0 28 0V8H28v19a4 4 0 0 1-8 0V8Z', fill: color }),
    h('path', { d: 'M10 8h10v8H10zm18 0h10v8H28z', fill: '#f5f6ff' }));
}

export function PrototypeApp({ level, levelIndex, totalLevels, state, phase, selected, paused, notice,
  reduced, canvasRef, hostRef, onSelect, onToolDown, onPause, onReset, onNext, onHint, onReduced, keyboardCell, onKeyboard, error, onRetryRenderer }) {
  const locked = paused || phase === 'resolving' || Boolean(state.terminal) || Boolean(error);
  const progress = state.cleared / state.initialUnits * 100;
  return h('main', { className: 'prototype-shell' },
    h('header', { className: 'topbar' },
      h('a', { className: 'brand', href: '#', onClick: event => event.preventDefault(), 'aria-label': 'Magnet Sort' },
        h('span', { className: 'brand-icon' }, h(MagnetIcon)), h('span', null, 'magnet', h('b', null, 'sort'))),
      h('span', { className: 'edition' }, 'МАЛЕНЬКОЕ ДЕЙСТВИЕ. БОЛЬШАЯ ЦЕПОЧКА.'),
      h('button', { className: 'quiet-button', onClick: onPause, disabled: Boolean(error), 'aria-label': paused ? 'Продолжить' : 'Пауза' }, paused ? '▶' : 'Ⅱ')),
    h('div', { className: 'play-layout' },
      h('section', { className: 'board-panel', 'aria-label': 'Игровое поле' },
        h('div', { className: 'level-heading' }, h('span', { className: 'eyebrow' }, `ЭКСПЕРИМЕНТ ${String(levelIndex + 1).padStart(2, '0')} / ${String(totalLevels).padStart(2, '0')}`),
          h('h1', null, level.title), h('p', null, level.subtitle)),
        h('div', { className: 'board-host', ref: hostRef },
          h('div', { className: 'board-glow', 'aria-hidden': 'true' }),
          h('canvas', { ref: canvasRef, tabIndex: 0, 'aria-label': 'Поле: стрелки выбирают клетку, Enter ставит магнит',
            onKeyDown: onKeyboard, 'aria-describedby': 'keyboard-cell' }),
          h('span', { className: 'board-caption' }, 'ПОСТАВЬ МАГНИТ · НАБЛЮДАЙ ПРИТЯЖЕНИЕ'),
          paused && h('div', { className: 'curtain' }, h('span', { className: 'eyebrow' }, 'МОЖНО НЕ СПЕШИТЬ'), h('h2', null, 'Пауза'), h('button', { className: 'primary-button', onClick: onPause }, 'Продолжить')),
          error && h('div', { className: 'curtain', role: 'alert' }, h('h2', null, 'Не удалось открыть 3D-поле'), h('p', null, 'Для игры нужен браузер с WebGL 2.'), h('button', { className: 'primary-button', onClick: onRetryRenderer }, 'Повторить запуск'))),
        h('p', { id: 'keyboard-cell', className: 'sr-only' }, keyboardCell ? `Клетка: строка ${keyboardCell.row}, столбец ${keyboardCell.col}` : 'Стрелки выбирают клетку.'),
        h('div', { className: 'board-bottom' }, h('span', { className: 'live-dot' }), h('span', null, 'Каждый элемент — отдельное движение'),
          h('button', { className: 'text-button', onClick: onReset }, '↻ Начать заново'))),
      h('aside', { className: 'control-panel', 'aria-label': 'Магниты и цель' },
        h('div', { className: 'objective' }, h('span', { className: 'eyebrow' }, 'ТВОЯ ЦЕЛЬ'), h('h2', null, 'Освободи поле'),
          h('div', { className: 'progress-numbers' }, h('strong', null, state.cleared), h('span', null, `/ ${state.initialUnits} элементов`)),
          h('div', { className: 'progress-track', role: 'progressbar', 'aria-label': 'Очищено элементов', 'aria-valuenow': state.cleared, 'aria-valuemin': 0, 'aria-valuemax': state.initialUnits },
            h('div', { style: { width: `${progress}%` } })),
          h('div', { className: 'stats-line' }, h('span', null, 'Ходов осталось'), h('b', null, state.remainingMoves))),
        h('div', { className: 'magnet-section' }, h('div', { className: 'section-title' }, h('span', { className: 'eyebrow' }, 'ВЫБЕРИ МАГНИТ'), h('span', null, '01')),
          h('div', { className: 'magnet-tray' }, state.magnets.map(color => h('button', { key: color, type: 'button',
            className: `magnet-tool ${selected === color ? 'is-selected' : ''}`, style: { '--magnet-color': COLORS[color].hex },
            disabled: locked, 'aria-label': `${COLORS[color].label} магнит`, 'aria-pressed': selected === color,
            onClick: () => onSelect(color), onPointerDown: event => onToolDown(event, color) },
            h(MagnetIcon, { color: COLORS[color].hex }), h('span', null, COLORS[color].symbol)))),
          h('p', { className: 'instruction' }, 'Нажми на магнит, затем на пустую клетку. Или перетащи его на поле.')),
        h('div', { className: 'rule-card' }, h('span', { className: 'rule-icon' }, '↗'), h('div', null,
          h('h3', null, 'Сила в одном касании'), h('p', null, level.lesson))),
        h('p', { className: 'game-status', role: 'status', 'aria-live': 'polite' }, paused ? 'Игра на паузе.' : phase === 'resolving' ? 'Элементы перелетают по одному…' : notice),
        state.terminal && phase !== 'resolving' && h('div', { className: 'result-card', role: 'region', 'aria-label': 'Результат' },
          h('span', { className: 'eyebrow' }, state.terminal === 'won' ? 'КРАСИВАЯ ЦЕПОЧКА' : 'ПОПРОБУЙ ДРУГОЙ ПУТЬ'),
          h('h2', null, state.terminal === 'won' ? 'Поле свободно!' : 'Ходы закончились'),
          h('p', null, state.terminal === 'won' ? 'Маленький магнит справился.' : `На поле ещё ${remainingUnits(state)} элементов.`),
          h('button', { className: 'primary-button', onClick: state.terminal === 'won' ? onNext : onReset },
            state.terminal === 'won' ? levelIndex + 1 === totalLevels ? 'Играть сначала' : 'Следующее поле →' : 'Попробовать ещё раз')),
        h('div', { className: 'options' }, h('button', { className: 'text-button', disabled: locked, onClick: onHint }, '✧ Подсказка'),
          h('label', null, h('input', { type: 'checkbox', checked: reduced, onChange: onReduced }), 'Меньше движения')))));
}
