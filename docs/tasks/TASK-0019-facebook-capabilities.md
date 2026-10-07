# TASK-0019: Проверить возможности Facebook Instant Games для MVP

- Статус: done
- Приоритет: high
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: Исследование платформы
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения. Нужно снять неоднозначность правил/платформы и оценить доказательства.
- Зависимости: нет

## 1. Цель и запрос пользователя

Наблюдаемый результат: проверить возможности facebook instant games для mvp.
Исходный запрос очереди: проверить возможности Facebook Instant Games для текущего web MVP до платформенной интеграции. Визуальная и игровая основа остаётся GDD v0.2 на PixiJS/pseudo‑2.5D; см. `docs/design/DECISIONS.md`.

## 2. Проверенный контекст

Проверено 2026-10-07 на `main` после TASK-0018. Instant Games SDK не подключён. Нет конкретного Meta developer app ID, developer/tester account access, ad placement IDs или реального Instant Games test context; поэтому app-specific access/capabilities нельзя подтвердить. Прямые developer docs не удалось получить из research environment; вывод ограничен текущим Meta-owned Instant Games SDK wrapper, GitHub sample archive и проверенным локальным fallback.

| Существующий файл / символ | Проверенное поведение | Роль в задаче |
| --- | --- | --- |
| src/main.js / runtime lifecycle | App-owned RAF, pause/hidden/blur/dispose, dev diagnostics | Platform lifecycle seam |
| src/game/session.js / challenge + daily entry | Versioned frozen challenge, daily puzzle and local persistence | Standalone fallback behavior |
| src/social/challenge.js | Bounded URL parser, Web Share/clipboard fallback and SVG card | Share/entry adapter mapping |
| src/analytics/events.js | In-memory dev funnel collector, production sink disabled | Do not imply online reporting before provider choice |
| docs/design/ANALYTICS.md | Event and privacy contract | Platform analytics mapping constraint |

Начать с `docs/design/DECISIONS.md`, затем прочитать целиком зависимости и только нужные исходники. Контракты `docs/design/RULES.md` и `ARCHITECTURE.md` создаются TASK-0001; использовать их после завершения этой зависимости. Точное устройство и бюджеты ещё не выбраны; GDD durations являются целями, не результатом измерений.

## 3. Область изменений

Визуальное направление Magnet Sort задают [GDD v0.2](../design/GDD_V0.2.md) и [PixiJS pseudo-2.5D rendering contract](../design/PIXI_RENDERING.md). Для графических изменений сохраняй PixiJS 8 и псевдо‑2.5D; не добавляй настоящую 3D-сцену. Если задача чисто модельная/аналитическая, не расширяй её область из-за рендерера. Для задач с PixiJS, вводом, ассетами, производительностью или lifecycle также сверяй применимые разделы `../knowledge/pixijs-practices.md`; не расширяй scope задач чистой модели/аналитики.


