# Сервер лидербордов Magnet Sort v1

Дата: 2026-10-25. Источник запроса — пользователь: проработать сервер, чтобы можно было запускать задачу на лидерборды кампании и дня. Это выбранный технический контракт для реализации, **не работающий новый API**. Сервер и клиент обоих рейтингов реализуются в [TASK-0076](../tasks/TASK-0076-leaderboards.md). Уточнение пользователя: использовать существующего игрового бота; новый бот не нужен.

## Проверенные условия и границы

Read-only SSH-аудит 2026-10-25: действующий VPS ARM64, 4 CPU, RAM 7729 MiB (available 6954), свободный диск около 62 GiB; Docker 29.9.1, Compose 5.6.0, Caddy 2.11.7. Это snapshot, не гарантия нагрузки. Доступ по существующему SSH-ключу с проверкой known_hosts подтверждён. Сервисы White Tower production/test и CarWars работают; их контейнеры, данные и backup нельзя заменять ради Magnet Sort.

Существующий Caddy подключён к внешней сети `tower-edge`; API-домен `api.plusvibegames.com` уже обслуживает отдельные префиксы и White Tower fallback. Игра размещена на `play.plusvibegames.com/magnet-sort/`; Pages — резервный frontend. Новый API/БД Magnet Sort на момент аудита отсутствуют. Текущий backup White Tower новую БД не покрывает.

Локальные источники фактов: `deploy/README.md` этой игры; `White Tower/server/deploy/README.md`, `compose.yaml`, `auth.mjs`, `ledger.mjs`, `backup.mjs` в соседнем репозитории, затем фактические Docker/Caddy/ресурсы VPS. Старый локальный Caddyfile White Tower отстаёт от remote: его нельзя копировать поверх живой конфигурации. Соседние исходники — примеры, не runtime-зависимость Magnet Sort.

Во время подготовки опубликован `f799c844b079c2b00217b34971328d8143be3616`: техническая реализация TASK-0071 и независимая приёмка завершены, 268 tests/build и 30 daily witnesses. Технический контракт каталога принимается для реализации76; отдельный review реального Telegram/телефона этим не закрывается. Новая серверная задача не выделяется: исходная76 может реализовать оба режима без незавершённой зависимости кода.

Frozen daily: catalog `daily-30-2026-10-25.1`, preset `short-b-2026-10-25.1`, content `sub-ten-2026-10-20.1`; SHA-256(JSON каталога) `3e02ff4c6b5b8a5cc3325681215928a02462074a89aaf60f19511b94bebdf06c`. Pure exports — `src/prototype/daily-catalog-v1.js` и `daily-rules.js::DAILY_RULES`, UTC mapping — `daily-v4.js::getDaily`, witnesses — `tools/fixtures/daily-v4-witnesses.json`. Все30 replay заново проверяются серверным adapter до его активации.

## Размещение и стек

| Элемент | Решение v1 |
| --- | --- |
| Compose project / HTTP service | `magnet-sort-leaderboards` / `api`, один экземпляр |
| Runtime | `node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`; multiarch manifest подтверждён Docker Hub API25.10.2026, содержит linux/arm64 |
| БД | `better-sqlite3` **13.0.3**, bundled SQLite **3.53.4**, отдельный `server/package-lock.json`; проверить `select sqlite_version()` в образе |
| Серверные исходники | `server/package.json`, `server/leaderboards/*.mjs`, `server/Dockerfile`, `server/deploy/*`; отдельно от frontend dependencies |
| Рабочий корень | `/srv/magnet-sort/leaderboards/`; immutable `releases/<sha>/`, `current`, постоянные `data/`, локальные `backups/` |
| БД | `data/leaderboards.sqlite`, WAL и SHM рядом на локальном диске; не внутри image/release, не NFS |
| Config | `/etc/magnet-sort/leaderboards.env`, root-owned, 0600; numeric `MAGNET_SORT_BOT_ID` публичен, токена бота в конфигурации нет |
| Сеть | Только `api` подключён к external `tower-edge`, уникальный alias `magnet-sort-leaderboards`, внутренний порт 8080; host ports не публиковать |
| Container | nonroot UID/GID 1000, read-only rootfs, `/data` rw, `/tmp` tmpfs 64 MiB, `cap_drop: ALL`, `no-new-privileges`, `pids_limit:64`, 512 MiB RAM, 1 CPU, logs 3×10 MiB, restart unless-stopped |
| HTTPS base | `https://api.plusvibegames.com/magnet-sort/v1` |

