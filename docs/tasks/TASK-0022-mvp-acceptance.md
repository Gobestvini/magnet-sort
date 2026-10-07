# TASK-0022: Провести полную приёмку MVP и записать ограничения

- Статус: done (internal MVP acceptance; real-device, tester and Meta evidence waived by user)
- Приоритет: normal
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: Приёмка
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения. Нужно снять неоднозначность правил/платформы и оценить доказательства.
- Зависимости: TASK-0012, TASK-0013, TASK-0014, TASK-0015, TASK-0016, TASK-0017, TASK-0018, TASK-0020, TASK-0021

## 1. Цель и запрос пользователя

Наблюдаемый результат: провести полную приёмку mvp и записать ограничения.
Исходный запрос: прочитать GDD v0.1 и диалог, разделить Magnet Sort на самостоятельные задачи для последующей работы. Этот файл — задание на будущий этап, реализация при подготовке не выполнялась.
Сейчас в проверенном проекте есть только пустой шаблон; после выполнения зависимостей ожидается результат соответствующего этапа. Авторские решения и расхождения источников см. `docs/design/DECISIONS.md`; GDD §§4–13 — продуктовая основа, §16 — порядок прототипирования.

## 2. Проверенный контекст

Проверено 2026-10-07 на `64598cb`. Рабочая папка является Git-репозиторием `main` с настроенным `origin`; TASK-0001–0021 завершены, включая отдельные reports/waivers. Игра использует PixiJS 8, Preact, deterministic simulator, 50 campaign levels, five FTUE levels, web challenge/daily, local progress, boosters, audio/haptics, dev analytics и изолированные platform/ads adapters. Картографию путей см. `docs/PROJECT.md`; фактические acceptance results — `docs/reports/MVP_ACCEPTANCE.md`.

Команды проверялись из корня проекта: `pnpm test`, `pnpm test:browser`, `pnpm check:full`; браузерный сценарий работает на автоматизированном desktop/mobile viewport surrogate. Реального телефона и Meta app context в данном turn не предоставлялось; пользователь прямо разрешил эти входы не запрашивать.

Начать с `docs/design/DECISIONS.md`, затем прочитать целиком зависимости и только нужные исходники. Контракты `docs/design/RULES.md` и `ARCHITECTURE.md` создаются TASK-0001; использовать их после завершения этой зависимости. Точное устройство и бюджеты ещё не выбраны; GDD durations являются целями, не результатом измерений.

## 3. Область изменений

Визуальное направление Magnet Sort задают [GDD v0.2](../design/GDD_V0.2.md) и [PixiJS pseudo-2.5D rendering contract](../design/PIXI_RENDERING.md). Для графических изменений сохраняй PixiJS 8 и псевдо‑2.5D; не добавляй настоящую 3D-сцену. Если задача чисто модельная/аналитическая, не расширяй её область из-за рендерера. Для задач с PixiJS, вводом, ассетами, производительностью или lifecycle также сверяй применимые разделы `../knowledge/pixijs-practices.md`; не расширяй scope задач чистой модели/аналитики.


