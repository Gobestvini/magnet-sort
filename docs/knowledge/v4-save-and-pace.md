# V4 save, прогноз и темп: проверенные границы

## Лидерборды: pending и вкладки — 2026-10-25

Признак: network503 после победы, затем reload автоматически открывает следующий
уровень; accepted journal предыдущей победы больше нет у игрового owner.
Способ: сохранить перед POST ограниченный pending winner отдельно от текущей
попытки (один/mode, два всего,512KiB), со стабильными clientAttemptId/runId и
исходным журналом. Renew/Next/Undo не заменяют pending; явный Retry повторяет
именно старую победу. Server receipt/digest делает lost response идемпотентным.
Blind setItem всего ranking envelope из второй вкладки стирал чужой pending;
exact-raw guard останавливает stale запись и показывает конфликт до reload.

Источник: TASK-0076, leaderboards-client.js, server/store, [отчёт](../reports/LEADERBOARDS.md).
Проверка:21 client tests и real client/API/SQLite/worker contract; browser web/
Telegram mock503→reload owner-next→original journal retry,20 modal cycles PASS.
Ограничения: localStorage без настоящего CAS; quota/unavailable storage явно
показывается, ограниченная очередь не обещает бесконечный offline upload. Реальная
публикация/API/bot acceptance отдельно от этих локальных проверок.

## Сервер рейтингов — подготовка2026-10-25

Пользователь поручил проработать сервер для запуска76 и уточнил: проверять
существующего бота, новый не нужен. Решение: [LEADERBOARDS_SERVER](../design/LEADERBOARDS_SERVER.md),
отдельный Node24/SQLite/Compose на уже имеющемся VPS, own API/DB/backup.
Вид подтверждения: read-only SSH snapshot ресурсов/сети/Caddy; Telegram WebK
DOM подтвердил MagnetSortPuzzleBot id8820798959, а Play launch дал корректную
Ed25519 signature с официальным production key (проверка в памяти, raw initData,
профиль и секреты не сохранялись). Это проверка метода/бота, не готового HTTP auth.
Технический frozen daily-контракт f799c84 принят для76 отдельно от phone review71.
TASK-0076 ready; реализация нового сервера/API/БД/backup и UI ещё не выполнена.
Границы/версии/лимиты/операции записаны в контракте, не в общих инструкциях.

## Решение об очереди — 2026-10-25

Источник: прямое сообщение пользователя о том, что все задачи на проверке
пройдены. TASK-0025/0042/0057 закрыты по пользовательской приёмке; это обновляет
прежний отдельный review0057, без новых агентских/device замеров. TASK-0073
(цветовые заказы) отменена, а не реализована. Вместо неё пользователь запросил
лидерборд и отдельно выбрал оба рейтинга — кампания и доска дня:
[TASK-0076](../tasks/TASK-0076-leaderboards.md). Вид подтверждения: решение и
приёмка пользователя; серверный рейтинг пока не реализован. Решение относится
к этой очереди, не отменяет проверки новых задач.

2026-10-25: пользователь подтвердил оставшиеся проверки сохранения и темпа
(TASK-0066/0069) и разрешил продолжение. Источник — сообщение пользователя,
вид подтверждения — пользовательская приёмка; модель устройства, версия клиента,
число участников и замеры не сообщены. Статусы done; production A сохраняется,
выбор B и закрытие отдельной TASK-0057 из этого не следуют. Ниже сохранены даты
и ограничения исходных автоматических проверок.

## Вызов другу — 2026-10-25

Источник: [V4_CHALLENGE](../reports/V4_CHALLENGE.md), challenge-v4/content/session,
platform context и generator. Manifestиз8LFsources+layouts+profiles имеет
SHA-2561641a993…9601492; payload102/111chars, fixedA/B, cap160. Hash — только
совместимость, moves/assisted — непроверенное заявление; наград по payload нет.

