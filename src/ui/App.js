import { h } from 'preact';
import { GameHud } from './game-hud.js';
import { ResultCard } from './result.js';
import { TutorialPanel } from './tutorial.js';
import { Home } from './home.js';
import { ChallengeEntry } from './challenge-entry.js';
import { Icon } from './icons.js';

export function App({ screen = 'game', progress, daily, challenge, challengeComparison, challengeError, shareStatus, boosterNotice, extraMoveMode, level, paused, ready, initializing, error, status, session, interaction, surfaceRef, canvasRef, onTogglePause, onReset, onRetry, onRetryRenderer, onNextPuzzle, onChooseColor, onStartMagnetDrag, onUndo, onHint, onApplyHint, onExtraMove, onSkipTutorial, onPlay, onHome, onDaily, onFriend, onToggleReducedMotion, onToggleSound, onToggleHaptics, onShareChallenge }) {
  const result = session?.result;
  const tutorial = session?.tutorial?.active;
  const totalMass = level?.tokens?.reduce((sum, token) => sum + token.mass, 0) ?? 1;
  const target = session?.goal?.kind === 'clearAll' ? totalMass : session?.goal?.mass ?? totalMass;
  const completion = Math.min(1, (session?.state?.clearedMass ?? 0) / Math.max(1, target));
  return h('main', { className: 'app-shell app-shell-' + screen + (result && screen === 'game' ? ' app-shell-result' : '') + (tutorial ? ' app-shell-tutorial' : '') },
    screen === 'home' && h(Home, { progress, daily, ready, error, initializing, onPlay, onRetryRenderer, onDaily, onFriend, onToggleReducedMotion, onToggleSound, onToggleHaptics }),
    screen === 'home' && challengeError && h('p', { className: 'challenge-link-error', role: 'status' }, challengeError),
    screen === 'challenge' && h(ChallengeEntry, { challenge, onPlay }),
    h('section', { className: 'game-layout', 'aria-label': 'Игровая оболочка', style: screen !== 'game' ? { display: 'none' } : undefined },
      !result && h('header', { className: 'game-topbar' },
        h('button', { id: 'pause', className: 'square-button', type: 'button', onClick: onTogglePause, disabled: !ready, 'aria-pressed': paused, 'aria-label': paused ? 'Продолжить' : 'Пауза' }, h(Icon, { name: paused ? 'play' : 'pause' })),
        h('div', { className: 'level-heading' },
          h('h1', null, session?.daily ? 'Поле дня' : tutorial ? 'Урок ' + session.tutorial.lessonIndex : 'Уровень ' + (session?.campaignNumber ?? level?.displayNumber ?? 1)),
          h('div', { className: 'goal-progress', role: 'progressbar', 'aria-label': 'Прогресс цели', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(completion * 100) },
            h('span', { className: 'goal-progress-fill', style: { width: completion * 100 + '%' } }),
            [1, 2, 3].map((star) => h(Icon, { key: star, name: 'star', filled: completion >= star / 3, className: 'goal-star goal-star-' + star })))),
        h('div', { className: 'moves-card' }, h('span', null, 'Ходы'), h('strong', null, session?.remainingMoves ?? '∞'))),
      !result && h(TutorialPanel, { tutorial: session?.tutorial, interaction, onSkip: onSkipTutorial, disabled: session?.phase !== 'playing' }),
      h('div', { id: 'game-surface', ref: surfaceRef, className: 'game-surface', 'aria-label': 'Игровое поле', 'aria-hidden': result ? 'true' : undefined },
        h('canvas', { id: 'game-canvas', ref: canvasRef, 'aria-label': 'Игровое поле Magnet Sort', role: 'img' }),
        !ready && h('div', { className: 'surface-message', role: error ? 'alert' : 'status' },
          error ? h('div', { className: 'error-content' },
            h('strong', null, 'Не удалось открыть игровое поле.'),
            h('span', null, 'Проверьте поддержку WebGL и попробуйте ещё раз.'),
            h('button', { type: 'button', onClick: onRetryRenderer, disabled: initializing }, initializing ? 'Запуск…' : 'Повторить запуск'))
            : h('span', null, initializing ? 'Загрузка игрового поля…' : 'Подготовка…')),
        paused && ready && !result && h('div', { className: 'pause-curtain' },
          h(Icon, { name: 'pause' }), h('h2', null, 'Пауза'),
          h('button', { type: 'button', className: 'green-button', onClick: onTogglePause }, 'Вернуться в игру'))),
      h('aside', { className: 'game-controls', 'aria-label': 'Управление игрой' },
        h('p', { id: 'status', className: 'sr-only', role: 'status', 'aria-live': 'polite' }, status),
        !result && h(GameHud, { session, interaction, ready, boosterNotice, extraMoveMode, feedbackSettings: progress.settings, onToggleSound, onToggleHaptics, onChooseColor, onStartMagnetDrag, onUndo, onHint, onApplyHint, onExtraMove }),
        h(ResultCard, {
          result, chainLinks: session?.state?.chainLinks ?? 0, onRetry,
          onNextPuzzle: session?.daily ? onHome : tutorial && session.phase !== 'won' ? null : onNextPuzzle,
          nextLabel: session?.daily ? 'На главную' : session?.tutorial?.nextLabel,
          allowNextOnLoss: !session?.daily && !tutorial && session?.campaignNumber == null,
          onHome, level, challengeTarget: challenge?.challengerResult, challengeComparison, shareStatus, boosterNotice, extraMoveMode, onShareChallenge,
          isChallenge: session?.challenge, isDaily: session?.daily, dailyId: session?.dailyId, boosters: session?.boosters, onUndo, onExtraMove,
        }),
        !result && h('div', { className: 'game-footnote' },
          h('span', { className: 'helper-text' }, interaction?.selectedColor ? 'Поставь магнит на свободную клетку' : 'Перетащи магнит на поле'),
          h('button', { id: 'reset', type: 'button', onClick: onReset, disabled: !ready, 'aria-label': 'Сброс' }, h(Icon, { name: 'retry' }))))));
}
