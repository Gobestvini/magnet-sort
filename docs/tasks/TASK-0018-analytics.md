# TASK-0018: Инструментировать воронку игры и challenge

- Статус: done
- Приоритет: normal
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: MVP
- Рекомендуемый исполнитель: средняя; высокий уровень рассуждения. Несколько ограниченных модулей с заданными контрактами; не нужен выбор общей архитектуры.
- Зависимости: TASK-0010, TASK-0014, TASK-0015, TASK-0016

## 1. Цель и запрос пользователя

Наблюдаемый результат: инструментировать воронку игры и challenge.
Исходный запрос очереди: инструментировать события игры и challenge. Зависимости TASK-0010/0014/0015/0016 завершены и опубликованы. Авторские решения и расхождения источников см. `docs/design/DECISIONS.md`; исходный GDD v0.1 сохранён как источник.

## 2. Проверенный контекст

Проверено повторно 2026-10-07 на `main` после TASK-0017. Игра использует PixiJS 8 + Preact, deterministic session, локальные progress/challenge/daily/booster потоки. Git remote настроен на собственный `origin`.

| Существующий файл / символ | Проверенное поведение | Роль в задаче |
| --- | --- | --- |
| src/game/session.js / createSession, snapshot | FTUE/campaign/daily/challenge mode, assisted flags и терминальный RunResult | Источник event context и переходов |
| src/main.js / startGame, handleTerminalResult, retry, shareCurrentChallenge | Runtime владеет mode entry, результата, retry и share intent | Интегрировать events без изменения симуляции |
| src/game/scoring.js / createRunResult | Версионированный итог содержит outcome, score, moves, mode, puzzle/content/rules version и assisted flags | Источник безопасных метаданных результата |
| src/social/challenge.js | Валидирует URL, строит frozen challenge и share fallback | Различить create/open/start/complete/click |
| src/game/boosters.js | Extra move использует standalone test grant | Не порождать ложный `rewarded_viewed` |
| tools/browser-check.cjs | Проходит FTUE, daily, share и incoming challenge на desktop/touch emulation | Проверить последовательность событий |

Начать с `docs/design/DECISIONS.md`, затем прочитать целиком зависимости и только нужные исходники. Контракты `docs/design/RULES.md` и `ARCHITECTURE.md` создаются TASK-0001; использовать их после завершения этой зависимости. Точное устройство и бюджеты ещё не выбраны; GDD durations являются целями, не результатом измерений.

## 3. Область изменений

Визуальное направление Magnet Sort задают [GDD v0.2](../design/GDD_V0.2.md) и [PixiJS pseudo-2.5D rendering contract](../design/PIXI_RENDERING.md). Для графических изменений сохраняй PixiJS 8 и псевдо‑2.5D; не добавляй настоящую 3D-сцену. Если задача чисто модельная/аналитическая, не расширяй её область из-за рендерера. Для задач с PixiJS, вводом, ассетами, производительностью или lifecycle также сверяй применимые разделы `../knowledge/pixijs-practices.md`; не расширяй scope задач чистой модели/аналитики.


