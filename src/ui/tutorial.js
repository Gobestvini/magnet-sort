import { h } from 'preact';

const INVALID_HINTS = {
  outside: 'Поставь магнит на клетку внутри поля.',
  occupied: 'Эта клетка занята фишкой. Выбери свободную.',
  blocked: 'Серая клетка закрыта. Попробуй свободную рядом.',
  unavailableColor: 'Сейчас можно выбрать только показанный цвет.',
};

export function TutorialPanel({ tutorial, interaction, onSkip, disabled = false }) {
  if (!tutorial?.active) return null;
  const error = INVALID_HINTS[interaction?.invalidReason];
  return h('section', { className: 'tutorial-panel', 'aria-label': 'Обучение' },
    h('p', { className: 'tutorial-count' }, `Урок ${tutorial.lessonIndex} из ${tutorial.lessonCount}`),
    h('h2', null, tutorial.title),
    h('p', { className: error ? 'tutorial-instruction tutorial-error' : 'tutorial-instruction', role: error ? 'status' : undefined, 'aria-live': error ? 'polite' : undefined }, error ?? tutorial.instruction),
    tutorial.hint?.active && h('div', { className: 'tutorial-sequence', 'data-hint-active': 'true', 'aria-label': 'Выбери, поставь, притяни' },
      h('span', { className: 'tutorial-step tutorial-step-choose' }, '1 · Выбери'),
      h('span', { className: 'tutorial-step tutorial-step-place' }, '2 · Поставь'),
      h('span', { className: 'tutorial-step tutorial-step-pull' }, '3 · Притяни')),
    h('button', { type: 'button', className: 'tutorial-skip', onClick: onSkip, disabled: !onSkip || disabled }, 'Пропустить обучение'));
}
