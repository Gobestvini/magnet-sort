# Реклама и Telegram Stars — ядро интеграции

2026-10-25. Часть последовательного growth-плана: аналитика → задания/коллекция →
монетизация. Это отчёт модулей; публикацию, production credentials и браузерную
интеграцию фиксирует ведущий в общем отчёте. Договоры/допуск и реальные показы или
списания этот документ не подтверждает.

## Клиентский контракт

- `src/commerce/controller.js::createCommerce({provider,getContext,onPause,onEvent,timeoutMs,readTimeoutMs=8000})`:
  `capabilities()`, `rewarded(placement)`, `interstitial(placement)`, `products()`,
  `purchase(productId)`, `verifyEntitlements()`, `refreshEntitlements()`, `snapshot()`, `dispose()`.
  `getContext()` возвращает стабильный run ID; смена во время запроса даёт `stale`.
  `onPause(true/false)` управляет **отдельным владельцем паузы рекламы**, не отменяет
  user/platform pause. Все завершения/ошибки/timeout/dispose освобождают этот owner.
  Read-only catalog/ledger запросы также ограничены deadline и отменяются при dispose;
  provider получает `{signal}`. `verifyEntitlements()` возвращает
  `{status:'ok',entitlements:[...]}` либо `{status:'error',reason}`: сетевую ошибку
  нельзя трактовать как подтверждённый пустой ledger. Только `ok`, включая `[]`
  после возврата, заменяет текущие подтверждённые права. Старый array-метод
  `refreshEntitlements()` на ошибке сохраняет последнюю подтверждённую копию только
  в памяти текущей сессии; localStorage paid cache не создаётся.
  Более старый concurrent ledger read после нового результата возвращает
  `reason:'superseded'`, поэтому поздний ответ не перезаписывает подтверждённый возврат.
- Статусы: `completed`, `cancelled`, `unavailable`, `error`, `pending`, `busy`, `stale`.
  Для рекламы награда только при `status==='completed' && completed===true`.
  Выдачу и её dedupe на одну разрешённую попытку выполняет runtime/meta, не SDK adapter.
- `src/commerce/providers.js::createAdProvider({id,sdk,enabled=false,adMode='full',subscribe,controllers})`.
  `enabled=false` и `adMode!=='full'` скрывают возможности; отсутствие API не даёт
  «успешную» заглушку. SDK загружает только явно выбранный build target, не autodetect.
- `combineProviders(adProvider,purchaseProvider)` совмещает AdsGram и Stars;
  `providerFor(kind)` сохраняет реальный источник для событий аналитики.
- `src/commerce/telegram.js::createTelegramStarsProvider({endpoint,bridge,enabled=false,fetch,readTimeoutMs=8000})`.
  Bearer живёт только в памяти. Клиентское `openInvoice(...,'paid')` не выдаёт право:
  клиент повторно читает сервер, задержанный webhook возвращает `pending`. Restore
  идёт с тем же подписанным Telegram account; localStorage не подтверждает покупку.
  `products({signal})` и `entitlements({signal})` поддерживают отмену и ограничивают
  зависшие HTTP/JSON/login; прежний direct `AbortSignal` для entitlements сохранён.
  Ответ401 передаёт `reason:'reopen-telegram'` через typed verification, а dispose
  не позволяет позднему login сохранить токен или начать следующий ledger запрос.

## Официальные SDK и точки интеграции

Источники прочитаны 25.10.2026. API проверены mock-тестами; настоящая реклама на
активированной платформе требует отдельной проверки. Все portal IAP в v1 отключены:
товары, account verification и серверная выдача для них ещё не подключены.

