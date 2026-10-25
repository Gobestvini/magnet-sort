# Отдельная доска дня v4

2026-10-25, TASK-0071, исходная ревизия daef763. Пользователь принял Hint и
поручил доску дня, затем отдельно выбрал B только для daily. Кампания остаётся A.
Техническая, независимая и пользовательская приёмка завершены.2026-10-25
пользователь сообщил «проверил доску дня всё норм» и поручил Telegram-вызов.
Статус done по пользовательской приёмке; устройство/версия клиента не сообщены.

## Контент и правила

- Catalog version `daily-30-2026-10-25.1`, preset `short-b-2026-10-25.1`,
  content version `sub-ten-2026-10-20.1`. Каталог и literal параметры deep frozen.
- 30 досок: по5 seed0…4 уровней1–6. Ограниченный авторинг проверяет первые
  выигравшие seed0…99 на общем kernel, cutoff320 отдельно unknown; первые30
  кандидатов оказались выигравшими. Все30 воспроизводят победный replay,
  5–15 ходов. Это свидетельства решений, не обещание человеческого времени
  или минимальности. Параметры B: goals40…150, интервалы1×6/2×3/3×3;
  кампания не переключается на B, пороги звёзд прежние.
- Catalog SHA-256(JSON): `3e02ff4c6b5b8a5cc3325681215928a02462074a89aaf60f19511b94bebdf06c`.
  Генератор по умолчанию сверяет каталог и fixture, `--write` создаёт лишь
  отсутствующий fixture и отказывает при drift существующего. Опубликованную
  версию нельзя менять задним числом; новый контент требует новой версии.
- `getDaily(instant)` вычисляет UTC YYYY-MM-DD и неотрицательный modulo30
  относительно2026-01-01. Дата/descriptor закрепляются при входе. Retry/reload
  продолжают этот день даже после полуночи; Return и новый вход выбирают сегодня.

## Владение и сохранение

`daily-v4.js::createV4ModeSession` выбирает campaign или отдельный transient
daily session с B; один runtime/renderer/audio обслуживает оба режима. Daily
действия синхронно сохраняют свой журнал до timeline. Схема кампании и legacy
daily не меняются; дневной ключ — `magnet-sort.v4.daily.v1`.

Дневной envelope schema1 содержит catalogVersion/revision/activeView,
campaignSelection, activeAttempt с date/index/levelId/seed/versions/actions/assisted
и results. Campaign envelope во время daily не переписывается; при reload
`suspendedStartup` откладывает campaign auto-advance/persist. Return восстанавливает
точный campaign state/history и доступный сохранённый выбор; daily victory
не открывает campaign level. Audio settings общие, новые context/RAF не создаются.

Local best разделён на bestAssisted/bestUnassisted. Сравнение: победа прежде
поражения, затем меньше moves; tie хранит ранний recordedAt. По одной записи
на UTC-день данной версии, повтор не удваивает completion. Семидневный календарь
отмечает победу любой категории. История ограничена90днями, пропуск не штрафуется.

Часы устройства выбирают день; это локальный клиентский режим без призов и
рейтинга. Панель прямо сообщает эти границы. Неизвестный catalog/content,
несовпадающий seed/date и corrupt JSON сохраняются без молчаливой замены.
Для распознанной active daily проблема видна при запуске, для malformed без
activeView — при добровольном входе. Return открывает кампанию, Update game
перезагружает приложение. Quota/denied оставляют игру в памяти с предупреждением.
Конфликт вкладок проверяется по exact raw-value; localStorage не имеет CAS.

## Проверки

- 4/4 catalog tests и `node tools/generate-daily-catalog.mjs --check`:
  30 winning replays, неизменность literal каталога/параметров и hashes PASS.
- Автор:34 targeted tests daily/progress/Undo/Hint PASS. Независимый критик:
  38 tests daily/catalog/progress/Undo/Hint и generator PASS.
- Финальный `pnpm check:full`:268/268 tests и production build PASS.
- `pnpm build:platforms`, `pnpm test:platforms`: web/embed/Telegram,
  SDK isolation/ready/safe areas/pause OR, iframe и scoped resource cache PASS.
- Production daily web390×844 и Telegram mock844×390: общий UTC при timezone
  New York/Tokyo; Hint→отдельный touch, Undo/reload, midnight/retry, две категории
  local best, сохранение раннего tie, calendar/completion, Return с точными
  raw campaign/selection/history/audio, вход нового дня и corruption/version PASS.
- Новые Retry/Return/Update проверены44px и внутри viewport после прокрутки;
  root Telegram selector ранее сжимал Pause Retry и recovery кнопки до34px.
  Узкие классы daily-retry-button/daily-recovery-button исправили каскад,
  без изменения остальных платформенных кнопок. Критик повторил currentdist PASS.
- Регрессии production Hint, Undo, tutorial (5viewport) и Pages (desktop/mobile
  victory/stars/retry/pause) PASS.
- DEV normal-motion: touch Hint→отдельный ход→pause/resume→Undo→Return,
  восемь циклов режимов, точный campaign state/history, warmed resources,
  resize/reduced/dispose PASS. Три цикла прогрева и пять измеряемых циклов;
  в финальном прогоне стабильны8 geometries/13 textures.
- Критик независимо проверил UTC midnight, Retry, daily reload/Return, Hint/Enter,
  Undo и сохранность exact raw campaign. Отдельно проверил daily победу при
  suspended won campaign: Return не переключил её уровень и не переписал envelope.

Команды финальной прогонки:

```powershell
node tools/generate-daily-catalog.mjs --check
node --test tests/daily-v4.test.js tests/daily-catalog.test.js tests/progress-v4.test.js tests/v4-undo.test.js
pnpm check:full
pnpm build:platforms
$env:DAILY_DEV_URL='http://127.0.0.1:5175/'
node tools/daily-v4-browser-check.cjs
pnpm test:platforms
node tools/hint-v4-browser-check.cjs
node tools/undo-v4-browser-check.cjs
node tools/tutorial-browser-check.cjs
node tools/pages-browser-check.cjs
```

Full build очищает dist; platform builds должны идти после него. Browser tool
обслуживает dist/web и dist/telegram под `/magnet-sort/`, либо опубликованное
combined дерево при PUBLICATION_LAYOUT=combined. Логи: `artifacts/daily-*.log`,
`.telegram-check-logs/`; screenshots/results — `artifacts/daily-v4/` и
`artifacts/daily-critic*`. Полные replays — versioned tools/fixtures.

Browser тест использует управляемый UTC-clock двух timezone, сохраняя midnight
через reload; это проверка веток клиента, не настоящая смена часов телефона.
Реальный Telegram/физический телефон агентом отдельно не проверены; пользователь
принял новую доску2026-10-25. Эта приёмка не создаёт новых агентских device-замеров.

Доставка: свой проверенный коммит в remote main, Deploy GitHub Pages и published
web/Telegram mock smoke. SHA/CI/revisions записываются в итоговом сообщении и
`artifacts/daily-v4/release.json`.
