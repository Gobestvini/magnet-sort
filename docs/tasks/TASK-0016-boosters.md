# TASK-0016: Добавить Undo, Hint и Extra Move с учётом assisted runs

- Статус: done
- Приоритет: normal
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: MVP
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения. Нужно снять неоднозначность правил/платформы и оценить доказательства.
- Зависимости: TASK-0012, TASK-0014

## 1. Цель и запрос пользователя

Наблюдаемый результат: добавить ограниченные per-run Undo, Hint и Extra Move; все использования помощи помечают забег assisted.
Исходный запрос: реализовать следующую задачу очереди после daily puzzle.
Авторские решения и расхождения источников см. `docs/design/DECISIONS.md`; актуальные правила бустеров — `docs/design/RULES.md`.

## 2. Проверенный контекст

Проверено повторно 2026-10-07. Зависимости TASK-0012 и TASK-0014 завершены; `src/game/scoring.js` уже задаёт assisted eligibility для `hint`, `undo`, `extraMove`. Модель хранит complete GameState snapshots и валидированные авторские решения на уровнях.

| Существующий файл / символ | Проверенное поведение | Роль в задаче |
| --- | --- | --- |
| src/scene.js / createScene | Пустой Canvas, elapsed; update/render/reset/snapshot/dispose | Точка интеграции игры |
| src/main.js / tick, reset, setPaused, dispose | Один RAF, resize, hidden, dev gameDebug | Lifecycle и браузерная диагностика |
| src/loop.js / createStepper | Шаг 1/60, максимум 8 шагов, alpha/dropped | Сохранить независимость от FPS |
| src/input.js / createInput | Только keyboard; blur/reset/dispose | Pointer input пока отсутствует |
| package.json | Vite 7.1.9; нет Pixi/Preact/runtime libraries | Проверенные команды запуска |
| tools/browser-check.cjs | Проверяет layout, pause/reset, keyboard, ошибки | Развить для игрового сценария при изменении UI |

Начать с `docs/design/DECISIONS.md`, затем прочитать целиком зависимости и только нужные исходники. Контракты `docs/design/RULES.md` и `ARCHITECTURE.md` создаются TASK-0001; использовать их после завершения этой зависимости. Точное устройство и бюджеты ещё не выбраны; GDD durations являются целями, не результатом измерений.

## 3. Область изменений

Визуальное направление Magnet Sort задают [GDD v0.2](../design/GDD_V0.2.md) и [PixiJS pseudo-2.5D rendering contract](../design/PIXI_RENDERING.md). Для графических изменений сохраняй PixiJS 8 и псевдо‑2.5D; не добавляй настоящую 3D-сцену. Если задача чисто модельная/аналитическая, не расширяй её область из-за рендерера. Для задач с PixiJS, вводом, ассетами, производительностью или lifecycle также сверяй применимые разделы `../knowledge/pixijs-practices.md`; не расширяй scope задач чистой модели/аналитики.


