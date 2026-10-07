# TASK-0013: Сделать Home и устойчивый локальный прогресс

- Статус: done
- Приоритет: normal
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: MVP
- Рекомендуемый исполнитель: средняя; высокий уровень рассуждения. Несколько ограниченных модулей с заданными контрактами; не нужен выбор общей архитектуры.
- Зависимости: TASK-0012

## 1. Цель и запрос пользователя

Наблюдаемый результат: сделать home и устойчивый локальный прогресс.
Исходный запрос: прочитать GDD v0.1 и диалог, разделить Magnet Sort на самостоятельные задачи для последующей работы. Этот файл — задание на будущий этап, реализация при подготовке не выполнялась.
Сейчас в проверенном проекте есть только пустой шаблон; после выполнения зависимостей ожидается результат соответствующего этапа. Авторские решения и расхождения источников см. `docs/design/DECISIONS.md`; GDD §§4–13 — продуктовая основа, §16 — порядок прототипирования.

## 2. Проверенный контекст

Проверено повторно 2026-10-07 после выполнения TASK-0012, commit `8cc0979`. Репозиторий чист перед задачей, ветка `main`, `origin` настроен. Текущий runtime — PixiJS 8.22.0 + Preact, сессия FTUE/prototype и проверенная кампания из 50 уровней; Home/progress ещё не было. `src/main.js` владеет app lifecycle и Pixi RAF, `src/game/session.js` — FTUE/result progression, `src/ui/App.js` — game controls/results. Решения кампании и формат LevelDefinition находятся в `docs/design/RULES.md`/`LEVELS.md`; FTUE закрывается только победой последнего урока.

| Существующий файл / символ | Проверенное поведение | Роль в задаче |
| --- | --- | --- |
| src/scene.js / createScene | FTUE/prototype session, scene reset/retry/next/dispose | Переход по сохранённому progress target; reset не удаляет progress |
| src/main.js / tick, initialize, renderUI | Один RAF, resize, hidden, Home/game screen, safe persistence | Сохранение завершённого результата и lifecycle |
| src/game/session.js / createSession | FTUE, campaign/prototype routes, retry/next/result | Продолжение с последнего открытого урока/уровня |
| src/game/levels.js / campaignLevelIds | 50 последовательных campaign puzzles | Разблокировка и продолжение кампании |
| src/game/scoring.js / compareRunResults | Единый comparator результата | Выбор best result без дублирования ranking |
| src/game/progress.js | На момент начала отсутствовал | Новый versioned local progress contract |
| src/ui/App.js / src/ui/result.js | Preact game HUD/tutorial/result | Переключение Home/game и возврат из результата |
| src/style.css / PixiJS 8.22.0 | Адаптивный DOM/Pixi интерфейс | Home layout и сохранение rendering/lifecycle |
| tools/browser-check.cjs | Desktop/mobile layout, FTUE, simulator, pause/reset, ошибки | Расширен на Home, refresh, corrupt storage, replay/continue |

Начать с `docs/design/DECISIONS.md`, затем прочитать целиком зависимости и только нужные исходники. Контракты `docs/design/RULES.md` и `ARCHITECTURE.md` создаются TASK-0001; использовать их после завершения этой зависимости. Точное устройство и бюджеты ещё не выбраны; GDD durations являются целями, не результатом измерений.

## 3. Область изменений

Визуальное направление Magnet Sort задают [GDD v0.2](../design/GDD_V0.2.md) и [PixiJS pseudo-2.5D rendering contract](../design/PIXI_RENDERING.md). Для графических изменений сохраняй PixiJS 8 и псевдо‑2.5D; не добавляй настоящую 3D-сцену. Если задача чисто модельная/аналитическая, не расширяй её область из-за рендерера. Для задач с PixiJS, вводом, ассетами, производительностью или lifecycle также сверяй применимые разделы `../knowledge/pixijs-practices.md`; не расширяй scope задач чистой модели/аналитики.