Допустимые изменения и новые файлы: docs/reports/MVP_ACCEPTANCE.md, docs/GAME_BRIEF.md, docs/PROJECT.md, docs/tasks/INDEX.md; без соседних рефакторингов. Допустимы соответствующие поведенческие тесты `tests/*.test.js`, обновление карты `docs/PROJECT.md`, отчёта этой задачи и INDEX. Равноценные небольшие модули разрешены при сохранении контрактов и записи путей в отчёте.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- Сверить все обязательные критерии предыдущих задач и GDD coverage: 50 уровней, FTUE, deterministic chain, result, challenge entry/rematch/card, daily/friends ranking по платформе, boosters/audio/analytics/ads.
- Пройти сценарии desktop Chrome/Edge и реальный целевой mobile browser/Instant Games, записать устройства/версии. Проверить drag/tap, cancel/blur/hidden/reset, reload/storage errors, corrupt links, unavailable SDK/ads.
- Замерить бюджеты TASK-0001 на одинаковом устройстве/сценарии; сравнить с prototype gate. Повторные переходы/retry не увеличивают число RAF, listeners, textures/audio nodes без границы.
- Принимать PixiJS pseudo‑2.5D board только после проверки читаемости поля/токенов/magnet, загрузки ассетов и p95 на реальном целевом устройстве.
- Сформировать воспроизводимые дефекты с evidence и условия выпуска. Нерешённые обязательные критерии запрещают done; сокращение scope требует явного решения и обновления задач.
- Не публиковать игру. Аккаунты, meta/валюты, UGC, real-time multiplayer, фотореалистичные ассеты и дорогие фильтры, портальные уровни 51+ и варианты Reverse/Twin вне MVP. Читаемый PixiJS pseudo‑2.5D board/токены/magnet обязательны по GDD v0.2.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [x] Сверена функциональная матрица TASK-0012–0021 и GDD coverage; недоступные social/ad surfaces помечены как disabled/unknown, не объявлены работающими.
- [x] `pnpm check:full`, `pnpm test:browser` и project suite прошли на коде `64598cb`; 50 campaign replay/FTUE and relevant adapter behavior входят в автоматизированное покрытие.
- [x] Desktop/mobile viewport browser surrogate проверил layout, pause/reset, input and runtime errors. Окружение и граница проверки записаны.
- [x] Опубликованы открытые user/device/platform evidence и критерии повторной проверки в `docs/reports/MVP_ACCEPTANCE.md`; `PROTOTYPE_GATE` сохраняет `rework` для public rollout.
- [x] Остаёмся без публикации и без включённых ads; 51+, accounts/meta, UGC, realtime multiplayer, photorealistic assets и expensive filters остаются вне MVP. PixiJS pseudo‑2.5D сохраняется.
- [x] Scope изменён по прямому разрешению пользователя: внешние тестеры, физический телефон и Meta account/test placement evidence не блокируют внутреннюю техническую приёмку, но не считаются пройденными и остаются обязательными до публичного release gate.
- [x] Отчёт, GAME_BRIEF, карта и INDEX согласованы; runtime поведение в этом acceptance task не менялось.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Выполнить pnpm check:full; с запущенным pnpm dev выполнить pnpm test:browser. Ожидается exit 0, затем отдельно выполнить реальные ручные/device проверки.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- pnpm check:full, актуальный pnpm test:browser с dev server и доступным Playwright, replay validation всех 50 уровней. Логи остаются на диске.
- Полный browser/device/platform протокол; screenshots и реальные замеры. Продуктовые percentages остаются гипотезами до достаточной выборки.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факты: отчёт `docs/reports/MVP_ACCEPTANCE.md` опирается на актуальную карту и автоматические проверки. Touch viewport означает browser surrogate; он не доказывает реальные input feel, readability или frame budget. Meta capability mock не доказывает app/account access. Рыночные числа и acquisition не трактуются как доказанный результат.
Решение пользователя от 2026-10-07: завершить очередь автономно и не останавливать работу из-за внешних тестеров, телефона, замеров или Meta account inputs. Scope этого задания сужен до внутренней технической приёмки и фиксации всех этих gaps; public release remains `rework`.
Статус: done для согласованного внутреннего scope. Задача не включает публикацию, запуск Telegram или включение рекламных форматов.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0022-mvp-acceptance.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни автоматические проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. Внешнее device/platform evidence, на которое пользователь дал waiver, перечисли как непроверенное; внутреннюю техническую приёмку не выдавай за public release approval. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: завершена внутренняя техническая приёмка на `64598cb`; решение перед публичным rollout остаётся `rework` согласно ограниченному prototype gate.
- Изменённые файлы и зачем: `docs/reports/MVP_ACCEPTANCE.md` — матрица функциональности, evidence и release ограничения; `docs/GAME_BRIEF.md` — фактическое состояние baseline; `docs/PROJECT.md` — ссылка на финальный отчёт; `docs/tasks/INDEX.md` и этот файл — согласованный статус, waiver и следующий gate. Игровой код не менялся.
- Команды и фактические результаты на проверенном коде `64598cb`: `pnpm test` — 119/119 passed; `pnpm test:browser` — passed (desktop/mobile layout, pause/reset, input and runtime errors); `pnpm check:full` — tests and production build passed; `git diff --check` — passed перед docs-only изменениями.
- Ручные проверки и устройства: только Playwright browser surrogate; ни физического устройства, ни ручных трёх независимых наблюдений, ни Meta Instant Games test context не заявлено.
- Выполненные критерии: сверены задачи TASK-0012–0021 и GDD функциональная матрица; автоматические suite/build/browser evidence зафиксированы; все ограничения, гипотезы и release conditions записаны; публикация не производилась.
- Непроверенное, блокеры и отклонения от плана: по прямому запросу пользователя waived предоставление телефона/замеров, независимых testers и Meta app/placement доступа. Читаемость 2.5D, p95/input/cold load/resources, usability, Meta/social/ads runtime остаются открытыми до публичного gate. Из-за waiver scope сужен до внутренней технической приёмки; отчёт не означает release readiness.
- Commit/push либо причина отсутствия: выполняется отдельным docs-only коммитом после финальной полной проверки.
- Итоговый статус и дата: done для внутреннего acceptance scope; public release gate — `rework`; 2026-10-07.
