# Аналитика, задания, коллекция и монетизация v1

2026-10-25. Запрос владельца: аналитика → задания/коллекция → реклама/покупки
на доступных площадках. Изолированный worktree совмещён с опубликованным
friend-challenge и leaderboards1166947; чужие незакоммиченные изменения не включаются.

## Наблюдаемое поведение

- В паузе и результате появились Quests & collection и Privacy & analytics.
  First-party аналитика работает только после явного согласия. До него нет
  аналитических ID/запросов. Отказ очищает очередь и запрашивает серверное удаление.
  Во вкладках отдельные immutable pending records, ACK удаляет только доставленные ID.
- События описывают готовность, попытку/возобновление, первый/принятый ход,
  результат, Undo/Hint, режимы, награды, рекламу и покупки. В payload нет
  Telegram-профиля, raw launch data, полного URL или платёжных сумм.
  Production и QA разделены. Итог попытки учитывает последний исход после Undo;
  retention показывает зрелые UTC-когорты с знаменателями. Это opted-in устройства,
  не все люди, увидевшие страницу.
- Три задания UTC-недели: победить на трёх разных campaign levels, собрать100
  campaign chips, завершить текущую Daily. Доска учитывается раз за неделю;
  повторный проигрыш добавляет только улучшение bestCleared. Восстановление
  старого результата и откат часов не заменяют новое прохождение.
- Шесть эмблем открываются на1/2/3/6/9/12 уникальных победах кампании. За каждое
  задание можно забрать один stamp;3/6 stamps открывают Golden/Star frame.
  Эмблема/рамка видна у логотипа, не меняет игровые цвета или правила.
  Это локальная косметика, не платная валюта. Hint/Undo остаются бесплатными.
- Rewarded выдаёт1bonus stamp за завершённую доску один раз за неделю.
  Кнопка существует только при capability провайдера и ещё доступной награде.
  Закрытие/ошибка/таймаут не выдают stamp. Межуровневая реклама вызывается
  в естественном переходе после первого урока, со своим pause owner и single-flight.
- Telegram shop: Aurora Supporter за50XTR — бессрочное косметическое оформление
  без игрового преимущества. Цена берётся с сервера, право восстанавливается
  при следующем запуске того же account. Сетевой сбой не снимает уже подтверждённое
  право текущего сеанса; подтверждённый пустой ledger после refund снимает его.
- Friend challenge сохраняет launch/share/return и изоляцию сохранений.
  Он не начисляет campaign/Daily награды. Preview не считается началом попытки.

## Сервер и хранение

Отдельный Node24/node:sqlite service:
https://api.plusvibegames.com/magnet-sort-growth/v1 .
Свой префикс, контейнер и две БД; будущий leaderboards API /magnet-sort/v1 не занят.
Dockerfile/Compose/backup этой службы находятся в server/growth/;
существующие server/Dockerfile и server/deploy/ лидербордов сохранены отдельно.

| Ресурс относительно base | Назначение |
| --- | --- |
| /health | Готовность сервиса/конфигурации покупок без секретов |
| /analytics/events, /analytics/visitor | Allowlisted приём и удаление с отдельным deletion token |
| /admin, /admin/analytics | Панель агрегатов; данные требуют Bearer admin key, он не хранится браузером |
| /commerce/auth, /commerce/catalog, /commerce/invoice, /commerce/entitlements | Telegram HMAC-auth, фиксированный каталог, invoice, серверные права |
| /telegram/webhook | Secret header Telegram: pre-checkout/success/refund/paysupport |
| /admin/refund, /admin/reconciliation, /admin/reconcile | Только оператор: возврат и разбор receipts |

Секреты только в /etc/magnet-sort/growth.env,0600. Токен существующего игрового
бота получен от владельца для этой настройки и не записывается в Git/клиент/отчёт.
Origin allowlist ограничен production domains; публичные events/catalog не
расходуют budget защищённого webhook/checkout. Аналитика не доказывает оплату.

Ledger хранит каждый реальный charge, pre-checkout reservation, idempotency,
refund tombstones, quarantine/audit и повторную reconciliation. Второй charge
не теряется; неудачный автоматический возврат остаётся в очереди. Неупорядоченная
доставка не выдаёт право повторно. /paysupport отвечает на входящую команду;
маркетинговые сообщения не создаются.

