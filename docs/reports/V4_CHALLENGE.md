# Вызов другу в Telegram

2026-10-25, TASK-0072, исходная ревизия4ed9851. Пользователь принял доску дня
и поручил вызов другу. Реальная пересылка человеку не разрешалась и не выполнялась;
все chooser/copy-проверки используют отдельный браузерный mock.
Техническая и независимая приёмка завершены; review остаётся только для
предусмотренной §7 реальной пересылки/запуска у получателя.

## Контент и payload

До реализации зафиксированы contentVersion `sub-ten-2026-10-20.1`, profiles
`campaign-a-v1` и `short-b-2026-10-25.1`, полный SHA-256 rules/layout manifest:
`1641a9930e9ce0163739f1e05b26878620a08d2547fc1ec2a91f6542d9601492`.
Generated manifest включает12 layouts, goals/intervals/id двух профилей и8
SHA-256 normalized-LF sources: hex, daily-rules, difficulty, levels-v4,
magnet-influence, magnet-radius, model-v4, model. UI/platform/codec не входят.
Генератор по умолчанию проверяет актуальность; `--write` — явное обновление.

Logical descriptor: schema1, levelNumber1…12, uint32 seed, presetId,
contentVersion, полный rulesHash, moves1…65535 и assisted boolean. Wire —
schema/level/flags bytes, big-endian seed/moves, length-prefixed UTF-8 версии
контента/профиля и32 raw hash bytes, затем canonical base64url без padding.
Текущие payload102символа(A)/111(B), собственный предел160, alphabet
`A-Z a-z 0-9 _ -`. Строгий decode/re-encode отвергает лишние байты, malformed
UTF-8, flags, tail bits и неканоничную запись. Известная форма с другой
schema/version/profile/hash — unsupported; несовместимые правила не подменяются.

Hash подтверждает только совместимость. Moves/assisted — заявление отправителя,
не подпись и не доказательство прохождения. Payload не выдаёт готовую победу
или награду. Получатель строит initial state через тот же kernel; сравнение
показывается лишь после собственной победы при совпадении категории помощи,
всегда с `verified:false`. Challenge не пишет campaign achievements; звёзды и
Next campaign в его результате не показываются.

## Platform boundary и UX

