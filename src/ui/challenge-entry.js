import { h } from 'preact';

export function ChallengeEntry({ challenge, onPlay }) {
  const target = challenge.challengerResult;
  const assisted = !target.eligibleForChallenge;
  return h('section', { className: 'challenge-entry', 'aria-label': 'Вызов с другом' },
    h('p', { className: 'eyebrow' }, 'Вызов с другом'),
    h('h2', null, 'Побей этот результат'),
    h('p', { className: 'challenge-target-score' }, `${target.score.toLocaleString('ru-RU')} очков`),
    h('p', { className: 'challenge-target-facts' }, `Ходы: ${target.movesUsed} · Очистка: ${target.clearPercent}%`),
    assisted && h('p', { className: 'challenge-unverified' }, 'В забеге использовалась помощь. Результат показан для сравнения, но не считается честным вызовом.'),
    h('p', { className: 'challenge-unverified' }, 'Результат соперника не проверен сервером.'),
    h('button', { type: 'button', className: 'home-primary', onClick: onPlay }, 'Играть'));
}