Признак: platform launch приходит после constructor, preview уже переписал
кампанию. Способ: adapter context устанавливается bootstrap до import runtime,
incoming preview задаёт suspendedStartup. Отдельный transient owner начинает
initialseed только по Play; base campaign/daily не пишутся при preview/Cancel/play.
Полезная ошибка: URLseed рядом с challenge выбирал чужой DEVbase; incoming теперь
игнорирует fixedSeed/customDEVprofile, а обычный DEV остаётся прежним.

Проверка2026-10-25:291tests/build, SDKisolation/platform, productionweb/Telegram
mock/embed, A/B initialstate, chooser/cancel/error/copy, rawcampaign/day isolation,
won/lost/Hint/Undo/Return, comparison/help,8cycles/resize/dispose и independentQA PASS.
Реальных сообщений/доставки не было; taskreview только для разрешённой реальной
пересылки/получателя. Основной staticURLбота обновляется тем же проверенным
CIartifact, без изменения botsettings/backend/чужих routes.

## Доска дня — 2026-10-25

Пользователь принял новый режим2026-10-25: «проверил доску дня всё норм» и
разрешил TASK-0072.0071 done, без сообщённых параметров устройства/клиента.

Пользователь отдельно выбрал B только daily: goal30+10*N, действующий spawn;
кампания A не переключалась. Каталог `daily-30-2026-10-25.1` заморожен:
30L1–6/seed0–4, все с winningreplay,5–15ходов. Источник: задача0071 и
[V4_DAILY](../reports/V4_DAILY.md), дневные модули и generator fixtures.

Признак: reload второго режима переписывает приостановленную кампанию или
пропускает её won. Причина: constructor выполняет persist/entry policy даже
для неактивного owner. Способ: отдельные rules/attempt/store и mode coordinator;
campaign suspendedStartup читает без entry writes/advance. Дневной журнал
сохраняется до timeline, Return восстанавливает точный campaign owner и selection.

Проверка2026-10-25:268tests/build;30replays; web/Telegram mock с управляемым
UTC и разными timezone, midnight/reload/Hint/Undo/Retry/Return, exact campaignraw,
woncampaign, localbest/help/tie/calendar, corruption/version/conflict и
independentcritic PASS.8modecycles послеwarm стабильны, sharedaudio не меняется.
Полезная ошибка: platform rootselector сильнее общих pause minheight; новые
Retry/Recovery получили отдельные scoped44px classes и browser bounds checks.
Ограничения: дата клиентская, optimistic localStorage безCAS; реальные
Telegram/телефон агентом отдельно не проверены. Пользовательская приёмка получена.

## Hint — 2026-10-25

Пользовательская приёмка получена2026-10-25: подсказка оценена «всё норм»;
устройство не сообщено. Для следующей TASK-0071 пользователь отдельно выбрал
пресет B только daily: goal30+10*N при действующем spawn. Кампания остаётся A.

Признак: общий совет не объясняет конкретный доступный ход, а полный apply
просматривает будущий spawn/RNG. Способ: оценивать legal пары через общий dry
resolver, ранжировать cleared/free/moved и стабильные tray/row/col ties; кэшировать
по identity state. Assistance — отдельная синхронная запись session, без action.
Первый Hint меняет tutorial layout: resize должен сохранять keyboard cursor
независимо от отмены pointer gesture. Текст/маркер очищаются одним helper.

Проверка: 23 профильных и 255 full tests/build, production web/Telegram mock,
touch/отдельный Enter, reload/Undo/Retry, layout/safe insets и independent critic
PASS. После трёх GPU warm cycles десять одинаковых циклов стабильны8/13.
Источник: [V4_HINT](../reports/V4_HINT.md), runtime/session/hint-v4 и browser tool.
Ограничения: эвристика до спавна, без solver promises; zero-pull synthetic,
hidden handler synthetic; новый телефон агентом не проверен, субъективное
удобство принято пользователем2026-10-25 без данных об устройстве.
Synthetic iframe с вторым runtime: заранее поставить host на паузу реальной
кнопкой, иначе autofocus его pause modal забирает focus у child и очищает Hint.
После общего full build повторить platform builds: Vite очищает dist и его
старые target подкаталоги; иначе browser target URL вернёт404 вместо игры.

