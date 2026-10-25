# Объясняющая подсказка v4

2026-10-25, TASK-0070, исходная ревизия faecdf1. Пользователь принял оставшиеся
проверки TASK-0066/0069 и поручил следующий шаг. Production баланс сохранён.
Техническая реализация, независимая и пользовательская приёмка завершены.
2026-10-25 пользователь подтвердил: «проверил подсказку всё норм переходи
к следующей задаче — доске дня». Статус done; параметры устройства не сообщены.

## Поведение

- Hint перебирает legal пары текущего tray и пустых клеток через общий
  `resolveMagnetInfluence`. Приоритет: clearedDelta, freeDelta, movedCount,
  затем порядок tray и row/col. Будущие спавн/очередь/RNG не просматриваются.
- Кнопка выбирает цвет и клетку, показывает статичный прозрачный маркер на
  фактической проекции свободной клетки и вычисленное объяснение эффекта до спавна.
  Ход отдельно выполняется касанием клетки или Enter при focus поля.
- Если ни одна пара не перемещает фишки, рекомендация отсутствует; текст сообщает
  об отсутствии притяжений сейчас и ближайшем пополнении. Это не вывод о тупике.
- `session.markAssisted` синхронно сохраняет assisted=true без изменения модели
  и журнала; повтор Hint на той же state использует кэш и не пишет save повторно.
  Reload/Undo сохраняют помощь, Retry начинает новую попытку без помощи.
- Текст/маркер очищаются при accepted ходе, выборе другого цвета, reset/Undo,
  смене уровня, pause/hidden/dispose и перезапуске renderer. Старый tutorial
  первого хода возвращается при сбросе; мини-карты радиусов не меняются.
- Hint доступен touch/keyboard, минимум 44 CSS px, заблокирован при resolving,
  loading/error, pause и terminal. Маркер статичен и при reduced motion.

## Проверки

Профильные unit и независимая приёмка:

- 23/23 tests hint/tutorial/ten-range PASS; независимый критик повторил
  расширенные hint/tutorial/ten-range/undo/progress: 32/32 PASS.
- Unit проверяют очищение/освобождение/перенос, tie order, immutable model,
  seeded state/events, assistance без action, reload/Undo/Retry, transient и
  отказ storage. Эвристика не подменяет dry resolver и не просматривает spawn.
- Критик независимо проверил 390×844, 844×390, 1280×900, 740×360: маркер
  совпадает с проекцией, Hint ≥44px, смена уровня очищает подсказку. Проверил
  Telegram mock844×390 с safe insets: controls заканчиваются на y310,
  объяснение y316–360. Физический телефон этим не заявлен.
- Исправлены найденные регрессии: первая подсказка меняла tutorial layout,
  ResizeObserver сбрасывал keyboard cursor; resize теперь сохраняет его.
  Реальный Hint→focus canvas→Enter создаёт ровно рекомендованное действие.
  Compact rows/tray учитывают безопасные отступы и длину текста; логотип
  ограничен высотой topbar и не обрезается.

- `pnpm check:full`: 255/255 tests и production build PASS.
- `pnpm build:platforms`: web/embed/Telegram PASS.
- `tools/hint-v4-browser-check.cjs`: production web390×844 и Telegram mock844×390
  PASS. Проверены точное объяснение/цвет/клетка, неизменная модель/RNG/журнал,
  сохранение assistance после reload, повтор Hint без новой записи, touch и
  отдельный keyboard Enter, cleanup select/pause/reset/Undo, tutorial и terminal
  locks. Layout проверен по bounds и просмотренным PNG.
- DEV: normal-motion реальное touch placement, resolving lock, invalid drag,
  resize/reduced/hidden, synthetic zero-pull без assistance и dispose PASS.
  После трёх прогревочных циклов ещё десять циклов Hint/move/Undo сохраняют
  8 geometries и 13 textures. Прогрев нужен для ленивой загрузки геометрии GPU;
  ресурсы измеряются строго на последующих десяти одинаковых циклах.
- Критик независимо повторил final lifecycle, включая zero-pull: PASS8/13.
- `pnpm test:platforms`: production web/embed/Telegram, SDK isolation, ready,
  pause OR, safe areas, iframe, resource cache/hash repair/reload PASS.
- `node tools/tutorial-browser-check.cjs`: пять viewport, endpoints,
  selection/resize/scroll, mouse cancel, pause/reduced и реальный touch drop PASS.
- `node tools/pages-browser-check.cjs`: desktop/mobile seeded victory/stars,
  retry/pause под production subpath PASS.

Точные команды:

```powershell
node --test tests/hint-v4.test.js tests/tutorial-guide.test.js tests/ten-range.test.js
pnpm check:full
pnpm build:platforms
pnpm test:platforms
$env:HINT_DEV_URL='http://127.0.0.1:5175/'
node tools/hint-v4-browser-check.cjs
node tools/tutorial-browser-check.cjs
node tools/pages-browser-check.cjs
```

Сначала full check, затем build:platforms: обычный Vite build очищает `dist`,
включая ранее построенные `dist/web` и `dist/telegram`. Production Hint tool
по умолчанию обслуживает оба target из этих подкаталогов.

Synthetic zero iframe использует второй настоящий runtime. Host заранее
ставится на паузу через видимую кнопку: иначе host blur открывает modal,
его autofocus забирает focus у child и законно очищает child Hint. Проверка
сохраняет реальный tap Hint, ожидание startup и обработчики console/pageerror
обеих страниц; подсказка не вызывается напрямую через debug.

Логи: `artifacts/hint-*.log`, `.telegram-check-logs/`. Screenshots и краткие
browser результаты: `artifacts/hint-v4/`. Zero-pull использует синтетическую
transient DEV-доску: это интеграционная проверка ветки, не достижимый campaign
replay. Hidden проверяется synthetic visibilitychange, не OS background.

Новый физический телефон и native Telegram не проверяются этим срезом;
пользовательская приёмка предыдущих задач не выдана за проверку Hint. Субъективное
удобство объяснения принято пользователем 2026-10-25; browser QA проверяет совпадение
чисел и видимого эффекта, не человеческую сложность. Полного solver и обещания
выигрышности нет; модель, схема save и contentVersion сохранены.

Публикация — проверенный коммит в remote main / deploy-pages.yml. Точные SHA,
CI и проверка опубликованной версии сохраняются в `artifacts/hint-v4/release.json`
и итоговом сообщении.
