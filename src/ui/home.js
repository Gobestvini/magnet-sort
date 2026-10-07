import { h } from 'preact';

export function Home({ progress, ready, error, initializing, onPlay, onRetryRenderer, onDaily, onFriend, onToggleReducedMotion }) {
  const hasProgress = progress.completedPuzzles.length > 0;
  return h('section', { className: 'home-card', 'aria-label': 'Главное меню' },
    h('p', { className: 'eyebrow' }, 'Короткая головоломка'),
    h('h2', null, 'Magnet Sort'),
    h('p', { className: 'home-intro' }, 'Поставь магнит, собери фишки и открой новые уровни.'),
    h('p', { className: 'home-progress', 'aria-live': 'polite' }, `Открыт уровень ${progress.unlockedCampaignLevel} из 50${hasProgress ? ` · пройдено: ${progress.completedPuzzles.length}` : ''}`),
    h('button', { className: 'home-primary', type: 'button', onClick: onPlay, disabled: !ready },
      ready ? hasProgress ? 'Продолжить' : 'Играть' : 'Подготовка…'),
    error && h('div', { className: 'home-error', role: 'alert' },
      h('span', null, 'Не удалось открыть игровое поле. Проверьте поддержку WebGL.'),
      h('button', { type: 'button', onClick: onRetryRenderer, disabled: initializing }, initializing ? 'Запуск…' : 'Повторить запуск')),
    h('div', { className: 'home-secondary-actions' },
      h('button', { type: 'button', onClick: onDaily, disabled: true, 'aria-label': 'Ежедневное поле скоро появится' },
        'Ежедневное поле · скоро'),
      h('button', { type: 'button', onClick: onFriend, disabled: true, 'aria-label': 'Испытание с другом скоро появится' },
        'Друг · скоро')),
    h('label', { className: 'home-setting' },
      h('input', { type: 'checkbox', checked: progress.settings.reducedMotion, onChange: onToggleReducedMotion }),
      'Уменьшить движение'),
    h('p', { className: 'home-footer' }, 'Прогресс хранится на этом устройстве.'));
}