## Undo — 2026-10-23

Признак: откат только stacks оставляет другой spawn/queue/RNG и теряет историю
после reload. Способ: session владеет accepted журналом, Undo заново воспроизводит
его префикс теми же rules и синхронно сохраняет assisted=true. Внутренний журнал
уже проверен owner; его replay не ограничен лимитом чтения внешнего save. Won
не отменяется; Retry создаёт новую attempt, прошлые achievements не уменьшаются.
Runtime очищает presentation через один helper с Restart, включая audio cues,
collection/RAF/gesture; displayedCleared сразу равен восстановленной модели.

Проверка: 22 профильных tests, 248 full tests/build, production web/Telegram mock,
touch/keyboard/reload/lost/assisted, три отмены до нуля, 20 resource cycles,
layout и tutorial smoke. Источник: [V4_UNDO](../reports/V4_UNDO.md).
Полезная ошибка: compact Telegram selector с :root[data-platform-viewport]
сжимал Undo до34px, а фиксированный ряд HUD не учитывал forecast/новую кнопку.
Решение: Undo в actions, явный бюджет compact rows, scoped minimum44px; проверять
реальные bounds и пересечения после окончания tray animation, затем смотреть PNG.
Ограничения: Chromium surrogate; hidden — synthetic handler boundary, не OS
background; физический телефон не проверен. Replay O(actions), без snapshot-cache.

2026-10-19, TASK-0066/0067/0069. Источник: session/progress-v4/spawn-forecast,
model-v4 explicit factory и tools/experiments. [Save](../reports/V4_SAVE_CONTINUE.md),
[forecast](../reports/SPAWN_FORECAST.md), [темп/входные hashes](../reports/TELEGRAM_SESSION_PACE.md).

- Признак: закрытие во время анимации теряет ход либо повторно начисляет сбор.
  Причина: presentation временно отстаёт от уже окончательной модели.
  Способ: синхронно сохранить seed+accepted log до makeTransferTimeline;
  при входе replay через тот же kernel, display сразу final cleared/queue,
  без timeline/audio cues. Проверка: полные replay states и production immediate
  reload в web/Telegram mock PASS. Ограничения: native phone не проверен;
  contentVersion надо менять при несовместимых rules/content.
- Признак: новая вкладка перетёрта старой. Способ: revision + exact raw comparison
  перед write, sticky memory fallback и явный reload; corruption не заменять без
  кнопки. Две реальные browser tabs и unit same-revision collision PASS.
  LocalStorage не имеет CAS: это не полная межпроцессная транзакция.
- Признак: прогноз перескочил раньше видимого spawn. Способ: общий stacksForMove,
  before до первого stackSpawned.start либо queueStart. Число — плановый максимум.
  Unit boundaries и normal/reduced production L7/L10 PASS; не заводить второй RNG.
- Признак: меньший интервал пополнения ускорил игру, но чаще заполняет поле.
  Способ: одинаковые seed/policy/cutoff и общий kernel с двумя явными параметрами;
  рядом считать wins/loss/unknown и input-locked timeline, а не только длину побед.
  A/B/C3600 runs +108 replay witnesses PASS: B L12=40/50 greedy, A8/50, C4/50.
  Это не человеческая выигрышность и не доказательство невозможных seed.
- Default сохранён36 pre-seam state/event traces + прежними witnesses.
  Custom rules разрешены только transient; DEV hook/preset labels отсутствуют
  в production bundles. Локальный preview — общий настоящий runtime в iframe.
  Human A/B двух людей и телефон остаются review. Измеренная timeline — бюджет
  блокировки ввода, а не полная длительность человеческой партии.
