import { h } from 'preact';

const COLOR_NAMES = { red: 'Красный', blue: 'Синий', yellow: 'Жёлтый', green: 'Зелёный' };

export function GameHud({ session, interaction, ready, boosterNotice, onChooseColor, onUndo, onHint, onApplyHint, onExtraMove }) {
  if (!session) return null;
  const state = session.state;
  const remainingMass = state?.tokens.reduce((sum, token) => sum + token.mass, 0) ?? 0;
  const goalText = session.goal?.kind === 'clearAll'
    ? `Очистить всё · осталось ${remainingMass}`
    : `Очистить ${session.goal?.mass ?? 0} · собрано ${state?.clearedMass ?? 0}`;
  const movesText = session.remainingMoves === null
    ? `Ход ${session.movesUsed + 1} · без лимита`
    : `Ходы · ${session.remainingMoves} осталось`;
  const boosters = session.boosters;
  return h('section', { className: 'game-hud', 'aria-label': 'Состояние уровня' },
    h('div', { className: 'hud-facts' },
      h('p', null, h('span', null, 'Цель'), h('strong', null, goalText)),
      h('p', null, h('span', null, 'Ход'), h('strong', null, movesText))),
    h('div', { className: 'magnet-options', role: 'group', 'aria-label': 'Доступные магниты' },
      session.availableColors.map((color) => h('button', {
        key: color,
        type: 'button',
        className: `magnet-choice magnet-choice-${color}${session.tutorial?.hint?.active && session.tutorial.hint.color === color ? ' tutorial-focus' : ''}`,
        'aria-pressed': interaction?.selectedColor === color,
        disabled: !ready || session.phase !== 'playing',
        onClick: () => onChooseColor?.(color),
      }, h('span', { className: 'magnet-swatch', 'aria-hidden': 'true' }), `${COLOR_NAMES[color] ?? color} магнит`))),
    h('div', { className: 'booster-actions', 'aria-label': 'Помощь в забеге' },
      boosters.undoAvailable && h('button', { type: 'button', onClick: onUndo, disabled: !ready }, 'Отменить ход'),
      h('button', { type: 'button', onClick: onHint, disabled: !ready || !boosters.hintAvailable }, boosters.hintAvailable ? 'Подсказка' : 'Подсказка использована'),
      boosters.extraMoveAvailable && h('button', { type: 'button', onClick: onExtraMove, disabled: !ready }, 'Ещё ход · тест')),
    session.hintAction && h('div', { className: 'booster-hint', role: 'status', 'aria-live': 'polite' },
      h('p', null, `Попробуй ${COLOR_NAMES[session.hintAction.color] ?? session.hintAction.color} магнит: столбец ${session.hintAction.cell.col + 1}, ряд ${session.hintAction.cell.row + 1}.`),
      h('button', { type: 'button', onClick: onApplyHint, disabled: !ready || session.phase !== 'playing' }, 'Применить этот ход')),
    boosterNotice && h('p', { className: 'booster-notice', role: 'status', 'aria-live': 'polite' }, boosterNotice),
    h('p', { className: 'booster-provider-note' }, 'Дополнительный ход использует тестовую награду без рекламы.'),
    session.phase === 'resolving' && h('p', { className: 'turn-feedback', role: 'status', 'aria-live': 'polite' }, 'Магнит притягивает фишки…'),
    session.events.length > 0 && session.phase !== 'resolving' && h('p', { className: 'turn-feedback', role: 'status', 'aria-live': 'polite' }, summarizeEvents(session)));
}

function summarizeEvents(session) {
  const moved = session.events.filter((event) => event.type === 'tokenMoved').length;
  const merged = session.events.filter((event) => event.type === 'stackMerged');
  const cleared = session.events.filter((event) => event.type === 'stackCleared');
  const parts = [];
  if (moved) parts.push(`Сдвинуто фишек: ${moved}`);
  if (merged.length) parts.push(`Объединено стеков: ${merged.length}`);
  if (cleared.length) parts.push(`Очищено фишек: ${cleared.reduce((sum, event) => sum + event.mass, 0)}`);
  if (session.state?.chainLinks > 0) parts.push(`Цепочки: ${session.state.chainLinks}`);
  if (session.phase === 'won') parts.push('Цель выполнена');
  if (session.phase === 'lost') parts.push('Попытки закончились');
  return parts.length ? parts.join(' · ') : 'Фишки не сдвинулись — попробуй другое свободное поле.';
}