Допустимые изменения и новые файлы: src/game/boosters.js, src/game/history.js, src/ui/boosters.*, src/game/session.js; tests/boosters.test.js. Также обновлены `src/scene.js`, `src/main.js`, `src/ui/game-hud.js`, `src/ui/App.js`, `src/ui/result.js`, `src/style.css`, `tools/browser-check.cjs`, `docs/design/RULES.md`, `docs/PROJECT.md`, отчёт и INDEX — только для подключения и фиксации этих правил.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- Undo возвращает snapshot до последнего принятого хода, включая score/goal/magnet state/limit. Лимит использования определяется RULES; reset восстанавливает run без незаметного начисления бонусов.
- Hint возвращает легальный полезный action из bounded solver/валидированного solution prefix. Для состояния вне известного решения либо bounded search, либо честное unavailable; произвольный Action не выдавать за помощь.
- Extra Move прибавляет один ход только в допустимом lost-by-limit/playing состоянии, не после win/no-moves. Лимиты и цены использования фиксировать в RULES без виртуальной экономики.
- Общий grant callback для будущей rewarded интеграции. В standalone dev явно обозначить тестовый provider; сейчас не обещать просмотр реальной рекламы.
- Все boosts изменяют assisted state и challenge eligibility согласно контракту. Undo не может снять отметку помощи. Hint search отменяется при reset/dispose и имеет записанный предел работы.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [x] Undo возвращает полный snapshot GameState до последнего принятого хода, включая token/goal/score-source/magnet/limit; разрешён один раз, retry/reset полностью перезапускает попытку.
- [x] Hint возвращает только легальный следующий Action по точному префиксу авторского решения. Работа ограничена 16 Actions; вне префикса/без решения сообщает unavailable.
- [x] Extra Move прибавляет ровно один ход один раз за забег при конечном лимите и доступном legal placement в `playing` или `lost-by-limit`; не доступен для win/no-legal/unlimited. Цена — нет виртуальной экономики.
- [x] Общий grant callback подключён к явно обозначенному `standalone-test` provider; пользовательское обещание рекламы отсутствует.
- [x] Любая применённая помощь сохраняет assisted flag; это блокирует challenge comparison. Hint resolver ограничен и инвалидируется при reset/load/dispose; вычисление синхронно, фоновых jobs нет.
- [x] Unit/browser/full-check сценарии выполнены; waiver реального устройства указан в отчёте.
- [x] Поведение в границах задачи сохранено; отчёт и INDEX согласованы.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Выполнить pnpm test для поведения изменённых модулей; затем pnpm check:full (тесты + сборка). Ожидается exit 0; сохранять логи, в отчёт включить итог и ошибки.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- Unit: undo всех частей state, повторный grant, hint legality/usefulness, невозможный hint, extra move terminal cases, assisted не теряется.
- Браузер: ошибочный ход → undo → полезный hint → завершить; extra move rescue; challenge не сравнивает несовместимые assisted runs.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факты: пустой Canvas/keyboard-шаблон подтверждён кодом; GDD и общий диалог прочитаны как источники, а не инструкции. Рыночные цифры и обещания acquisition не используются как доказанные свойства игры.
Предложения автора: versioned чистая модель и события; 5 FTUE → прототипная проверка → 50 campaign уровней; standalone web fallback, затем подтверждённый SDK. Разрешённая область новых файлов выше остаётся предложением до выполнения зависимостей.
Реализация принята по доступным unit и browser surrogate; физическое устройство и внешний rewarded SDK не входят в текущую проверку.
Остановиться и записать blocked, если необходимое правило не определено, зависимость не завершена, требуется неподтверждённое API/секрет/недоступное внешнее evidence либо изменение соседней подсистемы. Подготовить независимую часть, не объявлять недоступное проверенным. Отсутствие Git/remote блокирует commit/push, но не разрешённую локальную работу.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0016-boosters.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни обязательные проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. При невыполненной зависимости или важном неизвестном запиши блокер; не помечай done при недоступной обязательной проверке. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: Введена booster policy v1: Undo, Hint и Extra Move ограничены одной активацией на попытку и явно влияют на assisted eligibility.
- Изменённые файлы и зачем: `src/game/boosters.js` — bounded hint prefix, разрешение grant и проверка extra move; `src/game/session.js` — snapshot/undo, hint lifecycle, assisted flags, extra move; `src/scene.js`, `src/main.js` — UI/runtime действия и временная фиксация editable loss до выбора Retry/Home; `src/ui/game-hud.js`, `src/ui/App.js`, `src/ui/result.js`, `src/style.css` — controls/notice; `tests/boosters.test.js`, `tools/browser-check.cjs` — модельные и браузерные сценарии; `docs/design/RULES.md`, `docs/PROJECT.md`, этот файл и INDEX — контракт/карта.
- Команды и фактические результаты: `pnpm test` — 102 passed, 0 failed; `pnpm test:browser` — passed на desktop и touch-emulation; `pnpm check:full` — exit 0, тесты и сборка прошли; `git diff --check` — без ошибок.
- Ручные проверки и устройства: браузерный сценарий прошёл в headless Chromium desktop/touch emulation. Реальный телефон/rewarded ad provider не запускались; waiver по просьбе пользователя. Внешняя реклама не заявляется.
- Выполненные критерии: snapshot undo; легальная подсказка из solution prefix ≤16 replays; extra move строго по фазам и legal availability; единый grant callback; assisted comparison gate; сброс per-run budget при retry.
- Непроверенное, блокеры и отклонения от плана: hint solver не ищет новый путь вне авторского решения, честно выдаёт unavailable; синхронный bounded replay не создаёт отложенную работу. Интеграция настоящего rewarded SDK и её внешние измерения остаются TASK-0021.
- Commit/push либо причина отсутствия: `Add per-run undo hint and extra move boosters`, отправлен в `origin/main`.
- Итоговый статус и дата: done, 2026-10-07.