Выбор SQLite соответствует одному процессу записи и небольшой первой версии; второй HTTP replica к тому же файлу не добавлять. Переход на несколько узлов/много writers потребует отдельного изменения хранения. SQLite в `node:sqlite` сейчас RC; в этом решении используется закреплённая библиотека better-sqlite3. Версия SQLite учитывает официальный WAL-reset fix. Новую платную услугу или shared DB другой игры этот контракт не требует.

## HTTPS, браузер и доверие

В **API-блок** фактически смонтированного Caddyfile добавить только свой marker-блок `handle_path /magnet-sort/* { reverse_proxy magnet-sort-leaderboards:8080 }` перед общим fallback. `handle_path` удаляет `/magnet-sort`, backend видит `/v1/...`. Существующие `/carwars/*`, `/test/*`, `/health` и fallback сохранить; static-домен и его `/magnet-sort/` не изменять. Путь без `/v1` не должен попадать в соседнее API или SPA. Ответы этого API, включая ошибки и preflight: `Cache-Control: no-store`; CDN cache bypass для этого префикса, без browser challenge.

Разрешённые production Origins: ровно `https://play.plusvibegames.com` и `https://gobestvini.github.io`. Возвращать конкретный Origin + `Vary: Origin`, методы GET/POST/DELETE/OPTIONS и allow headers `Authorization, Content-Type, Idempotency-Key`. Cookie auth не использовать, fetch `credentials: omit`. `Origin: null`/чужой Origin отклонять; отсутствие Origin допустимо для CLI, но записи всегда требуют Bearer. Dev localhost разрешается только отдельной dev-конфигурацией. CORS не заменяет авторизацию.

Приложение по умолчанию игнорирует клиентские `X-Forwarded-For` и `CF-Connecting-IP`. Основная защита — глобальные бюджеты и лимиты проверенного account. Не включать строгий лимит на общий NAT/CDN peer, выдавая его за индивидуальный IP. Если позднее понадобится visitor-IP, сначала доказать доверенную цепь Caddy/Cloudflare с CIDR allowlist и strict parsing; не менять глобальную proxy-конфигурацию соседних сервисов незаметно.

## Telegram auth без токена бота

`POST /auth/telegram` получает raw `initData` в JSON body. Сервер проверяет Ed25519 по официальному production public key Telegram и фиксированному `MAGNET_SORT_BOT_ID`: строка `<bot_id>:WebAppData\n` + все полученные поля, кроме `hash` и `signature`, отсортированные по ключу, `key=value` через LF. Декодирование ровно одно; неизвестные поля не отбрасывать из подписанной строки. Не доверять `initDataUnsafe`, присланному userId или username как доказательству бота.

Отвергать duplicate keys, некорректный percent/UTF-8/base64url, неверную длину подписи, неоднозначные JSON, отсутствующий user.id, некорректный/несоответствующий числовой botId. Принимать только production key `e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d`; test key/fixture auth нельзя включить в production. `auth_date` — целые Unix seconds: возраст ≤300 секунд, допустимый будущий skew ≤30 секунд. Чужой бот/просроченная подпись дают 401 без fallback на клиентские данные или другой бот.

После проверки выдать opaque Bearer token из 32 криптографически случайных байтов, TTL **24 часа**, без sliding expiry. В SQLite хранить только SHA-256 token; максимум 10 действующих сессий/account, при новой 11-й отозвать самую старую. `user.id` хранить приватной десятичной строкой, наружу выдавать случайный opaque UUID игрока; публичное имя из signed user.first_name, ≤64 Unicode code points, без control/bidi символов, plain text, fallback `Player`.

