# Прежний объёмный фон и блик по сетке — 2026-10-11

Восстановлен исходный фиолетово-синий embossed hex фон из `c6c96d5`, вместо плоской SVG-сетки. Его локальный источник сохранён в `docs/design/resource-quality/background-source.png`. Команда `tools/build-background-grid.cjs` воспроизводит фон и маску по реальным контурам исходной картинки; `rebuild-ui-art.cjs` больше не заменяет его плоским вариантом.

Декоративный CSS-блик проходит диагонально по рёбрам сот с паузой между проходами (цикл 11 секунд). Маска и body background используют одинаковые center/cover, поэтому выравниваются при portrait/landscape/resize. Свет расположен под UI и WebGL canvas, не ловит pointer events и скрыт от accessibility tree. Нет второго JS RAF или таймера симуляции.

IdleBackdrop активен только в playing, без паузы, загрузки, ошибки и Reduced motion. Во время resolution эффект затихает; при hidden анимация приостанавливается. Компонент освобождает свой visibilitychange listener при unmount. Системный prefers-reduced-motion также отключает эффект независимо от настройки игры.

Проверено в desktop Chromium:

- `tools/background-browser-check.cjs`: idle/shine кадры, выравнивание и размеры 390×844, 540×960, 950×540; pause/reduced/system reduced/hidden/resolving/reset/dispose. Скриншоты `artifacts/background-browser`.
- `tools/raster-browser-check.cjs`: async loading, failure/retry и responsive.
- Общий `pnpm test:browser` прошёл на актуальном коде после завершения параллельной правки pause menu. Две предыдущие попытки попали на изменение runtime/теста и не считаются итогом.
- `node --test tests/prototype-v3.test.js`: 7/7 прошли.
- `pnpm check:full` выполнен, но не прошёл: у установленной Pixi-зависимости отсутствует целевой каталог `@pixi/colord`. `pnpm install --frozen-lockfile` и повтор с `--force` не восстановили его. Отдельный production build также заблокирован окружением: отсутствуют bin-wrapper Vite и пакет `@rollup/rollup-win32-x64-msvc`. Прямой вызов Vite подтвердил вторую ошибку. Логи `.telegram-check-logs/` и `artifacts/idle-prototype-tests.log`. Успех полной сборки не заявляется.

Эмуляция viewport не является проверкой физического телефона или его FPS. Геометрия и правила игры не менялись.