| Target / первичный источник | Скрипт, global, init | Доказательство завершения в нашем адаптере |
| --- | --- | --- |
| [AdSense H5 Ad Placement API](https://developers.google.com/ad-placement/apis/adbreak), [типы placement](https://developers.google.com/ad-placement/docs/placement-types) | Root загружает `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-...` только с configured public publisher ID и ads flag; injected `sdk={adBreak,adConfig}` | Provider `adsense-h5`: rewarded `type:'reward'`, `beforeReward(showAdFn)` только после явной игровой watch-ad кнопки; флаг `adViewed` и завершение `adBreakDone`. `adDismissed` отменяет. Один `adBreakDone({breakStatus:'viewed'})` без `adViewed` не выдаёт награду. Interstitial `next` (или explicit constructor `interstitialType:'start'`) без игровой награды |
| [CrazyGames v3 intro](https://docs.crazygames.com/sdk/intro/), [video ads](https://docs.crazygames.com/sdk/video-ads/) | `https://sdk.crazygames.com/crazygames-sdk-v3.js`; `window.CrazyGames.SDK`; `await SDK.init()` | `ad.requestAd('rewarded',callbacks)`: только `adFinished`; `adError` не выдаёт награду. Basic ads-off задаётся явным режимом |
| [Poki HTML5](https://developers.poki.com/guide/sdk-html5) | `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`; `PokiSDK`; `await PokiSDK.init()` | `rewardedBreak()` должен вернуть ровно `true`; `commercialBreak()` — естественный переход без награды |
| [Яндекс подключение](https://yandex.com/dev/games/doc/en/sdk/sdk-about), [реклама](https://yandex.com/dev/games/doc/en/sdk/sdk-adv) | В архиве `/sdk.js`; для собственного домена `https://sdk.games.s3.yandex.net/sdk.js`; `await YaGames.init()` | `adv.showRewardedVideo`: флаг только `onRewarded`, результат после `onClose`; закрытие без флага не награждает |
| [Playgama Bridge](https://github.com/Playgama/bridge), [официальный advertisement module](https://github.com/Playgama/bridge/blob/main/src/modules/advertisement/AdvertisementModule.ts) | `https://bridge.playgama.com/v2/stable/playgama-bridge.js`; `window.bridge`; `await bridge.initialize()`; рядом конфиг `playgama-bridge-config.json` | `advertisement.on(REWARDED_STATE_CHANGED)`: состояние `rewarded`, затем `closed`; subscriptions снимаются при abort/завершении |
| [GameDistribution SDK](https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation), [rewarded](https://github.com/GameDistribution/GD-HTML5/wiki/Rewarded-Ads) | До скрипта `window.GD_OPTIONS={gameId,onEvent}`; `https://html5.api.gamedistribution.com/main.min.js`; `window.gdsdk` | Root передаёт `subscribe(listener)->unsubscribe`; только `SDK_REWARDED_WATCH_COMPLETE` разрешает награду. Promise `showAd` и `SDK_GAME_START` сами её не подтверждают |
| [GamePix JavaScript v3](https://partners.gamepix.com/sdk/doc/javascript) | До скрипта `GamePixConfig={lifecycle:'manual'}`; `https://integration.gamepix.com/sdk/v3/gamepix.sdk.js`; `window.GamePix` | `ads.reward()` возвращает `{success:true}`; `ads.interstitial()` для естественного перехода. Root обязан настроить `events.on('pause'/'resume')`, вызвать `lifecycle.loaded()` и `gameStart()` |
| [AdsGram integration](https://docs.adsgram.ai/publisher/reward-interstitial-integration) | `https://sad.adsgram.ai/js/sad.min.js`; `Adsgram.init({blockId})`; отдельные controllers для rewarded/interstitial | `controllers.rewarded.show()` только `{done:true,error:false}`. Interstitial controller никогда не передавать в rewarded slot |

**Проверенный нюанс CrazyGames v3:** общий intro говорит о promise API, но раздел
video ads показывает callbacks. Чтение текущего публичного v3 SDK подтвердило:
`requestAd` — async-функция, которая отправляет запрос; её Promise может закончиться
до объявления результата рекламы. Поэтому adapter не награждает по resolve этого
Promise. Отдельный regression test проверяет ранний resolve и последующий callback.

## Серверный контракт

Node 24, встроенный `node:sqlite`. `createCommerceService({dbPath,botToken,
botId='8820798959',webhookSecret,now,fetch,supportContact})` в `server/commerce.mjs`.
Секреты только server env; service не меняет webhook бота сам.

| HTTP wiring относительно `/magnet-sort-growth/v1` | Метод сервиса / результат |
| --- | --- |
| `POST /commerce/auth` JSON `{initData}` | `authenticate(initData)` → `{token,expiresAt}` |
| `GET /commerce/catalog` | `catalog()` → `{products}`; без секретов пустой список |
| `GET /commerce/entitlements` Bearer | `entitlements(rawToken)` → `{entitlements:[productId]}` |
| `POST /commerce/invoice` Bearer JSON `{productId,idempotencyKey}` | `createInvoice(rawToken,productId,idempotencyKey)` → invoice URL/order/серверная цена |
| `POST /commerce/telegram-webhook` с `X-Telegram-Bot-Api-Secret-Token` | `webhook(update,secret)` → `{ok,handled}` |
| Только оператор, не публичный checkout | `refund(telegramChargeId)` вызывает `refundStarPayment` и отзывает право |
| Только оператор | `reconciliation({limit})` показывает неоплаченные возвратом duplicate/quarantine receipts; `reconcile({limit})` повторяет запрошенные/автоматические возвраты |
| Только оператор | `refundAudit({limit})` показывает refund notifications, включая неполные/несоответствующие данные и refund-before-payment |

`available()` сообщает готовность конфигурации; `close()` закрывает БД.
Ошибки имеют безопасные `error.code` и `error.status`; HTTP entry не выдаёт stack,
URL Bot API, тело initData или исходные Telegram API error details клиенту.
HTTP body/rate limits, CORS, TLS, admin guard, каталог UI и deployment — отдельная
интеграция ведущего. Коды account IDs и токены не включаются в аналитику.

Подписанный HMAC launch проверяется против **существующего** MagnetSortPuzzleBot,
bot ID8820798959, TTL300s + future skew30s. Duplicate keys и ошибочный UTF-8
отклоняются; неизвестные поля остаются в подписанной строке. Сервер хранит только
хеш random Bearer, TTL24h, максимум10 сессий account. Токен бота не отдаётся клиенту.

Один фиксированный товар `supporter_aurora`: **50 XTR**, бессрочная косметическая
рамка без игрового преимущества. Цена — начальное продуктовое решение текущей
реализации, не проверенный результат эксперимента. Сервер фиксирует сумму/валюту;
клиент не назначает цену. `createInvoiceLink` не означает оплату; право выдаётся
только matching `successful_payment` после проверки payload/плательщика/XTR/суммы.
Charge ID уникален, повторный webhook не создаёт вторую выдачу; refunded order
никогда не оживает от старого successful payment. Повторное открытие pending invoice
использует один заказ для account/product. Подтверждённый refund отзывает право
только своего `granted` receipt, не другого оплаченного receipt.

После независимого P1-замечания 25.10.2026 добавлен отдельный canonical ledger
`commerce_receipts`: ограничение «один charge на order» больше не теряет второй
реальный платёж. Сохраняется **каждый** secret-validated charge ID; matching первый
receipt получает право, второй matching charge — durable duplicate и автоматический
refund. Ошибка refund оставляет запись для `reconciliation()`/`reconcile()`;
неизвестный order, другой плательщик/валюта/сумма сохраняются в quarantine без права,
с возможностью ручного refund по charge ID (только XTR и известный payer). Сырые
профили/initData не сохраняются; администратору доступны только данные квитанции.
Старая `commerce_charges` мигрируется дополнением, без удаления истории.

Отдельно исправлен порядок доставки: authenticated `refunded_payment` создаёт
durable refunded receipt/tombstone даже до `successful_payment`. Поздний success
по этому charge ID не выдаёт право, в том числе после рестарта. Неизвестные и
неполные refund notifications остаются в `commerce_refund_events` для аудита;
если charge ID известен, refund tombstone блокирует позднюю выдачу. Несоответствие
metadata отмечается quarantine в audit, а secret-validated refund конкретного
charge ID отзывает именно этот charge. Автоматическая reconciliation выбирает
применимые к автоматическому возврату строки SQL-фильтром **до LIMIT**: старые
manual quarantines не закрывают страницу и не блокируют более поздний refund.

`commerce_checkouts` атомарно резервирует account/product на15мин при первом
pre-checkout query. Параллельный другой query не принимается; повтор того же query
идемпотентен до истечения резерва/оплаты. После TTL можно повторить checkout,
но задержанный genuine `successful_payment` никогда не отбрасывается из-за времени:
он сохраняется, выдаёт единственное право или попадает в возврат/reconciliation.
Telegram successful payment не содержит pre-checkout query ID, поэтому receipt
проверяется по order/payer/currency/amount, не выдуманной связи с query ID.
`/paysupport` отвечает только на входящую команду; `/start` и чужие updates не меняются.

## Проверки и границы

`node --test tests/commerce-client.test.js tests/commerce-server.test.js` — **34 PASS**:
ads-off/no-provider, ранний CG Promise, Yandex закрытие, положительные и отрицательные
Poki/GamePix/AdsGram outcomes, Playgama/GD completion, cleanup, busy/stale/timeout/dispose,
серверная выдача поверх invoice callback, forged/stale/malformed auth, precheckout
mismatch, fixed prices, идемпотентность invoice/payment, refund, SQLite restart restore,
session expiry и support command. Добавлены concurrent pre-checkout reservation,
два разных charge одного order, независимый refund второго charge без отзыва первого,
failed automatic refund + restart/reconcile, unknown receipt quarantine/manual refund,
TTL expiry и поздние successful payments, миграция legacy paid/refund истории через
два перезапуска; refund-before-success/restart, incomplete refund audit и20старых
quarantines перед failed duplicate refund без starvation. Это
unit/mock/in-memory/temporary SQLite проверки.

AdSense H5 отдельно проверен mock-сценариями no-fill, early `adBreakDone`, dismiss,
`adViewed`+final completion, duplicate prompt, abort/late callbacks и interstitial.
[Официальная программа](https://support.google.com/adsense/answer/1705831?hl=en)
требует одобренный AdSense и отдельный допуск H5 Games Ads; publisher ID/JS wrapper
не доказывают одобрение. До доступа аккаунта реальные показы/доход не заявляются.

Не проверены настоящие platform account eligibility/placements, no-fill на реальном
рекламном инвентаре, реальная покупка/возврат Stars и устройства. До production Stars
нужны серверный deploy, защищённые env и webhook существующего бота с проверкой
текущего маршрута (не перетирать чужой handler); backup БД и доступная поддержка.
Показы/покупки на неактивированных площадках не заявляются включёнными.
