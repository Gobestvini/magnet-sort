# TASK-0067: прогноз пополнения

2026-10-19. Реализована компактная строка под COLLECTED/MOVES внутри общего HUD. Правила модели/RNG не менялись.

## Контракт

`src/prototype/spawn-forecast.js::forecast` ищет первый ближайший ход с ненулевым stacksForMove через общие helpers. Возвращает turnsUntilSpawn/plannedCount либо null для terminal. Число — запланированный максимум, фактическая партия ограничена свободными клетками.

Английские строки: «New stacks next move: +2», «New stacks in 3 moves: +1». Tooltip и accessible label поясняют: «Up to this many stacks, if space remains». Будущие клетки/цвета не показываются, RNG не читается.

`displayedForecast` держит before до start первого stackSpawned segment; без spawn использует queueStart. Для terminal держит прежнюю строку до конца timeline и скрывает на результате. Отдельного spawnStart в старой timeline не было; новая геометрия/RAF не добавлены. Runtime перерисовывает строку только при смене значения. DEV-preview может явно передать experiment schedule; обычный entry использует прежний default.

## Проверки

- `node --test tests/spawn-forecast.test.js tests/progressive-spawn.test.js tests/ten-range.test.js`:10/10 PASS. Проверены L1 moves4/5/10, L7 0/1, L10 0/499/1000, все12 уровней около5*N²/10*N², terminal, чистота и normal/reduced timeline boundaries.
- `node tools/spawn-forecast-browser-check.cjs`: PASS production L7 два хода, L10 три, первые стадии resolution без преждевременного обновления, pause/cancel, real tap/keyboard, победа и скрытие строки.
- Production screenshots320×568,390×844,844×390 просмотрены: строка не перекрывает поле/tray, не выходит по горизонтали; на коротком portrait страница прокручивается. Ручной Codex browser осмотр landscape также выполнен.
- `pnpm check:full`:239/239 и build PASS; `pnpm build:platforms` PASS. Общий platform/published smoke фиксируется с итоговым коммитом.
- Default/A golden traces и все старые replays сохранены: прогноз не создаёт accepted actions и не расходует RNG.

Файлы: helper, runtime/App/prototype.css, unit/browser tool. Ассеты, радиусы и мини-карты магнитов не менялись. Скриншоты `artifacts/spawn-forecast/`, логи `artifacts/save-forecast-pace/`. Физический телефон не проверялся; требование телефона в этой задаче условно «при наличии».