Фиксированный `MAGNET_SORT_BOT_ID=8820798959`, существующий `@MagnetSortPuzzleBot`. Подтверждение 2026-10-25: уже авторизованный Telegram Web K, текущий чат `#@MagnetSortPuzzleBot`, отображённый `.peer-title` с именем Magnet Sort и `data-peer-id="8820798959"`. Затем Play запустил существующую Mini App на `https://play.plusvibegames.com`; подпись из DOM iframe launch URL проверена в памяти через Ed25519 crypto.verify официальным production key и этим botId: signaturePresent=true, signatureValid=true, freshAuthDate=true. Raw initData/профиль пользователя не сохранялись и не выводились, токен бота не использовался, сообщения не отправлялись. Production startup отвергает отсутствующий или иной botId и test public key. Fixture tests используют собственные тестовые Ed25519 ключи через dependency injection, недоступную production bootstrap. Проверка подтверждает совместимость реального запуска с выбранным методом, но HTTP auth именно нового backend ещё нужно реализовать и проверить.

TASK-0076 выполняет auth bootstrap при свежем Telegram launch (не позже первого открытия рейтинга через пять минут), без автоматической публикации результатов. Короткую сервисную сессию можно сохранить в отдельном scoped sessionStorage key для reload этой вкладки; raw initData не сохранять. Участие/публикация результата добровольные: первый ranked run требует `publishConsent:true`. Если запуск был offline и initData устарела, предложить повторно открыть Mini App; локальную попытку/кампанию сохранить. Отсутствие signature даёт понятный unsupported/update Telegram, без ослабления проверки.

## HTTP contract v1

Backend path ниже всегда начинается с `/v1`. JSON UTF-8, без HTML. Общая ошибка `{error:{code,requestId,retryable},serverTime}`; не включать payload, initData, userId или stack trace. `requestId` — серверный случайный ID.

| Метод / path после `/v1` | Вход / результат |
| --- | --- |
| GET `/health/live` | 200 если процесс работает; не раскрывает config/secret |
| GET `/health/ready` | 200 только после migrations/DB/worker readiness; иначе 503 |
| GET `/capabilities` | apiVersion, serverTime, campaign/daily enabled, список поддержанных content/preset/catalog versions |
| POST `/auth/telegram` | `{initData}` → token, expiresAt, приватный own player profile; только после проверки подписи |
| POST `/runs` | Bearer; `{clientAttemptId,mode,descriptor,publishConsent:true}` → runId, canonical descriptor, expiresAt |
| POST `/runs/:id/result` | Bearer; `{actions,assisted}` → receipt, canonical metrics, personal best; client totals не доказательство |
| GET `/leaderboards/campaign` | contentVersion/presetId; Top50 + rules/boardKey; Bearer optional для ownRow |
| GET `/leaderboards/daily?date=YYYY-MM-DD` | date + version selectors; Top50 + boardKey; Bearer optional для ownRow |
| DELETE `/me` | Bearer + `{confirm:"delete-leaderboards"}`; удалить свои live данные/сессии/рекорды, локальную игру не трогать |

`clientAttemptId` — случайный UUID из клиента, отдельный на новую попытку, сохраняемый вместе с ранговым descriptor независимо от local game journal. Уникальность `(playerId,clientAttemptId)`; повтор регистрации того же descriptor возвращает прежний runId, изменение descriptor даёт 409. Сервер проверяет format и сам разрешает descriptor по поддержанному профилю.

Campaign descriptor: `rulesVersion:4`, `contentVersion:sub-ten-2026-10-20.1`, новый протокольный `presetId:campaign-a-v1`, существующие levelId и uint32 seed незаконченной/завершённой попытки. Default goal50*N и kernel не менять. Поддержать позднюю регистрацию offline campaign с тем же seed; это не доказательство реального времени или отсутствия перебора seed.

