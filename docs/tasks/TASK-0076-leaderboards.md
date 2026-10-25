# TASK-0076: Лидерборды кампании и доски дня

- Статус: done
- Приоритет: normal
- Создана: 2026-10-25
- Обновлена: 2026-10-25
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: gpt-6.1-sol; высокий уровень рассуждения — серверная идентичность, детерминированная проверка результатов, транзакции и интеграция двух режимов.
- Зависимости: TASK-0066/0068/0070 done; технический контракт TASK-0071 принят по опубликованному f799c84 (оставшийся review реального Telegram/телефона не блокирует реализацию). API/БД — результат этой задачи, не её предусловие. TASK-0072 не требуется.
- Заменяет: отменённую TASK-0073 по прямому запросу пользователя; номер 0073 сохраняется в истории.

## 1. Цель и запрос пользователя

Пользователь 2026-10-25 попросил закрыть TASK-0073 и сделать вместо неё задачу на лидерборд. На уточнение выбрал: «Оба рейтинга: кампания и доска дня».

Сейчас результаты v4 хранятся локально; настоящего межпользовательского рейтинга нет. После реализации игрок открывает один экран Leaderboards с вкладками Campaign и Daily, видит реальные результаты других участников, своё место и правила подсчёта. Кампания и доска дня продолжаются независимо от доступности сервиса. Первый срез — Telegram-участники с серверно подтверждённой идентичностью; web/embed показывают понятное ограничение участия. Вход в Telegram из браузерного fallback — только по добровольной кнопке.

Пользователь дополнительно попросил проработать сервер, чтобы можно было запускать задачу, и проверить существующего игрового бота. Серверный контракт теперь зафиксирован в [LEADERBOARDS_SERVER](../design/LEADERBOARDS_SERVER.md), публичный ID существующего MagnetSortPuzzleBot подтверждён. Метрики/помощь — выбранные проектные решения v1, а не дополнительные слова пользователя. Подготовка этого файла не запускает реализацию: сервер, клиент и публикация обоих рейтингов входят в одну ready-задачу.

## 2. Проверенный контекст

Актуализация2026-10-25, HEAD `f799c844b079c2b00217b34971328d8143be3616`. `package.json`: Three.js0.186.1, Preact11, Vite7.1.9; active seeded rules v4. TASK-0071 уже опубликована: техническая/независимая приёмка,268 tests и30 winning witnesses; её review касается отдельно реального Telegram/телефона. Перед реализацией сверить новый HEAD и прочитать отчёт71, не переносить dirty-файлы других чатов.

| Файл / символ | Проверенный факт и назначение |
| --- | --- |
| `src/prototype/progress-v4.js::createAttempt/replayAttempt/withAttempt` | Журнал levelId/seed/actions/assisted; completedByLevel хранит только bestStars. Старые local records не являются доказательством рейтинга. |
| `src/prototype/session.js::createV4Session` | Владелец committed state и accepted journal; Hint помечает assisted, Undo воспроизводит префикс. Публиковать snapshot владельца, не DOM. |
| `src/prototype/model-v4.js::createV4State/applyV4Magnet/earnedStars`, `levels-v4.js::v4Levels` | Детерминированный replay без браузера,12 уровней кампании со случайными seeds; moves разных полей не сравниваются. |
| `src/prototype/daily-catalog-v1.js` | Frozen catalog `daily-30-2026-10-25.1`, preset `short-b-2026-10-25.1`, content `sub-ten-2026-10-20.1`, literal DAILY_GOALS/DAILY_SPAWN_INTERVALS;30 досок. JSON catalog SHA256 `3e02ff4c6b5b8a5cc3325681215928a02462074a89aaf60f19511b94bebdf06c`. |
| `src/prototype/daily-rules.js::DAILY_RULES`; `daily-v4.js::getDaily/replayDailyAttempt/createV4ModeSession` | Чистые B rules отделены от mode session; UTC descriptor и отдельное local daily сохранение уже существуют. Backend импортирует pure catalog/rules, не браузерного владельца сессии. |
| `tools/fixtures/daily-v4-witnesses.json`, `tools/generate-daily-catalog.mjs`, `tests/daily-catalog.test.js`, `tests/daily-v4.test.js` |30 winning replays, drift/hash/UTC/version и campaign isolation. Все свидетели повторить на сервере. |
| `src/prototype/runtime.js::ui/dispose`, `App.js::PrototypeApp` | UI/lifecycle entry из паузы/результата. |
| `src/platforms/telegram/adapter.js::createTelegramPlatform`, `bootstrap.js::startGame` | Пока initData лишь opaque launch gate; SDK принадлежит адаптеру. Добавить явную auth capability без Telegram globals в общей игре; сохранить web/embed fallback. |
| `deploy/README.md`, `.github/workflows/deploy-pages.yml` | Сейчас публикуется статика. API/БД Magnet Sort ещё не созданы, frontend Pages сам backend не выпускает. |
| `docs/design/LEADERBOARDS_SERVER.md` | Нормативный готовый контракт: Node/SQLite/Compose, auth/API/schema/лимиты/retention/backup/rollout. Не выбирать другой backend заново. |

