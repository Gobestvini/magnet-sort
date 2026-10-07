import { h } from 'preact';

export function Home({ progress, daily, ready, error, initializing, onPlay, onRetryRenderer, onDaily, onFriend, onToggleReducedMotion }) {
  const hasProgress = progress.completedPuzzles.length > 0;
  const dailyBest = daily ? progress.dailyResults[daily.dailyId] : null;
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
      h('button', { type: 'button', onClick: onDaily, disabled: !ready, 'aria-label': 'Играть в ежедневное поле' },
        'Ежедневное поле'),
      h('button', { type: 'button', onClick: onFriend, disabled: true, 'aria-label': 'Испытание с другом скоро появится' },
        'Друг · скоро')),
    daily && h('section', { className: 'home-daily', 'aria-label': 'Сегодняшнее поле' },
      h('p', { className: 'eyebrow' }, `Ежедневное поле · ${daily.dailyId} UTC`),
      h('p', null, `Общее поле дня · расписание ${daily.rotationVersion}`),
      h('p', { className: 'home-daily-best', 'aria-live': 'polite' }, dailyBest
        ? `Лучший результат: ${dailyBest.result.score.toLocaleString('ru-RU')} очков · ${dailyBest.result.movesUsed} ходов${dailyBest.assisted ? ' · с помощью' : ''}`
        : 'Сегодня ещё нет результата на этом устройстве.')),
    h('label', { className: 'home-setting' },
      h('input', { type: 'checkbox', checked: progress.settings.reducedMotion, onChange: onToggleReducedMotion }),
      'Уменьшить движение'),
    h('p', { className: 'home-footer' }, 'Прогресс хранится на этом устройстве.'));
}
