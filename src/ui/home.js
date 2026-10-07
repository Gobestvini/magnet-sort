import { h } from 'preact';
import { artUrl, chipSvg, magnetSvg } from '../render/art.js';
import { Icon } from './icons.js';

export function Home({ progress, daily, ready, error, initializing, onPlay, onRetryRenderer, onDaily, onFriend, onToggleReducedMotion, onToggleSound, onToggleHaptics }) {
  const hasProgress = progress.completedPuzzles.length > 0;
  const dailyBest = daily ? progress.dailyResults[daily.dailyId] : null;
  return h('section', { className: 'home-card', 'aria-label': 'Главное меню' },
    h('div', { className: 'home-art', 'aria-hidden': 'true' },
      h('img', { className: 'home-chip home-chip-red', src: artUrl(chipSvg('red', 3, false)), alt: '' }),
      h('img', { className: 'home-chip home-chip-yellow', src: artUrl(chipSvg('yellow', 2, false)), alt: '' }),
      h('img', { className: 'home-chip home-chip-green', src: artUrl(chipSvg('green', 2, false)), alt: '' }),
      h('img', { className: 'home-magnet', src: artUrl(magnetSvg('blue')), alt: '' })),
    h('h2', null, 'Magnet Sort'),
    h('p', { className: 'home-intro' }, 'Поставь магнит, собери фишки и открой новые уровни.'),
    h('p', { className: 'home-progress', 'aria-live': 'polite' }, `Открыт уровень ${progress.unlockedCampaignLevel} из 50${hasProgress ? ` · пройдено: ${progress.completedPuzzles.length}` : ''}`),
    h('button', { className: 'home-primary green-button', type: 'button', onClick: onPlay, disabled: !ready },
      h(Icon, { name: 'play' }),
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
    h('label', { className: 'home-setting' },
      h('input', { type: 'checkbox', checked: progress.settings.soundEnabled, onChange: onToggleSound }),
      'Звук'),
    h('label', { className: 'home-setting' },
      h('input', { type: 'checkbox', checked: progress.settings.hapticsEnabled, onChange: onToggleHaptics }),
      'Вибрация, если доступна'),
    h('p', { className: 'home-footer' }, 'Прогресс хранится на этом устройстве.'));
}