Daily provider: чистый `resolveDaily(utcDate)` возвращает date, catalogVersion, contentVersion, presetId, levelId, seed и соответствующий immutable rules provider. При регистрации сервер сам назначает **текущий UTC-день** и проверяет совпадение client descriptor. Вчерашнюю offline-попытку без ранее выданного server run нельзя регистрировать вчерашней датой. Уже зарегистрированный вчера run принимается до `00:00 UTC` дня после следующего (конец следующего UTC-дня); после этого 410. Полночь не меняет закреплённый run, смена client clock не меняет серверный день. Устаревший descriptor — 409 `DAILY_DATE_CHANGED`, клиент сохраняет старую локальную игру и объясняет, что она не участвует в сегодняшнем рейтинге.

Production daily provider использует принятый frozen каталог f799c84 и общий DAILY_RULES. До проверки manifest/30 witnesses capability daily=false и daily register/query →503 `DAILY_NOT_READY`; задача не считается завершённой в таком состоянии. После проверки включить campaign/daily capabilities. Тестовый provider внедряется только в тестовый процесс и недоступен через production env. Внешние descriptor/API от внутреннего имени daily-модуля не зависят.

Статусы: 400 malformed; 401 invalid/expired auth; 403 consent/origin; 404 unknown/foreign run; 409 idempotency/version/date conflict; 410 expired run/date; 413 body/actions oversized; 422 replay rejected/non-won; 429 rate; 503 queue/capability/DB temporarily unavailable; 504 replay timeout. 429/503 содержат Retry-After. Чужой run не раскрывает наличие записи (ответ 404).

## Replay, сравнение и атомарная запись

Переиспользовать чистые `src/prototype/model-v4.js`, `levels-v4.js`, их transitively pure modules и constants; никакого DOM, UI, platform globals или копии расходящегося simulator. Каждый action должен быть accepted; только конечное состояние обязано быть terminal won. Action после terminal, неверный slot/color/cell/version отклоняются. Сервер сам считает `movesUsed`, `stars`, cleared и canonical digest (режим + версии + immutable descriptor + нормализованный журнал). Client `assisted` хранится для справки, помощь разрешена всем; не обещать доказательство unassisted или защиту от внешнего solver.

HTTP owner единолично владеет SQLite connection и короткими транзакциями. Replay — pool из **2 worker_threads**, без DB handles. Очередь ≤16, переполнение 503; deadline всей операции 5 секунд (включая очередь), timeout активного replay **250 ms после dispatch**, после него terminate/replace worker. При отмене/рестарте задача не должна записать поздний результат от старого worker. Хеш результата повторно проверяется owner перед transaction. Поздний ответ закрытому клиенту не отменяет уже завершённый DB commit; повтор получает тот же receipt.

`POST result` сначала после проверки Bearer/owner и вычисления canonical digest проверяет accepted status: тот же runId+digest возвращает сохранённый receipt в течение90дней от acceptedAt, даже если срок активного run уже истёк; иной digest после принятия даёт409. Лишь для ещё не принятых runs проверять active-run expiry и отправлять replay worker. В `BEGIN IMMEDIATE` повторно проверить owner/descriptor/status/expiry (конкурентный accepted status обрабатывается тем же правилом). В одной транзакции записать submission и лучший результат; unique constraints делают повтор безопасным. Никакой долгой replay-работы внутри write transaction.

Campaign boardKey включает rules/content/preset. Уникальный лучший результат `(player,boardKey,levelId)`; сравнение рейтинга: число завершённых уникальных уровней DESC, сумма bestStars DESC. BestStars — максимум по подтверждённым победам уровня. Ходы разных seed не сравнивать, старый LocalStorage не импортировать как доказательство; для участия старый уровень можно переиграть.

Daily boardKey включает rules/date/catalog/content/preset; лучший `(player,boardKey)` по moves ASC, ничья сохраняет раннюю запись. Потенциальные победы с разными version/seed не объединять. В обоих рейтингах competition ranking (1,1,3), стабильный порядок ничьих по opaque playerId. Top50 и ownRow вычислять на одном DB read snapshot; ownRow=null если побед нет. Использовать индексы под запросы; не выдавать весь список игроков.