Backup: online SQLite backup + quick_check, затем существующий encrypted offsite
destination с собственным tag. Только после успешной выгрузки prune удаляет
verified-папки именно этой игры: максимум8снимков, ориентир2GiB/2дня,
минимум2recoverypoints. Чужие/непроверенные каталоги не удаляются.
Отказ offsite и превышение лимита дают service failure для оператора.
Offsite retention применяется только к tag magnet-sort-growth, group-by host,tags;
освобождение remote blocks требует принятого обслуживания restic prune/check.

## Площадки и фактические границы

| Канал | Реализовано | Условие живой монетизации |
| --- | --- | --- |
| Собственный web | AdSense H5, verified rewarded callbacks | Одобренный H5 account и publisher ID |
| Telegram | Stars и отдельные AdsGram rewarded/interstitial | Сервер/бот/webhook для Stars; отдельно approved AdsGram blocks |
| CrazyGames | SDKv3, callbacks, Basic ads-off | Full Launch; Basic не приносит рекламный доход |
| Poki | Init/readiness/gameplay/ads | Отбор и договор; IAP не поддерживаются |
| Яндекс | YaGames init/loading/gameplay/ads | Доступный договор/модерация; IAP этого target пока не подключены |
| Playgama | Bridgev2/config/lifecycle/ads | Партнёрский допуск; IAP этого target пока не подключены |
| GameDistribution | GD_OPTIONS/gameId/events/ads | Game ID и одобрение |
| GamePix | SDKv3/manual lifecycle/pause/ads | Партнёрский допуск |
| Embed/лицензии/itch | Чистая ads-off сборка | Отдельная подача/лицензия/поддержка |

build:platforms строит9профилей с изоляцией; package:portals упаковывает6портальных
ZIP с manifest/SHA256. Это готовность к sandbox/review, не автоматически полученное
одобрение кабинетов или доход. Facebook/VK/Y8 и магазины из широкого реестра
остаются следующими самостоятельными integrations/approvals.

Публичные SDK IDs/флаги задаются VITE-переменными из .env.growth.example.
Server token никогда не является VITE-переменной. Без ID/флага либо при отказе SDK
обычная игра остаётся доступна, неработающие rewarded-кнопки не показываются.
Общий deadline init предотвращает бесконечный loader; поздний SDK не активирует ads.
Ранний SDK Promise не является подтверждением просмотра: CrazyGamesv3 сообщает
результат через callbacks; AdSense H5 требует adViewed, не только adBreakDone.

## Проверки

Модульные результаты и SDK источники:
[аналитика](GROWTH_ANALYTICS.md), [meta](GROWTH_META.md),
[commerce](GROWTH_COMMERCE.md). Дополнительные HTTP/deploy/controller regression
покрывают budgets/auth/body size, Caddy изоляцию, backup retention,
single-flight/stale transition, старые restored terminal и startup entitlements.

tools/growth-browser-check.cjs: desktop1280×900, portrait390×844, landscape844×390;
на каждом два реальных7-ходовых прохождения, consent/delete, задания/unlock,
выбор/reload, отсутствие повторной награды, focus/escape, touch44/overflow и
расположение эмблемы. Analytics HTTP перехватывается, игровое состояние и
сохранения не подменяются. Артефакты: artifacts/growth-browser/.

Финальные pnpm check:full после совмещения:404tests/buildPASS, matchingReceipt=true;
9platform builds и production platform checksPASS,6ZIP packagePASS.
Production friend-challenge и Pages seeded smoke после совмещенияPASS.
Независимый browser pass повторил growth UI на трёх размерах и lifecycle stop.
Backend лидербордов:17tests + real HTTP/workers contractPASS; deploy Python:
11tests,10PASS/1skip. Production leaderboard/challenge и growth browser checks
повторены после совмещения. Фактический серверный rollout и revision/HTTP проверки
фиксируются в локальном artifacts/growth-deployment.json после deploy.
Реальный телефон, настоящий рекламный инвентарь и платная покупка/возврат Stars
не подменяются mock/headless evidence.
