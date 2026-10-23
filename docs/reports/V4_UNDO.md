# Полная отмена хода v4

2026-10-23, TASK-0068, исходная ревизия a73bc1a. Прямой запрос пользователя
разрешил реализацию после технической проверки session/save TASK-0066;
её отдельный review настоящего Telegram на физическом телефоне сохранён.

## Поведение

- Бесплатный повторный Undo убирает последнее принятое действие до начала
  попытки. Работает в settled playing и из lost; недоступен при пустом журнале,
  resolving, loading/error, pause/hidden/platform pause и после won.
- Session воспроизводит укороченный собственный журнал через те же rules.
  Восстанавливаются все поля: stacks/ID, RNG, nextUnitId, magnets/radii,
  cleared/moves/turn/spawnedUnits/terminal/stars. Повтор действия воспроизводит
  тот же полный resolution, включая spawn и очередь. Invalid/cancel не добавляют ход.
- Assisted становится true и сохраняется при новых ходах, отменах до нуля и reload.
  Retry начинает новую попытку того же seed с assisted=false. Старые достижения
  кампании не уменьшаются. Схема и contentVersion сохранений прежние: assisted
  уже входил в их контракт, изменения правил/seed не потребовались.
- Runtime использует общий reset presentation с Restart: сбрасывает RAF/жест,
  timeline/collection и audio cues, сразу показывает восстановленный счётчик,
  очищает выбор/hover и возвращает keyboard focus полю. Board не пересоздаётся.
- Undo находится рядом с Restart; на первом ходе видна disabled-кнопка Undo.
  Отдельная кнопка есть на экране проигрыша. Минимальная область касания 44px,
  доступны touch и keyboard. В коротком landscape декоративная картинка lost
  скрыта, чтобы обе кнопки помещались; остальные экраны сохраняют её.

## Проверки

- `node --test tests/v4-undo.test.js tests/progress-v4.test.js tests/ten-range.test.js`:
  22/22 PASS. Сравнение всех полей before/after, повтор полных resolutions,
  retained/new radii, seed0/1/uint32-max, партии spawn1/2/3, повтор до нуля,
  resumed loss, won lock, помощь/retry, achievements, transient/custom rules,
  quota/corruption/conflict. История сверх 2048 проверена на owner с тестовыми
  rules, а не выдана за длинную реальную партию.
- `pnpm check:full`: 248/248 tests и production build PASS.
- `pnpm build:platforms` и `pnpm test:platforms`: web/embed/Telegram artifacts,
  production smoke, SDK isolation, safe areas, platform pause OR, iframe/cache PASS.
- `$env:UNDO_DEV_URL='http://127.0.0.1:5175/'; node tools/undo-v4-browser-check.cjs`:
  production web390×844 и Telegram mock844×390 — реальный touch по кнопкам,
  keyboard placement/Undo, clear+spawn, немедленный reload, три отмены до нуля,
  assistance, loss→Undo→repeat loss→Retry, won lock и старые achievements PASS.
  Проверены размеры Undo и отсутствие пересечений HUD/tray/actions/status.
- DEV: реальные touch placement, invalid drag, resolving/pause locks, 20 циклов
  reset/move/pause/Undo без старых collection/drag/mesh и без роста ресурсов
  после прогрева (8 geometries, 12 textures), resize/dispose PASS.
  Hidden проверен синтетическим событием visibilitychange; это проверка обработчика,
  не настоящего OS background или закрытия Telegram.
- `node tools/tutorial-browser-check.cjs`: пять viewport, endpoints, resize/scroll,
  selection, mouse cancel, pause/reduced и touch drop PASS.

Просмотрены screenshots portrait/landscape, restored board и обе кнопки lost.
Логи: `artifacts/undo-*.log`, `.telegram-check-logs/`; снимки и краткие результаты:
`artifacts/undo-v4/`. Первые проверки выявили 34px Undo и пересечение toolbar/tray
в compact Telegram: исправлены размер, место кнопки и бюджет рядов. Скриншоты
снимаются после завершения tray animation; промежуточный кадр не выдают за layout.

Физический телефон и native Telegram не запускались. Не добавлены Redo, валюта,
лимиты помощи, реклама или обратная анимация. Replay линейный по длине журнала;
скорость на реальном телефоне не измерялась. Ограничения optimistic storage
сохраняются: при конфликте Undo работает в памяти, но не перезаписывает новую вкладку.

Публикация — remote main / deploy-pages.yml. Точные SHA, CI и проверка опубликованной
версии записываются в итоговом сообщении и `artifacts/undo-v4/release.json`.