Допустимые изменения и новые файлы: `src/analytics/events.js`, точечная integration в `src/main.js`, `tests/analytics.test.js`, `tools/browser-check.cjs` и `docs/design/ANALYTICS.md`. Модель/session/renderer менять не требуется: runtime уже видит завершённые transitions. Допустимы карта `docs/PROJECT.md`, отчёт и INDEX.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- События GDD §12: ftue_start/complete, level_start/complete, retry, challenge_created/opened/started/completed, share_clicked, rewarded_viewed. Указать payload/момент/дедупликацию и runId/puzzleId/version/mode/assisted.
- share_clicked = намерение; challenge_created = успешно подготовленная ссылка; не подменять фактическую доставку/открытие этими событиями. Rewarded_viewed только после реального подтверждения SDK completion, не dev grant.
- Adapter с local/dev collector и injectable production sink; запросы/ошибки аналитики не задерживают input/sim. Сервис сбора ещё не выбран — production sink оставить disabled до выбора, явно записать ограничение.
- Не отправлять PII, friend names, полный URL payload или секреты. Описать формулы FTUE >80%, completion >60%, retry >35%, created >10%, open-to-play >35% как гипотезы с denominator и выборкой, не как критерии автоматических тестов.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [x] Реализованы все события GDD §12 с runId/puzzleId/content/rules version/mode/assisted, моментом и дедупликацией.
- [x] Намерение поделиться, создание ссылки, валидное открытие и завершение challenge различены; тестовая награда не подтверждает просмотр рекламы.
- [x] Есть ограниченный in-memory dev collector и injectable production sink; sink отключён в app, его ошибки/latency не блокируют игру.
- [x] Privacy allowlist исключает PII и полные challenge URL; целевые проценты описаны только как гипотезы с run denominators.
- [x] `pnpm test`, desktop/touch browser flow и `pnpm check:full` прошли; ограничения production collection/real-device evidence записаны.
- [x] Существующее поведение в границах раздела 3 сохранено; отчёт и INDEX согласованы.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Выполнить pnpm test для поведения изменённых модулей; затем pnpm check:full (тесты + сборка). Ожидается exit 0; сохранять логи, в отчёт включить итог и ошибки.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- Unit: по одному событию на transition, retry/reset distinctions, отказ share и provider failure; нет ложного rewarded.
- Браузер dev collector: FTUE → result → share cancel/confirm → challenge → daily, последовательность и payload соответствуют реальным действиям.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факты: зависимости предоставили проверенные session/result/share/daily/booster contracts. Сбор событий локально ограничен allowlist. Production provider не выбран.
Предположение: один runId — один старт уровня; FTUE flowId связывает события активного tutorial только в памяти вкладки. GDD проценты — гипотезы до реальной выборки.
Production sink остаётся выключенным и требует отдельного решения о провайдере, согласии и хранении; это ограничение не блокирует локальную developer instrumentation.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0018-analytics.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни обязательные проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. При невыполненной зависимости или важном неизвестном запиши блокер; не помечай done при недоступной обязательной проверке. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: Добавлена privacy-safe funnel instrumentation с локальной dev-коллекцией и выключенным production sink.
- Изменённые файлы и зачем: `src/analytics/events.js` — allowlisted schema, bounded dev buffer, safe injectable sink и проверка реального rewarded completion; `src/main.js` — события на фактических переходах FTUE/level/retry/share/challenge; `tests/analytics.test.js` и `tools/browser-check.cjs` — контракты и интеграционные сценарии; `docs/design/ANALYTICS.md` — определения событий, privacy и знаменатели; `docs/PROJECT.md`, этот отчёт и INDEX — карта/статус.
- Команды и фактические результаты: `pnpm test` — 108 passed, 0 failed; `pnpm test:browser` — passed на desktop и touch-emulation; `pnpm check:full` — tests/build passed; `git diff --check` — чисто.
- Ручные проверки и устройства: браузерный поток подтверждает daily start/complete/retry, FTUE start/complete transition, share click/link creation, valid challenge open/start/complete. Реальный телефон и Meta Instant Games не тестировались; они не были доступны и не имитировались.
- Выполненные критерии: весь GDD event taxonomy и безопасные поля; `share_clicked` отдельно от `challenge_created`; opened отдельно от started/completed; fake reward не может записать `rewarded_viewed`; bounded in-memory dev collector; injectable non-blocking sink по умолчанию не подключён; privacy allowlist и гипотезы с denominator документированы.
- Непроверенное, блокеры и отклонения от плана: production события не собираются и продуктовые проценты не измерены, поскольку провайдер/согласие/retention не выбраны. `rewarded_viewed` пока не возникает: в игре нет SDK callback подтверждённого просмотра. Это ожидаемая граница задачи, не blocker локальной реализации.
- Commit/push либо причина отсутствия: `Add privacy-safe game funnel analytics`; отправлен в `origin/main`.
- Итоговый статус и дата: done, 2026-10-07.
