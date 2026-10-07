import { h } from 'preact';
import { GameHud } from './game-hud.js';
import { ResultCard } from './result.js';
import { TutorialPanel } from './tutorial.js';
import { Home } from './home.js';

export function App({ screen = 'game', progress, paused, ready, initializing, error, status, session, interaction, surfaceRef, canvasRef, onTogglePause, onReset, onRetry, onRetryRenderer, onNextPuzzle, onChooseColor, onSkipTutorial, onPlay, onHome, onDaily, onFriend, onToggleReducedMotion }) {
  return h('main', { className: `app-shell${screen === 'game' && session?.result ? ' app-shell-result' : ''}` },
    h('header', { className: 'app-header' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Короткая головоломка'),
        h('h1', null, 'Magnet Sort'),
        h('p', { className: 'subtitle' }, 'Поставь магнит и наблюдай, как собираются фишки.')),
      h('span', { className: 'brand-mark', 'aria-hidden': 'true' }, '✦')),
    screen === 'home' && h(Home, { progress, ready, error, initializing, onPlay, onRetryRenderer, onDaily, onFriend, onToggleReducedMotion }),
    h('section', { className: 'game-layout', 'aria-label': 'Игровая оболочка', style: screen === 'home' ? { display: 'none' } : undefined },
      h('div', { id: 'game-surface', ref: surfaceRef, className: 'game-surface', 'aria-label': 'Игровое поле' },
        h('canvas', { id: 'game-canvas', ref: canvasRef, 'aria-label': 'Игровое поле Magnet Sort', role: 'img' }),
        !ready && h('div', { className: 'surface-message', role: error ? 'alert' : 'status' },
          error
            ? h('div', { className: 'error-content' },
              h('strong', null, 'Не удалось открыть игровое поле.'),
              h('span', null, 'Проверьте поддержку WebGL и попробуйте ещё раз.'),
              h('button', { type: 'button', onClick: onRetryRenderer, disabled: initializing }, initializing ? 'Запуск…' : 'Повторить запуск'))
            : h('span', null, initializing ? 'Загрузка игрового поля…' : 'Подготовка…'))),
      h('aside', { className: 'game-controls', 'aria-label': 'Управление игрой' },
        h('p', { className: 'control-label' }, 'Сессия'),
        h('p', { id: 'status', role: 'status', 'aria-live': 'polite' }, status),
        !session?.result && h(TutorialPanel, { tutorial: session?.tutorial, interaction, onSkip: onSkipTutorial, disabled: session?.phase !== 'playing' }),
        !session?.result && h(GameHud, { session, interaction, ready, onChooseColor }),
        h(ResultCard, {
          result: session?.result,
          chainLinks: session?.state?.chainLinks ?? 0,
          onRetry,
          onNextPuzzle: session?.tutorial?.active && session.phase !== 'won' ? null : onNextPuzzle,
          nextLabel: session?.tutorial?.nextLabel,
          allowNextOnLoss: !session?.tutorial?.active && session?.campaignNumber == null,
          onHome,
        }),
        !session?.result && h('div', { className: 'controls' },
          h('button', {
            id: 'pause', type: 'button', onClick: onTogglePause,
            disabled: !ready, 'aria-pressed': paused,
          }, paused ? 'Продолжить' : 'Пауза'),
          h('button', { id: 'reset', type: 'button', onClick: onReset, disabled: !ready }, 'Сброс')),
        !session?.result && h('p', { className: 'helper-text' }, session?.phase === 'won' || session?.phase === 'lost'
          ? 'Можно повторить этот уровень или перейти к следующему.'
          : interaction?.selectedColor
            ? 'Магнит выбран. Перетащи его на свободную клетку или коснись клетки.'
            : 'Перетащи магнит на свободную клетку или выбери его, затем коснись клетки.'))),
    h('footer', { className: 'app-footer' }, 'Играй в своём темпе'));
}