Допустимые изменения и новые файлы: docs/design/FACEBOOK_CAPABILITIES.md, docs/design/PLATFORM_CONTRACT.md; без runtime изменений. Допустимы соответствующие поведенческие тесты `tests/*.test.js`, обновление карты `docs/PROJECT.md`, отчёта этой задачи и INDEX. Равноценные небольшие модули разрешены при сохранении контрактов и записи путей в отчёте.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- По актуальной официальной документации Meta проверить доступность Instant Games для выбранного app/account, supported SDK APIs, initialize/start/loading/lifecycle, entry data и share/update/context.
- Отдельно проверить friend leaderboard, rematch/update notifications, rewarded и interstitial: capability/permissions/доступность/ограничения по платформам. Не считать обещания другого чата действующими API.
- Определить минимальные appId/dev access/test context, размещение тестового build без публикации и trusted score requirements. Секреты в документы не писать; отсутствующие доступы назвать.
- Результат — таблица supported/unavailable/unknown со ссылками/датой и adapter интерфейс start, getEntry, shareResult, getLeaderboard, rewarded, interstitial, pause/dispose + standalone fallback.
- При недоступном API сформулировать конкретное сокращение social flow, а не silent imitation. Исследование можно закончить с зафиксированным unknown; TASK-0020/21 не переводить ready до доступа и решения.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [x] Проверена доступная актуальная Meta-owned SDK reference для bootstrap/readiness, entry data, social/context, session score/tournament, ads and pause; direct developer pages were inaccessible to this review environment.
- [x] Friend/global/context leaderboard is marked partial/unknown for current app; update/rematch distinctions and ad APIs, placement/permissions limits are documented without claiming access.
- [x] App ID, required dashboard/test access and non-public test-build path evidence are stated; no credentials are included. Trusted score requires server validation and remains unverified.
- [x] `FACEBOOK_CAPABILITIES.md` includes supported/unknown matrix; `PLATFORM_CONTRACT.md` defines adapter methods and standalone fallback.
- [x] Unavailable app-specific capabilities have explicit scope reduction: standalone web remains authoritative; no fake social delivery, ranking or reward completion. TASK-0020/21 stay draft until app access/policy evidence exists.
- [x] Research links are date-stamped; app/platform/browser testing is explicitly not claimed.
- [x] No runtime behavior changed; report, project map and INDEX are aligned.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Новые тесты runtime не нужны для этой документальной задачи. Проверить внутреннюю согласованность документов, fixtures/ссылок и все пункты evidence ниже.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- Ссылки ведут на первичные источники; каждое поддерживаемое API подтверждено документацией и при наличии доступа capability probe.
- Чтение platform docs не требует сборки/браузера игры. Не создавать app, не публиковать build и не отправлять приглашения без отдельного запроса.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факт из текущего Meta-owned wrapper: SDK 8.0 surface перечисляет lifecycle, entrypoint, social/context, session score/tournament, ad, supported-API and pause methods. Это wrapper reference, а не proof direct JavaScript availability или permissions этого app.
Факт из official sample archive: mock local, production SDK в embedded player, mobile test посредством uploaded platform build; репозиторий archived, его dashboard/token instructions historical.
Account availability, exact direct-JS support, live leaderboard configuration, trust requirements, placements and market/account policy остаются unknown и названы в отчёте. Исследование заканчивается с этим ограничением; оно не разрешает создавать app или публиковать игру.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0019-facebook-capabilities.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни обязательные проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. При невыполненной зависимости или важном неизвестном запиши блокер; не помечай done при недоступной обязательной проверке. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: Проверены доступные Meta Instant Games capability surfaces; зафиксированы adapter boundary, standalone fallback и account-specific unknowns.
- Изменённые файлы и зачем: `docs/design/FACEBOOK_CAPABILITIES.md` — evidence/unknown matrix, account prerequisites, test path and score-trust boundary; `docs/design/PLATFORM_CONTRACT.md` — API adapter contract and fallback; `docs/PROJECT.md`, этот отчёт и INDEX — карта и статус.
- Команды и фактические результаты: проверены ссылки и внутренняя согласованность документов; `git diff --check` — чисто; runtime tests не требовались. Официальный Meta developer portal fetch недоступен из research environment; ограничение записано, вывод сделан по Meta-owned SDK wrapper/reference.
- Ручные проверки и устройства: код не запускался в Instant Games; прочитаны текущие SDK docs/repository pages. App dashboard, real SDK context, physical device, ad placement/account eligibility не проверялись.
- Выполненные критерии: documented vs unknown capabilities, bootstrap/entry/share/context/tournament/ad methods, account/test build prerequisites, server-side trust caveat, standalone behavior and API contract; credentials не записывались.
- Непроверенное, блокеры и отклонения от плана: нет appId, Meta developer-role account, test context, placements или backend verifier; direct official docs fetch failed. Это явный unknown, не статус supported/unavailable. Задача исследования закрыта с ним; TASK-0020/21 остаются draft до реального account access/policy evidence.
- Commit/push либо причина отсутствия: `Document Instant Games capabilities and adapter boundary`; отправлен в `origin/main`.
- Итоговый статус и дата: done, 2026-10-07; account-specific availability осталась unknown.
