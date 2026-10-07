import { h } from 'preact';
import { challengeCardDataUrl, createChallengeCardSvg, isShareablePuzzle } from '../social/challenge.js';
import { artUrl, boardThumbnailSvg } from '../render/art.js';
import { Icon } from './icons.js';

export function ResultCard({ result, chainLinks = 0, onRetry, onNextPuzzle, onHome, level, challengeTarget, challengeComparison, shareStatus, boosterNotice, extraMoveMode, boosters, onUndo, onExtraMove, onShareChallenge, isChallenge = false, isDaily = false, dailyId, nextLabel = 'Следующий уровень', allowNextOnLoss = true }) {
  if (!result) return null;
  const won = result.outcome === 'win';
  const shareable = Boolean(level && isShareablePuzzle(level.puzzleId));
  const cardSvg = shareable ? createChallengeCardSvg(level, result) : null;
  const challengeComparable = result.eligibleForChallenge && challengeTarget?.eligibleForChallenge;
  const challengeText = !challengeComparable ? 'Сравнение доступно только для забегов без помощи.'
    : challengeComparison > 0 ? 'Ты побил результат соперника.'
      : challengeComparison === 0 ? 'Ничья по результату.'
        : challengeComparison === null ? 'Результаты нельзя сравнить по правилам этой версии.' : 'Результат соперника выше.';
  return h('section', { className: 'result-card result-card-' + (won ? 'win' : 'loss'), 'aria-label': 'Результат уровня', role: 'status', 'aria-live': 'polite' },
    h('div', { className: 'result-celebration', 'aria-hidden': 'true' },
      h('div', { className: 'result-stars' }, [1, 2, 3].map((star) => h(Icon, { key: star, name: 'star', filled: won || result.clearPercent >= star * 100 / 3 }))),
      h('i', { className: 'confetti confetti-one' }), h('i', { className: 'confetti confetti-two' }), h('i', { className: 'confetti confetti-three' })),
    h('h2', { className: 'result-ribbon' }, won ? 'Уровень пройден!' : 'Цель не достигнута'),
    isDaily && h('p', { className: 'daily-run-label' }, 'Поле дня · ' + dailyId + ' UTC'),
    h('p', { className: 'score-caption' }, 'Твой результат'),
    h('p', { className: 'result-score' }, h('strong', null, result.score.toLocaleString('ru-RU')), h('span', null, ' очков')),
    h('dl', { className: 'result-metrics' },
      metric('Ходы', String(result.movesUsed), 'undo'),
      metric('Время', formatDuration(result.activeTimeMs), 'time')),
    h('div', { className: 'result-details' }, h('span', null, 'Очистка ' + result.clearPercent + '%'), h('span', null, 'Цепочки ' + chainLinks)),
    level && h('div', { className: 'result-board' }, h('img', { className: 'challenge-card-preview', src: artUrl(boardThumbnailSvg(level)), alt: 'Поле уровня Magnet Sort' })),
    shareable && h('section', { className: 'challenge-result', 'aria-label': 'Результат вызова' },
      h('button', { className: 'challenge-primary green-button', type: 'button', onClick: onShareChallenge, 'aria-label': 'Поделиться вызовом' },
        h(Icon, { name: 'users' }), h('span', null, h('strong', null, 'ПОБЕЙ МОЙ РЕКОРД'), h('small', null, 'Брось вызов друзьям!'))),
      h('div', { className: 'share-tools' },
        h('button', { type: 'button', onClick: () => onShareChallenge?.({ copyOnly: true }), 'aria-label': 'Скопировать ссылку' }, h(Icon, { name: 'link' }), h('span', null, 'Ссылка')),
        h('a', { className: 'challenge-download', href: challengeCardDataUrl(cardSvg), download: 'magnet-sort-result.svg' }, h(Icon, { name: 'star', filled: true }), h('span', null, 'Скачать карточку')),
        h('button', { type: 'button', onClick: onShareChallenge, 'aria-label': 'Другие способы поделиться' }, h(Icon, { name: 'share' }), h('span', null, 'Поделиться'))),
      shareStatus && h('p', { className: 'challenge-share-status', role: 'status' }, shareStatus)),
    h('div', { className: 'result-actions' },
      won ? h('button', { type: 'button', className: 'result-primary', onClick: isChallenge ? onShareChallenge : onNextPuzzle }, isChallenge ? 'Ответить вызовом' : nextLabel)
        : h('button', { type: 'button', className: 'result-primary', onClick: onRetry }, 'Попробовать ещё раз'),
      won && h('button', { type: 'button', className: 'result-secondary', onClick: onRetry }, 'Повторить уровень'),
      boosters?.undoAvailable && h('button', { type: 'button', className: 'result-secondary', onClick: onUndo }, 'Отменить последний ход'),
      boosters?.extraMoveAvailable && h('button', { type: 'button', className: 'result-secondary', onClick: onExtraMove }, extraMoveMode === 'test' ? 'Ещё ход · тестовая награда' : extraMoveMode === 'advertisement' ? 'Ещё ход · реклама' : 'Ещё ход'),
      !won && allowNextOnLoss && h('button', { type: 'button', className: 'result-secondary', onClick: onNextPuzzle }, 'Следующий уровень'),
      h('button', { type: 'button', className: 'result-secondary', onClick: onHome }, 'Домой')),
    h('p', { className: 'result-eligibility' }, result.eligibleForChallenge ? 'Забег без помощи' : 'Забег с помощью · вне испытания'),
    boosterNotice && h('p', { className: 'booster-notice', role: 'status' }, boosterNotice),
    challengeTarget && h('p', { className: 'challenge-result-comparison' }, challengeText),
    challengeTarget && h('p', { className: 'challenge-unverified' }, 'Счёт соперника хранится в ссылке и не проверен сервером.'));
}

function metric(label, value, icon) {
  return h('div', null, h(Icon, { name: icon }), h('div', null, h('dt', null, label), h('dd', null, value)));
}

export function formatDuration(milliseconds) {
  const safe = Math.max(0, Number.isFinite(milliseconds) ? Math.floor(milliseconds) : 0);
  const seconds = Math.floor(safe / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes + ':' + String(seconds % 60).padStart(2, '0') + '.' + Math.floor((safe % 1000) / 100);
}
