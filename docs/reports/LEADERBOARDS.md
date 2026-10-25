# Сервер и два лидерборда — TASK-0076

2026-10-25. Реализация и проверки перед выпуском; production-публикация и проверка
первой собственной Telegram-записи отмечаются отдельно ниже. Используется существующий
`MagnetSortPuzzleBot`, публичный id8820798959, без токена бота и создания нового.

## Поведение

Из паузы и результата открывается Leaderboards с Campaign и Daily. Campaign
сравнивает подтверждённые уникальные уровни, затем сумму лучших звёзд; Daily —
число ходов на одной UTC-доске/версии. Ничьи делят место; Top50 и своё место
показываются вместе. Hint и Undo разрешены всем. Победа проверяется общим
deterministic kernel, это не доказательство человеческой игры или защиты от solver.

Чтение доступно web/embed; отправка — после добровольного Join из Telegram.
Auth bootstrap проверяет Ed25519 подпись свежего запуска на сервере. Bearer живёт
24h, в SQLite хранится hash, в клиенте — scoped sessionStorage; raw initData не
сохраняется. Участие можно приостановить; удаление онлайн-данных не удаляет local save.

При ошибке сети выигрышный accepted journal остаётся в ограниченном pending-хранилище
(одна победа на режим, две всего, максимум512KiB). Reload/Next/Retry не подменяют
его другой попыткой. Повтор сохраняет clientAttemptId/runId/digest и получает прежний
receipt. Точное raw-value сравнение останавливает запись stale-вкладки с понятным
конфликтом; это optimistic защита, не межпроцессная транзакция LocalStorage.

## Владельцы и файлы

- `server/leaderboards/`: strict JSON/UTF-8/Ed25519, hashed sessions, SQLite schema,
  короткие транзакции, оба профиля/UTC, Top50+ownRow, очистка, HTTP и 2 replay workers.
- `server/Dockerfile`, `server/deploy/`: pinned ARM image, отдельный Compose/data,
  HTTPS route через текущий Caddy, CAS/maintenance/rollback, отдельный restic repo
  и 5h backup/freshness jobs. Чужие API/DB/timers не меняются.
- `leaderboards-client.js`, `Leaderboards.js`, runtime/App/CSS: HTTP/controller,
  consent, pending/reload/conflict, две вкладки, focus/Escape/pause ownership.
- Platform adapter/bootstrap передаёт auth capability; Vite задаёт публичный endpoint
  `https://api.plusvibegames.com/magnet-sort/v1`. Секретов в frontend config нет.
- CI проверяет отдельный server package, real client/API contract, deploy regressions,
  frontend tests/build, platform/browser matrix. Build guard отвергает server/native
  database imports в клиентском graph.

## Проверки до выпуска

| Вид | Результат |
| --- | --- |
| `pnpm check:full` | 290/290 tests и production build PASS |
| `npm --prefix server test` |17/17 native Windows SQLite/workers/API tests PASS |
| ARM64 image | Node24.22.1, SQLite3.53.4;17/17 PASS при512MiB/1CPU/PID64/read-only/networknone/tmpfs64MiB, OOMfalse |
| Deploy tests |8/8 на Linux, включая настоящий shell EXIT после failed restic;7PASS/1Linux-onlyskip на Windows |
| `node tools/leaderboards-contract-check.mjs` | Real client → HTTP → SQLite/worker,2 isolated test-key identities, campaign ties/daily/ownRow/public reads/dedupe PASS |
| Browser | Web/Telegram mock: обе таблицы, согласие/отправка, saved winning journal503→reload owner-next→original retry, stale/error responses, own place57,20 modal cycles и portrait/landscape |
| Native Caddy | active/maintenance/remove config validate без reload PASS; CAS regression сохраняет чужую concurrent правку при ошибке reload |

Native QA source tree `a55afebaee67d1a9805898be851a38adbdf0d39a`; первый образ
обнаружил недостающий transitive import `src/art/urls.js`. Docker COPY исправлен
узко этим helper; renderer/ассеты в image не добавлялись. Повторный native прогон
полностью прошёл. Actual release image повторит native tests из проверенного коммита.

Независимый критик обнаружил и после исправления повторно проверил: stale-tab
перезапись pending-победы, rollback shared Caddy поверх concurrent change,
неограниченные local backup snapshots/partials при failed upload/kill. Backend
strict auth/DB/worker suite и client/API contract повторены отдельно от авторов.
Окончательный допуск и browser/regression evidence фиксируются при завершении.

## Публикация и границы

На момент подготовки этого отчёта новый API ещё не опубликован. Выпуск выполняется
из принятого коммита по [server runbook](../../server/deploy/README.md), затем проверяются
HTTPS/own offsite snapshot+restore/чужие routes, статический web+Telegram build и
реальная первая запись существующего игрового бота. Fixture identities остаются
только в isolated tests/staging; production не содержит демонстрационных игроков.

Реальный Telegram Web, native Telegram и физический телефон — разные виды evidence.
Физический телефон этой средой не проверяется. Технический frozen daily контракт
принят по f799c84; отдельный device review TASK-0071 не закрывается этой задачей.

Логи и снимки находятся локально в ignored `artifacts/leaderboards-implementation/`,
`artifacts/leaderboards/`, `.telegram-check-logs/`; initData/bearer/backup credentials
в отчёт не включаются. [Нормативный контракт](../design/LEADERBOARDS_SERVER.md).
