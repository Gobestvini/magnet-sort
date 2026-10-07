import { h } from 'preact';

export function ResultCard({ result, chainLinks = 0, onRetry, onNextPuzzle }) {
  if (!result) return null;
  const won = result.outcome === 'win';
  const duration = formatDuration(result.activeTimeMs);
  return h('section', {
    className: `result-card result-card-${won ? 'win' : 'loss'}`,
    'aria-label': 'Результат уровня',
    role: 'status',
    'aria-live': 'polite',
  },
  h('h2', null, won ? 'Цель достигнута!' : 'Цель не достигнута'),
  h('p', { className: 'result-score' }, `${result.score.toLocaleString('ru-RU')} очков`),
  h('dl', { className: 'result-metrics' },
    metric('Ходы', String(result.movesUsed)),
    metric('Время', duration),
    metric('Очистка', `${result.clearPercent}%`),
    metric('Цепочки', String(chainLinks))),
  h('p', { className: 'result-eligibility' }, result.eligibleForChallenge
    ? 'Забег без помощи · подходит для будущих испытаний'
    : 'Забег с помощью · не участвует в испытании'),
  h('div', { className: 'result-actions' },
    won
      ? h('button', { type: 'button', className: 'result-primary', onClick: onNextPuzzle }, 'Следующий уровень')
      : h('button', { type: 'button', className: 'result-primary', onClick: onRetry }, 'Попробовать ещё раз'),
    won
      ? h('button', { type: 'button', className: 'result-secondary', onClick: onRetry }, 'Повторить уровень')
      : h('button', { type: 'button', className: 'result-secondary', onClick: onNextPuzzle }, 'Следующий уровень')),
  h('p', { className: 'result-challenge-slot', 'aria-label': 'Испытание с другом' }, 'Ссылку на это поле можно будет отправить в будущих испытаниях.'));
}

function metric(label, value) {
  return h('div', null, h('dt', null, label), h('dd', null, value));
}

export function formatDuration(milliseconds) {
  const safe = Math.max(0, Number.isFinite(milliseconds) ? Math.floor(milliseconds) : 0);
  const seconds = Math.floor(safe / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}.${Math.floor((safe % 1000) / 100)}`;
}
