# TASK-0020: Подключить Instant Games и доступные социальные функции

- Статус: done (с waiver реального Instant Games test context по разрешению пользователя)
- Приоритет: normal
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: MVP / платформа
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения. Нужно снять неоднозначность правил/платформы и оценить доказательства.
- Зависимости: TASK-0014, TASK-0015, TASK-0018, TASK-0019

## 1. Цель и запрос пользователя

Наблюдаемый результат: подключить instant games и доступные социальные функции.
Исходный запрос: прочитать GDD v0.1 и диалог, разделить Magnet Sort на самостоятельные задачи для последующей работы. Этот файл — задание на будущий этап, реализация при подготовке не выполнялась.
Сейчас в проверенном проекте есть только пустой шаблон; после выполнения зависимостей ожидается результат соответствующего этапа. Авторские решения и расхождения источников см. `docs/design/DECISIONS.md`; GDD §§4–13 — продуктовая основа, §16 — порядок прототипирования.

## 2. Проверенный контекст

Проверено 2026-10-07. Git-репозитория в папке и родителях нет; ревизия/ветка/remote недоступны. До подготовки этой очереди `docs/tasks/INDEX.md` был пуст. Проверенные исходники не изменялись; создавались только документы задач/источников. Будущие модули ниже — предложенные пути, их существование пока не подтверждено.

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


Допустимые изменения и новые файлы: src/platform/facebook.js, src/platform/standalone.js, src/main.js, src/social/*, src/ui/daily.*; tests/platform.test.js. Допустимы соответствующие поведенческие тесты `tests/*.test.js`, обновление карты `docs/PROJECT.md`, отчёта этой задачи и INDEX. Равноценные небольшие модули разрешены при сохранении контрактов и записи путей в отчёте.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- Использовать только APIs, подтверждённые TASK-0019, с runtime getSupportedAPIs/capability checks по контракту; loader progress/initialize/start связываются с реально готовыми ресурсами.
- SDK entry data запускает точно challenge/daily board; отсутствие SDK оставляет standalone web игру. Отказ init/network/share/context не блокирует retry и не теряет local progress.
- Friend ranking и rematch/update подключить при реальной поддержке и доступе: реальные значения, comparator/assisted policy. Уведомление/приглашение только по явному действию игрока; автоматической рассылки нет.
- Trust: локальный replay не делает server-verified leaderboard; при требованиях trusted scores нужен отдельный backend design, и эта часть остаётся blocked до решения. Не добавлять свои аккаунты.
- Реальный test context необходим для completion social flow. Если возможности урезаны платформой, обновить scope/критерии после решения; недоступное не выдавать за реализованное.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [ ] Использовать только APIs, подтверждённые TASK-0019, с runtime getSupportedAPIs/capability checks по контракту; loader progress/initialize/start связываются с реально готовыми ресурсами.
- [ ] SDK entry data запускает точно challenge/daily board; отсутствие SDK оставляет standalone web игру. Отказ init/network/share/context не блокирует retry и не теряет local progress.
- [ ] Friend ranking и rematch/update подключить при реальной поддержке и доступе: реальные значения, comparator/assisted policy. Уведомление/приглашение только по явному действию игрока; автоматической рассылки нет.
- [ ] Trust: локальный replay не делает server-verified leaderboard; при требованиях trusted scores нужен отдельный backend design, и эта часть остаётся blocked до решения. Не добавлять свои аккаунты.
- [ ] Реальный test context необходим для completion social flow. Если возможности урезаны платформой, обновить scope/критерии после решения; недоступное не выдавать за реализованное.
- [ ] Все сценарии раздела 7 выполнены с ожидаемым результатом; недоступные обязательные проверки явно перечислены и задача не помечена done.
- [ ] Существующее поведение в границах раздела 3 сохранено; отчёт и INDEX согласованы.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Выполнить pnpm test для поведения изменённых модулей; затем pnpm check:full (тесты + сборка). Ожидается exit 0; сохранять логи, в отчёт включить итог и ошибки.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- Unit adapter mocks: supported/absent/rejection/timeout, entry round-trip, no duplicate calls и fallback.
- Обязателен реальный Instant Games test context: start, challenge entry, share cancel, доступный friend ranking/rematch. Mock/headless не заменяет эту проверку; публичный релиз не входит.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факты: пустой Canvas/keyboard-шаблон подтверждён кодом; GDD и общий диалог прочитаны как источники, а не инструкции. Рыночные цифры и обещания acquisition не используются как доказанные свойства игры.
Предложения автора: versioned чистая модель и события; 5 FTUE → прототипная проверка → 50 campaign уровней; standalone web fallback, затем подтверждённый SDK. Разрешённая область новых файлов выше остаётся предложением до выполнения зависимостей.
Статус draft: зависимости ещё не выполнены. Переводить ready только после чтения отчётов зависимостей, проверки кода/контрактов и актуализации этого задания.
Остановиться и записать blocked, если необходимое правило не определено, зависимость не завершена, требуется неподтверждённое API/секрет/недоступное внешнее evidence либо изменение соседней подсистемы. Подготовить независимую часть, не объявлять недоступное проверенным. Отсутствие Git/remote блокирует commit/push, но не разрешённую локальную работу.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0020-facebook-social.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни обязательные проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. При невыполненной зависимости или важном неизвестном запиши блокер; не помечай done при недоступной обязательной проверке. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: подключён feature-detected Instant Games adapter с изолированным standalone fallback; игровой цикл не зависит от доступности SDK.
- Изменённые файлы и зачем: `src/platform/facebook.js` — bounded SDK calls, API allowlist, безопасная обработка init/start, challenge/daily entry, share, unverified leaderboard, ads surface и pause cleanup; `src/platform/standalone.js` — локальный fallback; `src/main.js` — runtime lifecycle, entry, share и snapshot; `tests/platform.test.js` — adapter mocks; `docs/design/PLATFORM_CONTRACT.md`, `docs/PROJECT.md`, `docs/tasks/INDEX.md` и этот отчёт — фактическая граница интеграции.
- Команды и фактические результаты: `pnpm test` — 115/115 passed; `pnpm test:browser` — desktop/mobile layout, pause/reset, input and runtime errors passed; `pnpm check:full` — tests and build passed; `git diff --check` — passed.
- Ручные проверки и устройства: Playwright browser surrogate, включая мобильные viewport сценарии. Реальный телефон и Meta Instant Games test app/context не запускались.
- Выполненные критерии: feature checks, init/start, loader progress, validated challenge/daily entry, explicit challenge share with existing Web fallback, standalone availability, timeout/rejection handling, pause listener cleanup, no trusted-score claim.
- Непроверенное, блокеры и отклонения от плана: по прямому разрешению пользователя реальные app/dashboard/test-context проверки waived. Нет appId/access, board ID/trust policy и ad placement. Adapter mocks не являются evidence работы в Meta; friend ranking остаётся выключен в UI; ads не активированы; внешний upload/publishing не выполнялся.
- Commit/push либо причина отсутствия: выполняется после проверки этого отчёта.
- Итоговый статус и дата: done с явно ограниченным evidence, 2026-10-07.
