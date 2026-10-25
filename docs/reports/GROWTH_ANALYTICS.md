# Аналитика активного v4: ядро и сервер

Дата: 2026-10-25. Реализация для поручения «сначала аналитика, потом задания и
коллекция, дальше реклама и покупки». Этот отчёт покрывает только аналитическое
ядро; UI, runtime wiring, HTTP entry, размещение и внешняя приёмка интегрируются
ведущим. Не считать наличие модулей проверенным поступлением production-событий.

## Контракт клиента

`src/telemetry/client.js` экспортирует `createTelemetry(options)` и
`createBrowserTelemetry(options)`; последний безопасно получает localStorage.

Опции: `endpoint` — полный URL `/analytics/events`, `deleteEndpoint` — по умолчанию
тот же URL с `/events` → `/visitor`, `platform`, `build`, `environment` (`qa` по
умолчанию, production задаётся явно), необязательные `storage`, `send`, `erase`,
`now`, `id` для проверки. `send(payload,AbortSignal)` возвращает boolean;
`erase({visitorId,deletionToken})` возвращает boolean. Обычный HTTP transport
использует `credentials:omit`, JSON, таймаут 8 секунд.

Методы:

- `track(name,properties,dedupe?)` — только после opt-in и при настроенном endpoint
  или transport. Возвращает принят ли event в очередь. `schema.js` содержит
  разрешённые события и свойства. Платформа/версия/окружение берутся из конфигурации,
  caller не может их подменить. Произвольные поля/сырые ошибки/URL/профиль/initData/
  суммы платежей не проходят в payload.
- `flush()` — максимум20 событий, один in-flight запрос. Ошибка сохраняет очередь
  и исходные event IDs; backoff2–60сек. Таймерами и lifecycle владеет runtime.
- `setConsent(true)` — сохраняет предпочтение; ID ещё не создаёт. Первое событие
  создаёт отдельный случайный visitor ID, session ID и секрет удаления.
- `setConsent(false)` — синхронно выключает отправку, abort активного запроса,
  очищает локальную очередь/ID, сохраняет отказ. Возвращает Promise с результатом
  server erase: `{deleted:true}` или `{deleted:false,reason:'erase-unavailable'}`.
  Во втором случае UI должен честно сообщить о неуспешном удалении на сервере:
  локальное удаление выполнено, серверные данные истекут по retention. Локальный
  секрет после отзыва не сохраняется, поэтому автоматической повторной отправки
  запроса удаления нет.
- `consent()`, `snapshot()`, `dispose()`. Snapshot не раскрывает visitor/deletion IDs.
  Dispose останавливает модуль и отменяет запрос; не вызывать немедленный dispose
  вслед за flush, если требуется дождаться его завершения.
- `syncConsent()` — немедленно применяет внешний сохранённый отказ и abort активного
  запроса без повторной server erase. Runtime может вызывать по storage event для
  обновления UI; `track`, `flush` и чтение consent дополнительно проверяют отказ сами.
  Внешний opt-in не включает автоматически уже работающую отключённую инстанцию.

Canonical commerce events: `ms_ad_offered`, `ms_ad_started`, `ms_ad_rewarded`,
`ms_ad_completed` (interstitial), `ms_ad_error`, `ms_purchase_started`,
`ms_purchase_paid`, `ms_purchase_granted`, `ms_purchase_refunded`, `ms_purchase_error`.

Очередь: максимум200, только события последних24часов, максимум20 за запрос.
Сохранённая очередь загружается только при сохранённом opt-in и валидных данных.
В браузерном localStorage каждый pending event хранится отдельным immutable ключом,
а подтверждение отправки удаляет только точные доставленные IDs. Общего
read/modify/write массива между вкладками нет: A.flush не может перезаписать
неотправленный event вкладки B. Reload перечисляет оставшиеся journal records.
Одновременные отправки одного event допустимы: сервер дедуплицирует исходный ID.
Если ограниченный StorageLike не имеет `length/key`, используется merge/ack массива;
это compatibility fallback без полной гарантии атомарности произвольных
межпроцессных записей. Реальный browser localStorage использует journal.
Session меняется после30минут неактивности. Дедупликация caller-key ограничена1000
записями в памяти; повторный HTTP batch независимо дедуплицируется сервером по ID.
При недоступном storage игра работает, но consent/очередь/долгосрочный ID не переживут
reload. Нет fingerprinting, авто-снимков экрана, полного URL/referrer или профиля.

