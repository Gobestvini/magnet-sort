import { h } from 'preact';

export function App({ paused, ready, initializing, error, status, interaction, surfaceRef, canvasRef, onTogglePause, onReset, onRetry }) {
  return h('main', { className: 'app-shell' },
    h('header', { className: 'app-header' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Короткая головоломка'),
        h('h1', null, 'Magnet Sort'),
        h('p', { className: 'subtitle' }, 'Поставь магнит и наблюдай, как собираются фишки.')),
      h('span', { className: 'brand-mark', 'aria-hidden': 'true' }, '✦')),
    h('section', { className: 'game-layout', 'aria-label': 'Игровая оболочка' },
      h('div', { id: 'game-surface', ref: surfaceRef, className: 'game-surface', 'aria-label': 'Игровое поле' },
        h('canvas', { id: 'game-canvas', ref: canvasRef, 'aria-label': 'Игровое поле Magnet Sort', role: 'img' }),
        !ready && h('div', { className: 'surface-message', role: error ? 'alert' : 'status' },
          error
            ? h('div', { className: 'error-content' },
              h('strong', null, 'Не удалось открыть игровое поле.'),
              h('span', null, 'Проверьте поддержку WebGL и попробуйте ещё раз.'),
              h('button', { type: 'button', onClick: onRetry, disabled: initializing }, initializing ? 'Запуск…' : 'Повторить запуск'))
            : h('span', null, initializing ? 'Загрузка игрового поля…' : 'Подготовка…'))),
      h('aside', { className: 'game-controls', 'aria-label': 'Управление игрой' },
        h('p', { className: 'control-label' }, 'Сессия'),
        h('p', { id: 'status', role: 'status', 'aria-live': 'polite' }, status),
        h('div', { className: 'controls' },
          h('button', {
            id: 'pause', type: 'button', onClick: onTogglePause,
            disabled: !ready, 'aria-pressed': paused,
          }, paused ? 'Продолжить' : 'Пауза'),
          h('button', { id: 'reset', type: 'button', onClick: onReset, disabled: !ready }, 'Сброс')),
        interaction?.action
          ? h('p', { id: 'action-preview', className: 'action-preview', role: 'status', 'aria-live': 'polite' },
            `Предпросмотр команды · ${interaction.action.type}(${interaction.action.color}, r${interaction.action.cell.row}c${interaction.action.cell.col}) — без симуляции`)
          : h('p', { className: 'helper-text' }, interaction?.selectedColor
            ? 'Магнит выбран. Перетащи его на свободную клетку или коснись клетки.'
            : 'Перетащи магнит на свободную клетку или коснись магнита, затем клетки.'))),
    h('footer', { className: 'app-footer' }, 'Играй в своём темпе'));
}
