# TASK-0065 — музыка, эффекты и настройки

2026-10-19. Активная игра v4 / Three.js, Node 24.19.0, pnpm 11.25.0,
Chromium / Playwright. Работа выполнена в отдельном checkout; чужие изменения
board/glow/draw-order не включены. Исходный код исследован на `2c77551`, затем
подхвачен `c991333` с документацией другой задачи; runtime в нём не менялся.

## Результат

Оригинальная **Little Orbits**: D major, 96 BPM, 32 такта / 80 секунд,
384 ноты, A/A′/B/A-return. Пять мягких инструментов синтезируются Web Audio.
Все 11 семейств SFX сочинены теми же средствами: UI, выбор, установка, отказ,
перелёт, десятка, прибытие в HUD, spawn, очередь, победа и поражение.
Сторонних записей, сервисов, зависимостей и аудиофайлов в production нет.

В паузе независимые Music/Sounds On/Off и две громкости 0–100%.
Defaults 35/70%, отдельное хранилище `magnet-sort.audio.v1`, проверка типов,
fallback при запрете storage. Volume=0 сохраняет enabled; Off сохраняет volume.
Адаптивная панель имеет клавиатурный focus trap и кнопки от 44 CSS px;
на landscape 844×390 настройки и основные действия помещаются целиком.

Runtime владеет одним AudioContext, двумя каналами и одним музыкальным timer.
Unlock только из доверенного pointer/click/keyboard; первый ввод iframe
учитывает порядок focus. 16 голосов суммарно, до 8 SFX. Cue boundaries взяты
из presentation timeline, старые cues отбрасываются, повторный draw их не играет.
Результат озвучивается после timeline один раз за run; фон приглушается.
Pause сохраняет позицию партитуры, пользовательские clicks работают на паузе;
platform/hidden/blur блокируют весь звук. Reset/Next сохраняют одну музыку и
предпочтения. Dispose закрывает контекст, voices, graph и timer.

## Проверки

| Проверка | Фактический результат |
| --- | --- |
| `node --test tests/prototype-audio.test.js tests/audio-settings.test.js` | 10/10: lazy unlock, отказ resume/constructor, late async/dispose, independent settings, invalid data/storage throws, idempotent cues, pause/reduced, voice caps и одинаковые model events на всех 12 уровнях |
| `pnpm check:full` | 224/224 и production build; legacy audio tests зелёные |
| `node tools/audio-browser-check.cjs` (dev 5175) | 320×720, 390×844, 844×390, 1280×800; normal/reduced, реальный audio graph, pointer/touch/keyboard, отсутствие autoplay bypass, настройки/reload, четыре On/Off сочетания, volume=0, drag/reject/cancel, победа и поражение, 20 reset/pause циклов, dispose |
| Финальная dev-проверка после обработки iframe focus | Desktop сценарий повторно прошёл; затем `tools/selection-browser-check.cjs` подтвердил tap/touch, отсутствие ghost drag, reselection, keyboard и reset/pause |
| Production audio, `GAME_BASE_URL=http://127.0.0.1:5176/magnet-sort/` | Те же четыре viewport, реальный сигнал/UI без gameDebug, победа seed0 за 7 ходов, поражение seed3 за 12, fallback без AudioContext/storage |
| `node tools/pages-browser-check.cjs` на том же production URL | Desktop/mobile seeded victory, retry и pause — success |
| `pnpm build:platforms`, `pnpm test:platforms` | Web/embed/telegram сборки; production SDK isolation/cache/hash/ready, звук iframe после жеста и полная тишина при mock platform deactivation — success |
| `pnpm check` после включения актуальной документации main | Квитанция совпала: код и обязательные входы не изменились |

OfflineAudioContext, 22050 Hz: music peak .11022 / RMS .01464,
SFX peak .24093 / RMS .03989; выключенные каналы — точный ноль.
Плотный mix на 100%/100%: peak .37637, все samples конечны, clipping отсутствует
в проверенном сценарии. Два полных цикла: шаг waveform на шве около .00000293.
Эти измерения не выражают акустические dB или субъективную громкость устройства.

Пользователь **одобрил звучание** музыки и эффектов 2026-10-19 после передачи
`little-orbits-two-loops.wav` и `effects-reel.wav`. Это отдельная художественная
приёмка; её не заменяют fake-context tests или screenshots.

## Публикация

Локальные критерии выполнены. На момент подготовки первого коммита статус review:
ожидаются push в remote main, успешный deploy-pages.yml, совпадение опубликованного
build-info и production smoke/audio по HTTPS. Финальный SHA и результаты будут
записаны после фактической публикации.

## Ограничения и артефакты

Проверки desktop/mobile — browser surrogate. Физический телефон и native Telegram
не проверялись, реальный Telegram не запускался. Headless не гарантирует blur
при открытии другой вкладки: blur/visibility проверены через явные события на
браузерной границе; SDK — mock bridge. Это не проверка реального OS background.
Субъективная приёмка подтверждает присланное звучание, не характеристики динамиков
всех устройств. Существующее предупреждение Vite о размере Three.js chunk не
блокирует сборку; отдельные performance benchmarks телефона не проводились.

Логи `audio-*.log`, `.telegram-check-logs/`; WAV, screenshots, JSON метрик —
`artifacts/audio/`, `artifacts/audio/dev-final/`, `artifacts/audio/production/`;
регрессия выбора — `artifacts/selection-browser/`. Перед удалением временного
checkout эти файлы сохраняются в artifacts основной папки.