## Контракт сервера

`server/telemetry.mjs::createTelemetryService({storagePath,now,...})` использует
Node24 `node:sqlite`, без новой npm-зависимости. Для Docker необходим также
`src/telemetry/schema.js`. Отдельный SQLite-файл, WAL, secure_delete; namespace
не разделяется с White Tower. HTTP CORS/body/rate limits/admin authentication
остаются обязанностью entry.

- `ingest({schemaVersion:1,deletionToken,events})` →
  `{accepted,duplicates,rejected:0}`. От1до20, payload≤32KiB; строгие поля, UUID,
  canonical ISO timestamps возрастом≤24ч/будущее≤5мин. Одна visitor identity на
  batch. Вся партия атомарна. Ошибка — Error с `status` и `code`, без payload.
- `deleteVisitor(visitorId,deletionToken)` → `{deleted:true,removed}`. HTTP entry
  передаёт visitor ID из JSON body, отдельный token из Bearer. Токен в SQLite
  хранится SHA256; visitor/session IDs также хешируются. Несовпадение token→403.
  Tombstone на35дней не даёт in-flight batch воскресить удалённые записи.
- `summary({from,to,environment='production',platform?})` → только агрегаты:
  события/уникальные device IDs/сессии, attempt counts и outcomes, дневная активность,
  D1/D7 с eligible/returning знаменателями и `null` без зрелой когорты.
  Retention считает точный следующий/седьмой UTC-день, только завершённые дни и
  полностью наблюдаемые когорты в окне хранения. QA не влияет на production cohort.
  Это opted-in device retention, не доказанные реальные люди или вся аудитория.
  `outcomes` — последний наблюдавшийся итог на visitor+attemptId в выбранном периоде:
  loss→Undo снимает завершение, loss→Undo→win считается одной победой. При равных
  timestamp используется `observationSequence`, затем server received/insertion order.
  Runtime передаёт возрастающий observationSequence; старые producers имеют fallback.
  Terminal без attemptId не считается валидной попыткой. Raw event counts остаются
  отдельно и не являются числом финально завершённых попыток.
- `prune()`, `close()`. По умолчанию raw events удаляются после35дней, настройки
  поддерживают8–90дней. Когорты первого визита сохраняются пока visitor активен,
  чтобы prune не делал давнего игрока «новым». Старые неактивные идентификаторы
  и tombstones также истекают. Лимиты:100000 событий/день,20000 сессий/день,
  3000событий/visitor/день. Проверка бюджета атомарна, это не защита от всего bot spam.

HTTP summary должен быть закрыт admin-доступом. Клиентские события purchases —
только воронка, не финансовый ledger. Данные/договоры/backup другой игры не используются.
Физическая очистка внешних backup и сроки их хранения определяются deployment;
логическое удаление из живой БД не является доказательством удаления из чужой копии.

## Самопроверка исполнителя

`node --test tests/telemetry-client.test.js tests/telemetry-server.test.js`:
21tests PASS25.10.2026 на Node24.19.0. Проверены:

- отсутствие ID/network до согласия, allowlist и неподменяемый config;
- сохранение ID при retry, отсутствие потери из-за сетевой ошибки, bounded restore;
- отзыв во время запроса, отдельный deletion credential, видимая ошибка erase;
- отзыв в другой вкладке с общей storage: прекращение track/flush, abort и отсутствие
  повторного создания ID/локальной очереди; canonical commerce event names;
- две живые вкладки и reload после flush; отдельный regression «A уже отправляет,
  B добавляет event, A подтверждает свой batch, C после reload доставляет B»;
  compatibility merge/ack ограниченного non-enumerable StorageLike;
- отказ storage и dispose, session rotation, TTL;
- SQLite reopen, повтор batch, разделение QA/production/platform;
- malformed/лишние приватные поля/время/batch limits и атомарный rate budget;
- final-observed outcome после loss→Undo→win и loss→Undo без завершения,
  равные timestamps с reordered delivery, отсутствие attemptId и независимость visitors;
- недопустимый deletion token, tombstone и race удаления с первой отправкой;
- зрелые D1/D7, правильные знаменатели и отсутствие ложного нуля после prune.

Браузер, реальный Telegram/телефон, CI/build и удалённый ingestion этим
исполнителем не проверялись; это остаётся интеграционной приёмкой ведущего.
