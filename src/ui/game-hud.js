import { h } from 'preact';
import { artUrl, magnetSvg } from '../render/art.js';
import { Icon } from './icons.js';

const COLOR_NAMES = { red: 'Красный', blue: 'Синий', yellow: 'Жёлтый', green: 'Зелёный' };

export function GameHud({ session, interaction, ready, boosterNotice, extraMoveMode, feedbackSettings, onToggleSound, onToggleHaptics, onChooseColor, onStartMagnetDrag, onUndo, onHint, onApplyHint, onExtraMove }) {
  if (!session) return null;
  const boosters = session.boosters;
  const disabled = !ready || session.phase !== 'playing';
  return h('section', { className: 'game-hud', 'aria-label': 'Состояние уровня' },
    h('div', { className: 'tool-tray' },
      h('div', { className: 'magnet-options', role: 'group', 'aria-label': 'Доступные магниты' },
        session.availableColors.map((color) => h('button', {
          key: color, type: 'button',
          className: 'magnet-choice magnet-choice-' + color + (session.tutorial?.hint?.active && session.tutorial.hint.color === color ? ' tutorial-focus' : ''),
          'aria-pressed': interaction?.selectedColor === color, 'aria-label': COLOR_NAMES[color] + ' магнит',
          disabled, onClick: () => onChooseColor?.(color), onPointerDown: event => onStartMagnetDrag?.(event, color),
        }, h('img', { src: artUrl(magnetSvg(color)), alt: '', draggable: false }), h('span', { className: 'tool-label' }, COLOR_NAMES[color])))),
      h('div', { className: 'booster-actions', 'aria-label': 'Помощь в забеге' },
        h('button', { type: 'button', onClick: onUndo, disabled: !ready || !boosters.undoAvailable, 'aria-label': 'Отменить ход' }, h(Icon, { name: 'undo' }), h('span', { className: 'tool-label' }, 'Отмена')),
        h('button', { type: 'button', onClick: onHint, disabled: !ready || !boosters.hintAvailable, 'aria-label': boosters.hintAvailable ? 'Подсказка' : 'Подсказка использована' }, h(Icon, { name: 'hint' }), h('span', { className: 'tool-label' }, 'Подсказка'), h('span', { className: 'tool-count' }, boosters.hintAvailable ? '1' : '0')),
        boosters.extraMoveAvailable && h('button', { type: 'button', onClick: onExtraMove, disabled: !ready, 'aria-label': extraMoveMode === 'test' ? 'Ещё ход · тест' : extraMoveMode === 'advertisement' ? 'Ещё ход · реклама' : 'Ещё ход' }, h(Icon, { name: 'move' }), h('span', { className: 'tool-label' }, 'Ещё ход'), h('span', { className: 'tool-count' }, '1')))),
    h('div', { className: 'feedback-settings', 'aria-label': 'Настройки обратной связи' },
      h('label', null, h('input', { type: 'checkbox', checked: Boolean(feedbackSettings?.soundEnabled), onChange: onToggleSound }), 'Звук'),
      h('label', null, h('input', { type: 'checkbox', checked: Boolean(feedbackSettings?.hapticsEnabled), onChange: onToggleHaptics }), 'Вибрация')),
    session.hintAction && h('div', { className: 'booster-hint', role: 'status', 'aria-live': 'polite' },
      h('p', null, 'Попробуй ' + COLOR_NAMES[session.hintAction.color] + ' магнит: столбец ' + (session.hintAction.cell.col + 1) + ', ряд ' + (session.hintAction.cell.row + 1) + '.'),
      h('button', { type: 'button', onClick: onApplyHint, disabled }, 'Применить этот ход')),
    boosterNotice && h('p', { className: 'booster-notice', role: 'status', 'aria-live': 'polite' }, boosterNotice),
    session.phase === 'resolving' && h('p', { className: 'sr-only', role: 'status', 'aria-live': 'polite' }, 'Магнит притягивает фишки…'));
}