Read-only VPS аудит25.10.2026 подтвердил ARM64/4CPU/7729MiB RAM, около6954MiB available и62GiB свободного диска, Docker29.9.1/Compose5.6.0/Caddy2.11.7, действующую сеть tower-edge и рабочие White Tower/CarWars. Это snapshot, не гарантия нагрузки; их API/БД/backup сохранять. Публичный ID существующего `@MagnetSortPuzzleBot` — **8820798959**, подтверждён в авторизованном Telegram WebK DOM. Дополнительно реальный Play launch проверен Ed25519 production key в памяти: signatureValid=true, freshAuthDate=true. Raw initData/профиль не сохранялись/не выводились, токен бота не использовался, сообщения не отправлялись. Новый HTTP auth ещё предстоит реализовать.

Официальная [Ed25519-проверка Mini App данных](https://core.telegram.org/bots/webapps#validating-data-for-third-party-use) проверена25.10.2026; raw initData доверен только после серверной проверки. Реальная подпись нового backend ещё не проверена. Не нужен новый бот или bot token.

## 3. Область изменений

Один результат: настоящий межпользовательский рейтинг с двумя вкладками, серверной валидацией и восстановлением данных. Входит self-contained backend `server/package.json`/`server/package-lock.json`, ESM `server/leaderboards/`, server tests, `server/Dockerfile`, `server/deploy/`, `server/README.md`; клиент `src/prototype/leaderboards-client.js`, экран `src/prototype/Leaderboards.js`, `tests/leaderboards-client.test.js`, `tools/leaderboards-browser-check.cjs`, `docs/reports/LEADERBOARDS.md`. Узко расширить session/runtime/App/prototype.css/platform/bootstrap, target endpoint config и CI для server package. Native server dependencies не добавлять во frontend import graph.

Использовать выбранные в LEADERBOARDS_SERVER Node24.22.1-bookworm-slim (при реализации pin реальный manifest digest), better-sqlite3 13.0.3/SQLite3.53.4; один DB owner и bounded replay workers. Production daily включается в рамках этой же задачи через pure frozen catalog/rules71 и30 серверно перепроверенных witnesses. Никакой дополнительной backend-задачи или ожидания нового каталога не требуется.

Сохранить A/B, save/recovery/conflict, accepted journal, Hint/Undo, audio/settings, reduced motion и user/platform/hidden pause. Для UI/lifecycle прочитать GDD_V0.4.md/THREE_RENDERING.md и разделы «Ввод и hit testing», «Lifecycle и качество» в docs/knowledge/pixijs-practices.md; старый PIXI_RENDERING.md не является активным Three.js контрактом. Применить game-quality/ai-economy/browser-game-tools по правилам проекта.

Не входят: цветовые заказы, friend challenge, платежи/призы, рейтинги друзей/стран/кланов, сезоны с наградами, рассылки, создание другого Telegram-бота, отдельная web-регистрация, импорт аккаунтов/БД соседней игры, редизайн поля или cloud save всей кампании.

## 4. Требуемое поведение

### 4.1. Два сравнения и честная помощь

Помощь Hint/Undo разрешена всем участникам обоих рейтингов, это видно в UI. Assisted можно хранить для справки; клиентский boolean не доказывает unassisted. Replay подтверждает допустимую победу, а не человеческий способ игры/отсутствие внешнего solver.

Campaign: для подтверждённого account и boardKey rules/content/preset хранить лучший серверно проверенный результат каждого уникального уровня. Больше завершённых уровней, затем больше сумма bestStars; слабая победа не уменьшает best, Retry не создаёт новый completed level. Ходы/время разных seeds не сравниваются; это рейтинг прогресса, а не одинаковой сложности полей. Ничьи competition ranking1,1,3, порядок строк стабилен по opaque playerId. Старый local progress сохраняется, но без полного replay не импортируется как verified record; старый уровень можно переиграть.

Daily: boardKey rules/date/catalog/content/preset, сервер разрешает точные levelId/seed из каталога71. Только terminal won; меньше moves — выше место, одинаковое число ходов делит место. Один best/account/day/version, tie сохраняет раннюю запись. Дата авторитетна на сервере при регистрации; вчерашнюю offline-попытку без зарегистрированного вчера run не регистрировать задним числом. Вчерашний registered run принимается до конца следующего UTC-дня. Полночь не меняет активное поле; mismatch — понятная ошибка, не молчаливая подмена seed. CampaignA и dailyB/версии никогда не смешиваются.

### 4.2. Сервер, identity и запись

Нормативный протокол/schema/error/retention — LEADERBOARDS_SERVER. HTTPS base `https://api.plusvibegames.com/magnet-sort/v1`; auth, run registration/result, reads Top50+ownRow, capabilities/health, account deletion. Реализовать фиксированные Ed25519 production public key и `MAGNET_SORT_BOT_ID=8820798959` существующего MagnetSortPuzzleBot; age300с/skew30с, duplicate/encoding/wrong-bot/malformed/signature rejection. Никакого нового бота или bot token. Test keys внедряются только в isolated tests/staging, не production env/API.

Auth bootstrap при свежем Telegram launch в пределах5мин не публикует результат автоматически. Opaque bearer32 random bytes/24h без sliding expiry; в DB только hash, клиент scoped sessionStorage для reload своей вкладки; raw initData не сохраняется. Offline expired launch предлагает добровольное переоткрытие Mini App, сохраняя игру. Участие/публикация добровольные, регистрация требует publishConsent:true.

POST /runs идемпотентен по owner+стабильному clientAttemptId, bound к immutable descriptor; повтор другого descriptor — conflict. result принимает accepted journal, перепроверяет каждый action общими rules, требует won и сам считает moves/stars/cleared. Присланные totals не доказательство. Один DB owner/короткие транзакции/unique constraints: тот же runId+digest возвращает прежний receipt, конфликтующий digest не перезаписывает принятый результат; concurrent submits/restart не дублируют best. Body256KiB/actions2048, auth body16KiB/initData8KiB;2 workers, queue16, active250мс/full operation5с. Остальные точные budgets/expiry/cleanup/ошибки — контракт, не отключать их ради теста.

Public ID opaque, имя plain text с ограничениями; не выдавать private Telegram IDs, initData/bearer/replay в публичных строках/URL/логах. Account deletion удаляет live server records/session по контракту, local save не трогает; backup retention объясняется отдельно. Production не содержит fixture-игроков или test key fallback.

### 4.3. Экран, сеть и сохранность партии

Один Leaderboards экран из pause/result: Campaign/Daily, Top50 и выделенное ownRow даже вне Top50, метрика/правила/дата daily. Нет своей победы → понятный статус. Empty/loading/ready/error/offline/auth-expired/version-mismatch различаются; Retry ограничен, устаревшие ответы другого дня/вкладки не подменяют текущие данные. Web/embed без auth capability не публикуют выдуманного участника; читают public API и объясняют добровольный вход в Telegram.

Стабильный clientAttemptId/runId сохраняется отдельно от игрового журнала; новый Retry игры — новая attempt, сетевой Retry — прежняя. Публикация snapshot не блокирует result/Next/Retry/ход. Сетевой отказ показывает «результат не отправлен», успех только после canonical acknowledgement; нет бесконечных retries/неограниченной offline-очереди. Reload/две вкладки/обрыв после commit сохраняют idempotency и игру.

Открытый рейтинг блокирует поле и пользуется текущим pause owner; закрытие сохраняет user/platform/hidden pause, state/selection/history/audio. Fetch отменяется при смене вида/dispose, поздний ответ не монтирует удалённый UI. Portrait/landscape/keyboard focus/Escape/touch/safe areas сохраняются. Совпадение серверного daily descriptor с local71 проверяется до регистрации; серверное время не переписывает начатую local attempt.

### 4.4. Свой deploy и backup

Отдельные Compose project/alias magnet-sort-leaderboards на tower-edge, native ARM image, своя `/srv/magnet-sort/leaderboards/{releases,data,backups}` и config `/etc/magnet-sort/leaderboards.env`, без host-порта и чужой DB. Только свой API marker в фактически смонтированном Caddy API-блоке перед White Tower fallback: strips /magnet-sort, оставляет /v1. Snapshot/hash remote config → scoped patch → validate → reload без recreate чужих сервисов; статический домен не менять.

Свой online SQLite backup/проверка/restore, отдельный restic repository в подкаталоге уже существующего offsite storage, собственный timer/retention по контракту (каждые5h, delay≤5min, snapshot/upload≤55min для целевого RPO≤6h); не пользоваться White Tower forget/prune и не менять его timer. Snapshot до first production write и restore в отдельный путь обязательны. Runbook/rollback должны сохранять accepted records и учитывать совместимость schema/image. Pin image digest и actual SQLite version подтвердить на ARM; Pages frontend не заменяет deploy API.

## 5. План для исполнителя

1. Прочитать AGENTS.md, LEADERBOARDS_SERVER и принятый технический результат71/f799c84; сверить HEAD, pure imports/catalog/witnesses и доступ к текущему VPS/боту. Backend отсутствует: его создать в этой задаче, не трактовать отсутствие API как dependency blocker.
2. Создать отдельный locked server package, strict auth/schema/migrations/repository, bounded shared-kernel workers и API. Подключить оба production rules profiles, real frozen daily catalog и30 witnesses. Прогнать native DB/worker/ARM security/concurrency/expiry/backup tests.
3. Реализовать platform capability/auth bootstrap/client, stable ranked attempt identity и snapshots; добавить две вкладки/сетевые состояния с сохранением local campaign/daily.
4. Подготовить собственные container/backup/route/rollout/rollback, пройти isolated staged auth/replay с test keys и реальные браузерные регрессии. Fixtures не добавлять публичным участникам.
5. Передать итог независимому критику, исправить замечания; выполнить свои commit/push/backend+frontend deploy и public checks по AGENTS.md, обновить PROJECT/INDEX/LEADERBOARDS.md. Изменение shared Caddy при параллельной правке требует перечитать snapshot, а не затирать его.

## 6. Критерии готовности

- [x] Один полный срез: actual ARM backend обоих профилей, реальная SQLite, strict existing-bot auth, HTTP contract и две UI вкладки.30 daily witnesses совпадают с frozen71.
- [x] Две контролируемые identities в isolated staging видят общие Campaign/Daily строки/ownRow; best/ties/unique count/stars/moves/UTC/version/идемпотентность/конкурентность/restart соответствуют контракту.
- [x] Forged/expired/wrong-bot auth, malformed/duplicate/oversized input, чужой run, неверный replay/descriptor/version и ход после terminal отклонены без записи; budgets/worker timeout/queue проверены без блокировки HTTP owner.
- [x] Save/Hint/Undo/campaign↔daily/reload/two-tabs/offline/error/expiry/stale response/keyboard/touch/landscape/dispose сохраняют игру и честный статус отправки.
- [x] Production не содержит test keys/фиктивных участников/секретов; account deletion/retention корректны, UI не обещает bot-proof/unassisted.
- [x] Свои HTTPS/Compose/DB/backup timer/offsite snapshot/restore подтверждены, чужие endpoints/DB/backup не затронуты. Rollback runbook/code/fixtures приняты; у first install нет previous production backend для реального переключения назад.
- [x] Независимый критик принял итог; команды/evidence/ограничения в LEADERBOARDS.md, свои commit/push/deploy и опубликованный frontend+API проверены; real Telegram/телефон отмечены отдельно.

## 7. Проверки

### Автоматические

Из корня игры существующие команды: `node --test tests/progress-v4.test.js tests/v4-undo.test.js tests/hint-v4.test.js tests/daily-v4.test.js tests/daily-catalog.test.js`; `node tools/generate-daily-catalog.mjs --check`; финальные `pnpm check:full`, `pnpm build:platforms`, `pnpm test:platforms`. Full build очищает dist, platform builds выполнять после него.

Новые команды этой задачи (пока не существуют): `node --test tests/leaderboards-client.test.js`, `node tools/leaderboards-browser-check.cjs`; отдельный server package реализует scripts `npm --prefix server ci`, `npm --prefix server test`, `npm --prefix server run migrate`, `npm --prefix server start`, `npm --prefix server run backup`, `npm --prefix server run restore:check`, `npm --prefix server run smoke`. Их safe config/arguments зафиксировать в server/README; production migrations не запускать как побочный эффект тестов.

Server suite: strict Ed25519 с generated test keys/clock, bearer hash/expiry, auth/body/rate/worker bounds, actual SQLite transactions/parallel commits/restart, all30 daily replays/catalog drift/UTC and version, deletion/cleanup/online WAL backup→restore. Обязательно повторить в actual ARM image с pinned runtime/addon/SQLite. Caddy fixture: prefix stripping/no-store/CORS/errors и чужие routes/upstream outage. Client: delayed/aborted/out-of-order fake service, lost response after commit, idempotency persistence, auth expiry и campaign/daily isolation. Не выдавать mocks за native DB/реальную Telegram identity.

### Ручные и операционные

Web + Telegram mock: обе вкладки, empty/Top50/ownRow/ties, victory→submit→reload, assistance, Retry, offline→Retry, expired auth/version/midnight.390×844 и844×390, focus/Escape/touch/safe areas и20 open/close/dispose cycles без роста listeners/requests; точный state/journal/selection/audio до/после.

Isolated staging с двумя test-key identities: ranking improvements/ties/concurrent submits, restart и restore; production не содержит этих fixtures. Production: own HTTPS health/capabilities/auth rejection/both rankings, native constraints/own persistence/backup timer/snapshot/restore, route regressions White Tower production/test/CarWars и статических игр до/после. Реальная проверка подписи/первой собственной записи — на существующем MagnetSortPuzzleBot, без создания нового бота; raw initData и bearer не выводить. Реальные Telegram/native app/физический телефон — отдельный evidence; не привлекать и не писать людям. Если обязательная real end-to-end identity проверка недоступна, зафиксировать review этой проверки, не называть staging участниками production.

## 8. Предположения, вопросы и условия остановки

Существенные архитектурные неизвестные сняты: серверный контракт, собственные VPS/сеть/HTTPS пути, стек/БД, лимиты/backup и ID существующего бота конкретны. Production API/БД и клиентские рейтинги — результат реализации76, а не требуемый заранее сервис. TASK-0071 технически принята по f799c84, её device review не препятствует backend/import каталога. Отдельная серверная задача не нужна.

Ready разрешает начать код, но не объявляет deployed/auth/native/backup checks выполненными. Перед внешним deploy повторить read-only access/resources/remote config preflight; native image digest и секрет нового backup repository создаются/фиксируются при реализации по контракту. Не нужен новый Telegram-бот или bot token. Auth использует строго8820798959; смена/несовпадение бота — отказ, не подбор другого ID.

При изменении правил/каталога/API сначала актуализировать версии/fixtures/контракт, не подменять игроку начатое поле. Отсутствующий фактический доступ к VPS/offsite или несовместимая параллельная Caddy правка блокирует соответствующий deploy: сохранить свой коммит/отчёт, не вмешиваться в чужие игры. Непройденные обязательные ARM/restore/production identity проверки не заменять unit/mocks; указать конкретный review/blocker. Чужие dirty файлы не трогать, общие runtime/App править последовательно.

## 9. Сообщение для передачи модели

```text
Выполни ready docs/tasks/TASK-0076-leaderboards.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md, задание и docs/design/LEADERBOARDS_SERVER.md целиком; проверь HEAD и принятый технический daily контракт f799c84. Создай self-contained сервер/API/DB/backup и UI обоих рейтингов в рамках этой одной задачи. Backend пока отсутствует и является результатом работы, дополнительную задачу для него не создавай. Используй существующего MagnetSortPuzzleBot id8820798959 с Ed25519 без bot token/нового бота, frozen71 catalog/rules и native ARM stack по контракту. Сохрани local campaign/daily/Hint/Undo/settings, пройди проверки и независимого критика. Заполни раздел10/LEADERBOARDS.md/INDEX/PROJECT, заверши своими commit/push/backend+frontend deploy по AGENTS.md. Чужие dirty файлы/API/БД/backup не трогай, сообщения людям/новые чаты не создавай. Непройденное evidence отметь явно, без ложного done.
```

## 10. Отчёт исполнителя

- Результат: код сервера, SQLite/worker/API/auth, обоих рейтингов и клиента реализован и опубликован из11669478. Own HTTPS/native/offsite/restore и реальные campaign/daily-записи подтверждены; подробный статус — [LEADERBOARDS](../reports/LEADERBOARDS.md).
- Изменённые файлы и зачем: server package/leaderboards/tests/deploy/Dockerfile; client/Leaderboards/runtime/App/CSS/platform capability; CI/Vite/build guard; client/API/browser/deploy checks и документация. Gameplay rules и frozen daily catalog сохранены.
- Команды и фактические результаты: pnpm check:full315/315+build; server17/17 Windows и17/17 native ARM Node24.22.1/SQLite3.53.4 под512MiB/1CPU/PID64; native deploy Python8/8; расширенный Python11/11 native Linux и10PASS/1Linux-onlyskip локально; real client→HTTP→SQLite/worker contract; all-platform builds/SDK-resource-cache checks; daily30 witnesses, leaderboards/daily/Undo/Hint/loading/tutorial/Pages browser tools PASS. Полные логи ignored artifacts/leaderboards-implementation.
- Ручные проверки: production web/Telegram mock screenshots portrait/landscape просмотрены; sticky Close сохраняется при scroll, 20 циклов modal не накапливают fetch. Это browser surrogate, не физический телефон. Реальный существующий бот прошёл auth/Join/registration, campaign6moves и Daily14moves → canonical receipts/ownRows. Public PlusVibe/Pages desktop/mobile и platform checks PASS.
- Выполненные критерии: функциональный код, негативные сценарии, client recovery/two tabs, native DB/ARM/resource limits, isolated identities, визуальный/browser этап. Независимый критик принял объединённый source и operational evidence выпуска. Actual own offsite backup44с/restore7с, native image/resources/schema/SQLite, own timers и чужие routes/backup подтверждены.
- Непроверенное, блокеры и отклонения от плана: физический телефон и native Telegram не проверены; реальные HTTP first record/production API проверены в Telegram Web. Actual previous-image rollback при first install не выполнялся; код, fixtures и runbook приняты. Первый native image выявил missing transitive art/urls helper — узкий COPY исправлен, второй native прогон PASS. Разделение на другую задачу не потребовалось.
- Итоговый статус и дата: done, 2026-10-25. Runtime11669478 опубликован на API/PlusVibe/Pages; обе реальные Telegram Web победы приняты. Nonempty offsite backup47с/restore6с подтвердил1player/2acceptedRuns. Финальная документация публикуется отдельным commit с тем же runtime-кодом.

## Рекомендация модели исполнителя

Предпочтительно **gpt-6.1-sol**, уровень рассуждения **high**: задача объединяет серверную авторизацию, детерминированную валидацию и конкурентные записи с UI двух режимов. Это качественный выбор с запасом по сложности из доступного списка моделей; точные цены и преимущество по тарифу не проверялись. Для отдельного сложного аудита trust boundaries допустима gpt-6-astra, но повышение модели не заменяет независимого критика и реальные интеграционные проверки.