Изменения: `src/game/progress.js`, `src/ui/home.js`, `src/ui/App.js`, `src/game/session.js`, `src/scene.js`, `src/main.js`, `src/ui/result.js`, `src/style.css`; `tests/progress.test.js` и соответствующие session/browser regressions. Допустимы обновления карты `docs/PROJECT.md`, отчёта этой задачи и INDEX. Другие задачи очереди не включены.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- Home: Play/Continue, Daily и friend badge по доступности. Основное действие одно; первая сессия не проходит через большой menu или валюты.
- Хранить local progress с schemaVersion: unlocked campaign level, completed/best results, FTUE seen, настройки. Сохранение после подтверждённого результата, не после загрузки.
- Повреждённый JSON, storage quota/security error и неизвестная версия дают безопасный fallback без падения; миграция либо явный отказ по контракту. Reset попытки не стирает весь прогресс.
- Закрытие/refresh сохраняет законченное прохождение; возврат из result и replay пройденного уровня корректны. Нет пользовательских аккаунтов/облачной синхронизации.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [ ] Home: Play/Continue, Daily и friend badge по доступности. Основное действие одно; первая сессия не проходит через большой menu или валюты.
- [ ] Хранить local progress с schemaVersion: unlocked campaign level, completed/best results, FTUE seen, настройки. Сохранение после подтверждённого результата, не после загрузки.
- [ ] Повреждённый JSON, storage quota/security error и неизвестная версия дают безопасный fallback без падения; миграция либо явный отказ по контракту. Reset попытки не стирает весь прогресс.
- [ ] Закрытие/refresh сохраняет законченное прохождение; возврат из result и replay пройденного уровня корректны. Нет пользовательских аккаунтов/облачной синхронизации.
- [ ] Все сценарии раздела 7 выполнены с ожидаемым результатом; недоступные обязательные проверки явно перечислены и задача не помечена done.
- [ ] Существующее поведение в границах раздела 3 сохранено; отчёт и INDEX согласованы.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Выполнить pnpm test для поведения изменённых модулей; затем pnpm check:full (тесты + сборка). Ожидается exit 0; сохранять логи, в отчёт включить итог и ошибки.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- Unit: normal reload, corrupt data, unavailable storage, version mismatch, best-result comparator и bounds.
- Браузер: пройти уровень → refresh → Continue, затем повреждённый storage; игра запускается, Home не блокирует FTUE.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факты: пустой Canvas/keyboard-шаблон подтверждён кодом; GDD и общий диалог прочитаны как источники, а не инструкции. Рыночные цифры и обещания acquisition не используются как доказанные свойства игры.
Предложения автора: versioned чистая модель и события; 5 FTUE → прототипная проверка → 50 campaign уровней; standalone web fallback, затем подтверждённый SDK. Разрешённая область новых файлов выше остаётся предложением до выполнения зависимостей.
Зависимость TASK-0012 завершена и сверена. Реальный телефон не нужен для контракта localStorage; desktop/mobile browser checks и unit сценарии доступны. Нет аккаунтов/облака и платформенных интеграций.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0013-progress-navigation.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни обязательные проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. При невыполненной зависимости или важном неизвестном запиши блокер; не помечай done при недоступной обязательной проверке. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: добавлен Home с одним главным действием Play/Continue и schema-versioned локальным прогрессом. Продолжение FTUE сохраняет текущий урок; победа последнего урока или явный skip ведут к кампании с уровня 6.
- Изменённые файлы и зачем: `src/game/progress.js` — version 1, load/save, fallback, completed/best results, settings, unlock rules; `src/game/session.js`, `src/scene.js` — FTUE/campaign routes и возврат результата; `src/main.js` — Home lifecycle, запись terminal result/skip/settings; `src/ui/home.js`, `App.js`, `result.js`, `style.css` — Home, availability badges, Home action и настройки; `tests/progress.test.js`, `tests/ftue.test.js`, `tests/session.test.js`, `tools/browser-check.cjs` — persistence, progression, replay and browser regressions; `docs/PROJECT.md`, этот отчёт и INDEX — карта/evidence.
- Команды и фактические результаты: `pnpm test` — 87 passed, 0 failed; `pnpm test:browser` — desktop/mobile emulation passed: Home → FTUE → win → refresh → Continue, campaign unlock/Continue/replay/Home, corrupt JSON fallback, settings, disabled Daily/friend, reset persistence; `pnpm check:full` — exit 0, tests/build passed; `git diff --check` — passed.
- Ручные проверки и устройства: физический телефон не использовался; проверка браузера headless с mobile touch emulation, не заявляется как реальный телефон.
- Выполненные критерии: Play/Continue — единственное главное действие; Daily/friend недоступны и помечены «скоро»; schemaVersion хранит unlock, completed/best results, FTUE seen/completed/skipped/current lesson и setting; terminal outcome сохраняется после resolve, загрузка не записывает результат; malformed/version/storage failures дают safe fallback; retry/reset не очищает сохранённый progress; refresh resumes next FTUE lesson/campaign; replay и Home return работают.
- Непроверенное, блокеры и отклонения от плана: browser проверки эмулируют touch и не оценивают удобство на физическом устройстве. Реальные SDK, облако и аккаунты не входили в scope.
- Commit/push либо причина отсутствия: изменения TASK-0013 включены в коммит `Add Home and local progress` и отправлены в `origin/main`.
- Итоговый статус и дата: done, 2026-10-07.
