import { h } from 'preact';
import { challengeCardDataUrl, createChallengeCardSvg, isShareablePuzzle } from '../social/challenge.js';

export function ResultCard({ result, chainLinks = 0, onRetry, onNextPuzzle, onHome, level, challengeTarget, challengeComparison, shareStatus, onShareChallenge, isChallenge = false, nextLabel = 'Следующий уровень', allowNextOnLoss = true }) {
  if (!result) return null;
  const won = result.outcome === 'win';
  const duration = formatDuration(result.activeTimeMs);
  const shareable = Boolean(level && isShareablePuzzle(level.puzzleId));
  const cardSvg = shareable ? createChallengeCardSvg(level, result) : null;
  const challengeText = challengeComparison > 0 ? 'Ты побил результат соперника.'
    : challengeComparison === 0 ? 'Ничья по результату.' : 'Результат соперника выше.';
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
      ? h('button', { type: 'button', className: 'result-primary', onClick: isChallenge ? onShareChallenge : onNextPuzzle }, isChallenge ? 'Ответить вызовом' : nextLabel)
      : h('button', { type: 'button', className: 'result-primary', onClick: onRetry }, 'Попробовать ещё раз'),
    won && h('button', { type: 'button', className: 'result-secondary', onClick: onRetry }, 'Повторить уровень'),
    !won && allowNextOnLoss
      ? h('button', { type: 'button', className: 'result-secondary', onClick: onNextPuzzle }, 'Следующий уровень')
      : null,
    h('button', { type: 'button', className: 'result-secondary', onClick: onHome }, 'Домой')),
  shareable && h('section', { className: 'challenge-result', 'aria-label': 'Результат вызова' },
    challengeTarget && h('p', { className: 'challenge-result-comparison', role: 'status', 'aria-live': 'polite' }, challengeText),
    challengeTarget && h('p', { className: 'challenge-unverified' }, 'Счёт соперника хранится в ссылке и не проверен сервером.'),
    h('img', { className: 'challenge-card-preview', src: challengeCardDataUrl(cardSvg), alt: `Карточка Magnet Sort: ${result.score} очков, ${result.movesUsed} ходов` }),
    h('button', { type: 'button', onClick: onShareChallenge }, 'Поделиться вызовом'),
    h('a', { className: 'challenge-download', href: challengeCardDataUrl(cardSvg), download: 'magnet-sort-result.svg' }, 'Скачать карточку'),
    h('p', { className: 'challenge-share-status', role: 'status', 'aria-live': 'polite' }, shareStatus ?? '')));
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
