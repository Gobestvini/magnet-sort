# Сервер и два лидерборда — TASK-0076

2026-10-25. Сервер и обе клиентские вкладки опубликованы из
`11669478b01d943099d513506c9c0d056cc43319`; результаты реальной проверки ниже. TASK-0076 done, независимая финальная приёмка PASS.
Последующий documentation-only commit обновляет отчёт/очередь; runtime server и
PlusVibe web/Telegram остаются на проверенном11669478, Pages пересобирает тот же код. Используется существующий
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
| `pnpm check:full` | 315/315 tests и production build PASS |
| `npm --prefix server test` |17/17 native Windows SQLite/workers/API tests PASS |
| ARM64 image | Node24.22.1, SQLite3.53.4;17/17 PASS при512MiB/1CPU/PID64/read-only/networknone/tmpfs64MiB, OOMfalse |
| Deploy tests |11/11 на Linux, включая настоящий shell EXIT после failed restic и relative/absolute SFTP isolation;10PASS/1Linux-onlyskip на Windows |
| `node tools/leaderboards-contract-check.mjs` | Real client → HTTP → SQLite/worker,2 isolated test-key identities, campaign ties/daily/ownRow/public reads/dedupe PASS |
| Browser | Web/Telegram mock: обе таблицы, согласие/отправка, saved winning journal503→reload owner-next→original retry, stale/error responses, own place57,20 modal cycles и portrait/landscape |
| Native Caddy | active/maintenance/remove config validate без reload PASS; CAS regression сохраняет чужую concurrent правку при ошибке reload |

Native QA source tree `a55afebaee67d1a9805898be851a38adbdf0d39a`; первый образ
обнаружил недостающий transitive import `src/art/urls.js`. Docker COPY исправлен
узко этим helper; renderer/ассеты в image не добавлялись. Повторный native прогон
полностью прошёл. Release image11669478 повторил17/17 native tests из проверенного коммита.

Независимый критик обнаружил и после исправления повторно проверил: stale-tab
перезапись pending-победы, rollback shared Caddy поверх concurrent change,
неограниченные local backup snapshots/partials при failed upload/kill. Backend
strict auth/DB/worker suite и client/API contract повторены отдельно от авторов.
Объединённый код и операционный выпуск приняты независимым критиком.
315 tests/build,46 профильных client/challenge tests и browser/regression evidence PASS.

Объединённый итог с friend challenges из `fcd0978` повторно прошёл315 tests/build,
all-platform matrix, loading/tutorial/Pages и отдельные leaderboard/challenge/daily/Undo/Hint
browser сценарии. Challenge preview/победа не регистрируются как campaign/daily.
Provisioning учитывает проверенный legacy SFTP relative path и создаёт отдельный
sibling repository; URI/traversal/reuse отвергаются.

## Публикация и границы

- API: `https://api.plusvibegames.com/magnet-sort/v1`; readiness/capabilities и обе таблицы200 с обязательным daily date; invalid-auth401, foreign-origin403 и CORS preflight204. Catalogue/preset/content совпадают с frozen71.
- Runtime: ARM64 Node24.22.1/SQLite3.53.4, source image label11669478;512MiB/1CPU/PID64/read-only/OOMfalse/healthy. Production не содержит test keys/fixture players.
- Собственный offsite backup+retention занял44с; скачивание и проверка отдельной временной БД7с. First-install upload2026-10-25T11:58:38Z; freshness7с. Это измерения first install, не гарантия будущих сетевых условий. Target RPO≤6h/RTO≤1h; timers5h и hourly freshness активны.
- После обоих real wins повторены online snapshot/upload и separate offsite restore:47с/6с, schema1/SQLite3.53.4,1player/2acceptedRuns в исходном и восстановленном snapshot. Last success2026-10-25T12:10:36Z, freshness6с; свои timers и White Tower backup active. Имена/IDs/журналы не выводились.
- Caddy после reload точно равен scoped patch текущего snapshot; device/inode прежние. White Tower production/test, CarWars и обе static игры200; чужой backup timer active/waiting, enablement сохранён.
- Web и Telegram на PlusVibe и Pages workflow [40190803986](https://github.com/Gobestvini/magnet-sort/actions/runs/40190803986) опубликованы с11669478. Public desktop/mobile7-move victory, all-platform SDK/cache/pause checks PASS.
- Real Telegram Web: existing-bot launch → серверная auth → добровольный Join → зарегистрированная campaign attempt →6-move win → canonical receipt «Result submitted» и ownRow:1level/2stars. Hint разрешён, это не unassisted результат. Raw initData/bearer и private Telegram ID не сохранены.
- Real Telegram Web Daily2026-10-25:14-move win после двух Undo → «Result submitted» и собственная строка14moves. Campaign↔Daily переключение сохраняет обе реальные строки. Помощь допустима серверными правилами; физическое устройство этим не подтверждено.
- Отдельный rollback runbook, compatibility/maintenance/Caddy CAS сценарии проверены кодом и fixtures. При first install предыдущей production backend-версии нет; фактический переход к предыдущему образу не выполнялся.

Реальный Telegram Web, native Telegram и физический телефон — разные виды evidence.
Физический телефон этой средой не проверяется. Технический frozen daily контракт
принят по f799c84; TASK-0071 уже done по отдельной пользовательской приёмке.

Логи и снимки находятся локально в ignored `artifacts/leaderboards-implementation/`,
`artifacts/leaderboards/`, `.telegram-check-logs/`; initData/bearer/backup credentials
в отчёт не включаются. [Нормативный контракт](../design/LEADERBOARDS_SERVER.md).