Официальный контракт сверён2026-10-25:
[Main Mini App launch](https://core.telegram.org/bots/webapps#launching-the-main-mini-app)
передаёт startapp через start_param/tgWebAppStartParam;
[Sharing Button](https://core.telegram.org/widgets/share) описывает chooser
`t.me/share/url`. SDK openTelegramLink проверяется по наличию метода и версии6.1+.
Открытие chooser не доказывает доставку; shareMessage backend не используется.

- Telegram adapter читает только launch-параметр, формирует ссылку существующего
  `MagnetSortPuzzleBot` и открывает chooser по явному click. Дубликаты и разные
  копии initData/GET отвергаются, одинаковые нормальные копии допустимы.
- Web использует `?challenge=` и native share при доступности; Cancel/Error
  оставляют URL. Embed только показывает/копирует canonical web-ссылку.
- Bootstrap устанавливает adapter в runtime-context до import runtime:
  constructor кампании уже знает о preview и не выполняет startup persist/advance.
  Rules/runtime не читают Telegram.WebApp и не получают userId/initData.
- После победы A, daily B или challenge доступна Challenge a friend. Share dialog
  хранит selectable readonly link, Copy и честный статус; clipboard denial
  сохраняет ручное копирование. Generation guard игнорирует late callbacks после
  Close/Return/dispose. Автоматической отправки/chooser на launch/win нет.
- Входящая ссылка показывает Friend challenge, Play challenge/Cancel. Invalid или
  unsupported показывают Challenge unavailable с Update/Return, без Play.
  Новые кнопки имеют минимум44CSSpx, включая Telegram с safe insets.

## Владение и сохранение

`createV4ChallengeSession` оборачивает существующий mode owner и создаёт отдельный
fixed-seed controller только после Play. Preview/Cancel/ошибки не записывают
campaign/daily и не расходуют новый seed. Retry повторяет descriptor seed/profile,
Hint/Undo/lost/won меняют только transient attempt. Return восстанавливает настоящий
campaign state/history/selection; при исходной daily её attempt сохраняется,
а явный Return переводит её activeView в campaign.

Reload не сохраняет challenge journal: вновь показывает preview той же ссылки,
после Play начинает с initial state. Базовые campaign/daily envelopes при этом
сохраняются. Shared audio/renderer/clock остаются общими; presentation cleanup
убирает жест, timeline, collection и старые share callbacks при переходе.

Независимый критик нашёл конфликт `?seed` вместе с challenge: Return сначала
выбирал чужой DEV transient board вместо сохранённой кампании. Исправление:
любой incoming challenge игнорирует URL fixedSeed/custom DEV profile для базы;
обычный DEV без приглашения сохранён. Проверены valid/invalid и настоящий
L4/seed17 с историей при URL seed42; raw campaign до/после совпадает.

## Проверки

- Pure codec/content:7 tests и generator --check PASS. Профильные platform tests
  вместе с platform-release:12 PASS. Автор core/mode:30 и отдельные25 regression
  tests PASS; P2 fix с experiment/progress:20 PASS.
- Независимый критик:49 профильных tests; после P2 —23 challenge tests PASS,
  manifest check, unit A/B initial states и actual DEV B initial state, preview/Cancel/ошибки без
  writes/seed, B victory, помощь/comparison, copy/cancel и stale async PASS.
- Финальная full прогонка:291/291 tests и production build PASS.
  All-platform builds PASS. Production browser web/Telegram mock/embed проверил
  share A/B, chooser/copy/cancel/error, preview/Cancel, initial state,
  Hint/Undo/reload/Retry/win/Return, malformed/version/duplicate и44px PASS.
- DEV: валидный проигрыш получен scripted controller prefix, последний ход и
  Undo выполнены реальным keyboard/touch; normal-motion Hint/move/pause/Undo,
  восемь циклов (3warm+5measured), возврат в кампанию, resize/dispose PASS.
  В финальном прогоне измеряемые циклы стабильны:9 geometries/15 textures.
  Этот setup не выдан за ручное прохождение всех подготовительных ходов.
- Регрессии platforms/daily/Hint/Undo/tutorial/Pages/loading PASS. Tutorial проверен
  на5viewport, loading — на6вплотьдо2560px с staged decode/errors/Retry;
  Pages — desktop/mobile victory/stars/retry/pause. Screenshots — `artifacts/challenge-v4/`, независимые
  evidence — `artifacts/challenge-critic*`; логи — `artifacts/challenge-*.log`.

```powershell
node tools/generate-challenge-content.mjs --check
node --test tests/challenge-v4.test.js tests/challenge-mode.test.js tests/challenge-platform.test.js
pnpm check:full
pnpm build:platforms
$env:CHALLENGE_DEV_URL='http://127.0.0.1:5175/'
node tools/challenge-v4-browser-check.cjs
pnpm test:platforms
node tools/daily-v4-browser-check.cjs
node tools/hint-v4-browser-check.cjs
node tools/undo-v4-browser-check.cjs
node tools/tutorial-browser-check.cjs
node tools/pages-browser-check.cjs
node tools/loading-browser-check.cjs
```

Browser использует настоящий production renderer и отдельные fake SDK/clipboard:
не открывает Telegram, не меняет clipboard пользователя, не отправляет сообщения.
Mock, настоящий Telegram и получатель — разные evidence; §7 задачи остаётся review
для реальной пересылки/запуска у получателя при отдельном прямом разрешении.

## Публикация

Свой проверенный commit доставляется в remote main, затем ожидается Deploy Pages
и проверяется опубликованный web/Telegram mock. Тот же CI-built combined tree
доставляется на существующий static URL бота по [runbook](../../deploy/README.md).
Runtime файлы берутся из опубликованного tree указанной revision, оба manifest
проверяются по byte count/SHA-256 и `readArtifact`, затем archive по SSH в новый
incoming-каталог и существующий atomic publisher переключает только Magnet Sort.
Другие game routes/containers и bot settings не меняются. SHA/CI/revisions,
published smoke и VPS previous/current сохраняются в
`artifacts/challenge-v4/release.json` и итоговом сообщении.