Минимальная схема: `schema_migrations`; `players(id,telegram_id UNIQUE,display_name,last_active_at)`; `sessions(token_hash UNIQUE,player_id,expires_at)`; `runs(id,player_id,client_attempt_id,descriptor_json,status,expires_at,accepted_digest,receipt_json, UNIQUE(player_id,client_attempt_id))`; `submissions(run_id UNIQUE,metrics_json,actions_json,created_at)`; `campaign_bests(player_id,board_key,level_id,best_stars,run_id, PRIMARY KEY(...))`; `daily_bests(player_id,board_key,moves,run_id, PRIMARY KEY(...))`. Foreign keys включены, данные связывать через player/run IDs; SQL values только parameters. Агрегат кампании сначала считать из ≤12 best rows/account (новые уровни — новый проверенный content); отдельный изменяемый total не обязателен.

## Численные бюджеты и данные

| Граница | Значение v1 |
| --- | --- |
| JSON body auth / result | 16 KiB / 256 KiB (и по Content-Length, и по реально прочитанным bytes); initData ≤8 KiB |
| Actions | ≤2048 (как MAX_ATTEMPT_ACTIONS), только schema placeMagnet; descriptor ≤2 KiB |
| HTTP | headers16 KiB, body read5s, request10s, keepalive5s; reject unsupported encoding/content type |
| Auth budget | глобально30/min burst10 до expensive verify; после verify≤10 новых sessions/account/hour |
| Reads | глобально600/min burst100; authenticated account120/min burst30 |
| Runs / results | глобально120/min burst20; account run-register20/min burst5, result10/min burst3; ≤20 открытых runs/account |
| Limiter state | bounded LRU ≤10000 entries, idle TTL1h; overflow fail bounded, restart сбрасывает лимит, не данные |
| SQLite | WAL, foreign_keys ON, synchronous FULL, busy_timeout2000ms; SQLITE_BUSY после бюджета →503 |
| Run TTL | campaign48h; daily до конца следующегоUTC-дня; retry уже принятого receipt доступен90дней |
| Очистка | expired sessions ≤24h; unsubmitted expired runs через7дней; accepted journal30дней, receipt90дней; daily results90дней |
| Accounts / campaign | до удаления владельцем либо365дней без auth/accepted submission; удаление каскадом, ежедневная bounded cleanup |
| Логи | requestId/route/status/duration/error-code/queue metrics; не писать body/token/auth header/TelegramID/initData/journal; IP не сохранять в app logs |

Если измерение на ARM64 не укладывается в budget, записать фактическую выборку и настроить bound до выпуска; не убирать ограничения и не обещать capacity без нагрузочного evidence. Rate limits — стартовый ограниченный профиль, а не антибот-гарантия. DELETE /me удаляет live записи; зашифрованные backups истекают по retention ниже, это явно указать в UI/политике. Не менять local campaign/save при удалении server account.

## Backup, выпуск и rollback

Отдельный backup job/timer `magnet-sort-leaderboards-backup`, каждые5h с randomized delay≤5min, полный snapshot/upload budget≤55min; SQLite online backup API, затем integrity_check и schema check. Не `cp` живого файла WAL и не snapshot только основного db без WAL. Проверенный snapshot отправлять restic в **отдельный репозиторий** в отдельном подкаталоге существующего offsite storage; имеющийся White Tower restic repository/forget/prune не использовать. Новый backup password генерируется при provisioning, остаётся root-only в `/etc/magnet-sort/leaderboards-backup.env`; offsite access брать по существующему закрытому runbook, не через Git/чат. Новую платную услугу не заказывать.

Retention: локально последние8 snapshots; offsite daily7, weekly4, monthly3, tag `magnet-sort-leaderboards`. Применять forget/prune только к собственному repo; остальной backup timer не менять. Контроль свежести последнего успешного snapshot ≤6h, stale — операторская ошибка/сигнал в журнале и status tool, без сообщений людям/автоматизации чата. Перед first production write проверить restore в отдельный temp DB: integrity/schema, campaign best и session/run consistency. `RPO≤6h`, `RTO≤1h` — целевые показатели при исправном timer/upload, подтвердить backup/restore-длительностью; при пропущенном job RPO нарушен и должен быть явно отмечен. Пока offsite недоступен, production acceptance не пройдена.

Будущие команды (их реализует TASK-0076, сейчас этих scripts нет): `npm --prefix server ci`; `npm --prefix server test`; `npm --prefix server run migrate`; `npm --prefix server start`; `npm --prefix server run backup`; `npm --prefix server run restore:check`; `npm --prefix server run smoke`. Миграции versioned, fail closed на неизвестной schema, не выполнять destructive down migrations. Fresh DB и upgrade с предыдущей fixture проверяются отдельно.

Выпуск: immutable image с source SHA и pinned base digest → native ARM tests → отдельный Compose/DB/config/backup → staged auth/replay test с тестовыми keys на внутренней isolated network → миграция → own service readiness → backup/restore → сохранить актуальный remote Caddy и его hash → добавить один marker-блок без замены остального файла → native Caddy validate → reload **без recreate чужих containers** → HTTPS own path/CORS/401 и route regressions. При изменении исходного remote файла со времени snapshot остановить patch и перечитать, не затирать параллельную настройку.

При следующем обновлении собственного сервиса сначала включить только его maintenance, дождаться bounded drain workers и остановить его HTTP writer, сделать проверенный online snapshot, затем выполнять migration/start нового image. Старый writer, migration CLI и новый writer не должны одновременно изменять эту БД. Никакого recreate/stop соседних приложений. Restore всегда в отдельный путь, не поверх открытого DB handle.

До/после проверить: White Tower `/health`, `/test/health`, существующий CarWars health по его runbook, статику White Tower и Magnet Sort, текущий backup timer. Rollback только своего route marker и своего image/current; DB не откатывать с потерей новых accepted records. Если новая schema несовместима со старым image — оставить собственный API maintenance503, выполнить проверенный restore в новый путь лишь с явно указанным окном потери данных; не обещать автоматический rollback любого schema change. Frontend Pages deploy не заменяет публикацию backend.

## Проверки и степень подтверждения

Уже подтверждены чтение кода/документов, существующая инфраструктура по SSH, публичный ID существующего бота через Telegram Web DOM, Ed25519 signature реального запуска в памяти и официальные возможности библиотек. Docker Hub API подтвердил указанный multiarch image digest/arm64, npm registry — better-sqlite3 13.0.3 с engines Node>=22. Новый API, native ARM образ именно этого backend, новая SQLite/backup и нагрузка **ещё не проверялись**. TASK-0076 обязан проверить actual SQLite version, real file transactions/concurrent submits/restart, worker kill/queue/body/rate bounds, strict Ed25519 tampering/wrong-bot/expiry/duplicate tests, daily capability и реальные30 witnesses, auth/CORS/HTTPS, backup→restore, route isolation и browser integration двух режимов. Реальный Telegram/телефон — отдельный вид evidence; прежний phone review71 не подменять новым server тестом.

Проверенные официальные источники (2026-10-25): [Telegram Ed25519 и auth_date](https://core.telegram.org/bots/webapps#validating-data-for-third-party-use), [Node24.22.1 archive](https://nodejs.org/en/download/archive/v24.22.1), [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases), [SQLite WAL и WAL-reset fix](https://www.sqlite.org/wal.html), [Caddy handle_path](https://caddyserver.com/docs/caddyfile/directives/handle_path), [Caddy trusted proxies](https://caddyserver.com/docs/caddyfile/options#trusted_proxies). Перед реализацией сверить доступность pinned image/пакета и прочитать актуальную документацию; обновление версии само по себе не считается выполненной проверкой.
