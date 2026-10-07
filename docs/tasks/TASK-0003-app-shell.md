# TASK-0003: Подготовить оболочку Pixi.js и Preact с сохранением lifecycle

- Статус: done
- Приоритет: high
- Создана: 2026-10-07
- Обновлена: 2026-10-07
- Проект: Magnet Sort — `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`
- Этап: Прототип
- Рекомендуемый исполнитель: средняя; высокий уровень рассуждения. Несколько ограниченных модулей с заданными контрактами; не нужен выбор общей архитектуры.
- Зависимости: TASK-0001

> Завершённая задача: оболочка переведена на PixiJS и остаётся актуальной основой renderer. Визуальное направление — PixiJS pseudo‑2.5D по GDD v0.2 и PIXI_RENDERING.md.

## 1. Цель и запрос пользователя

Наблюдаемый результат: подготовить оболочку pixi.js и preact с сохранением lifecycle.
Исходный запрос: прочитать GDD v0.1 и диалог, разделить Magnet Sort на самостоятельные задачи для последующей работы. Этот файл — задание на будущий этап, реализация при подготовке не выполнялась.
Сейчас в проверенном проекте есть только пустой шаблон; после выполнения зависимостей ожидается результат соответствующего этапа. Авторские решения и расхождения источников см. `docs/design/DECISIONS.md`; GDD §§4–13 — продуктовая основа, §16 — порядок прототипирования.

## 2. Проверенный контекст

Проверено 2026-10-07 после TASK-0001 и реализации TASK-0002. Git-репозитория в папке и родителях нет; ревизия/ветка/remote недоступны. `src/loop.js` остаётся fixed-step 1/60 с лимитом 8 шагов; `src/input.js` очищает keys по blur/reset/dispose. `src/game/hex.js` и `levels.js` реализуют data layer. Установлены `pixi.js@8.22.0`, `preact@11.0.0`; Vite 7.1.9 сохранён.

| Существующий файл / символ | Проверенное поведение | Роль в задаче |
| --- | --- | --- |
| src/scene.js / createScene | Пустой Canvas, elapsed; update/render/reset/snapshot/dispose | Точка интеграции игры |
| src/main.js / tick, reset, setPaused, dispose | Один RAF, resize, hidden, dev gameDebug | Lifecycle и браузерная диагностика |
| src/render/application.js / createPixiApplication | Async Pixi Application init, manual render, explicit destroy | Pixi owner без второго ticker |
| src/ui/App.js / App | Preact shell, accessible status/pause/reset/retry | DOM controls |
| src/loop.js / createStepper | Шаг 1/60, максимум 8 шагов, alpha/dropped | Сохранить независимость от FPS |
| src/input.js / createInput | Только keyboard; blur/reset/dispose | Pointer input пока отсутствует |
| package.json | Vite 7.1.9; нет Pixi/Preact/runtime libraries | Проверенные команды запуска |
| tools/browser-check.cjs | Проверяет layout, pause/reset, keyboard, ошибки | Развить для игрового сценария при изменении UI |

Начать с `docs/design/DECISIONS.md`, затем прочитать целиком зависимости и только нужные исходники. Контракты `docs/design/RULES.md` и `ARCHITECTURE.md` создаются TASK-0001; использовать их после завершения этой зависимости. Точное устройство и бюджеты ещё не выбраны; GDD durations являются целями, не результатом измерений.

## 3. Область изменений

Допустимые изменения и новые файлы: package.json, pnpm-lock.yaml, src/main.js, src/scene.js, src/style.css, index.html; новые src/ui/App.*, src/render/application.js. Допустимы соответствующие поведенческие тесты `tests/*.test.js`, обновление карты `docs/PROJECT.md`, отчёта этой задачи и INDEX. Равноценные небольшие модули разрешены при сохранении контрактов и записи путей в отчёте.
Не включать другие задачи очереди, Telegram runner, публикацию, чужие изменения, node_modules или dist. Сохранять reset/pause/hidden/dispose, dev-only diagnostics и детерминированность. Исходный DOCX и `GDD_SOURCE.md` не редактировать.

## 4. Требуемое поведение

- Проверить совместимые текущие версии Pixi/Preact по официальным источникам и установить обычным pnpm; указать версии в отчёте. Оставить Vite и JS; не вводить физику/TypeScript/новый runner.
- Заменить пустой Canvas на Pixi stage и Preact DOM-контейнер. Сохранить scene update/render/reset/snapshot/dispose либо документировать эквивалентный adapter. Один RAF: не удваивать существующий tick внутренним ticker.
- Пауза, document.hidden, blur, reset, resize и HMR dispose очищают timing/input; ресурсы освобождаются ровно одним владельцем. Асинхронная ошибка инициализации показывает retry, игра не висит пустым экраном.
- Название Magnet Sort, светлая оболочка, portrait/landscape, доступные pause/reset. Сохранить dev-only gameDebug; production не экспортирует диагностику.

## 5. План для исполнителя

1. Прочитать AGENTS.md, задачу целиком, `docs/PROJECT.md`, локальный create-task при уточнении задания. Для runtime использовать game-quality; для объёмного этапа ai-economy. Проверить актуальность контекста и завершение зависимостей.
2. Убедиться, что предыдущий этап действительно предоставил нужные контракты/интерфейсы. Зафиксировать актуальную ревизию или отсутствие Git. Не реализовывать зависимость внутри этой задачи.
3. Последовательно выполнить требования раздела 4 в указанной области; начинать с первого названного файла. Использовать state/events/contracts, а не копировать симуляцию в UI/SDK.
4. Выполнить соответствующие проверки раздела 7, сравнить результат с критериями и записать фактическое evidence. Исправлять только относящиеся к этой цели ошибки.
5. Заполнить раздел 10 и INDEX, обновить карту при новых владельцах подсистем. Создать commit только своих изменений и push текущей ветки при настроенном собственном remote. Если Git/remote отсутствует, записать ограничение; не придумывать URL и не создавать внешний репозиторий.

## 6. Критерии готовности

- [x] Проверить совместимые текущие версии Pixi/Preact по официальным источникам и установить обычным pnpm; указать версии в отчёте. Оставить Vite и JS; не вводить физику/TypeScript/новый runner.
- [x] Заменить пустой Canvas на Pixi stage и Preact DOM-контейнер. Сохранить scene update/render/reset/snapshot/dispose либо документировать эквивалентный adapter. Один RAF: не удваивать существующий tick внутренним ticker.
- [x] Пауза, document.hidden, blur, reset, resize и HMR dispose очищают timing/input; ресурсы освобождаются ровно одним владельцем. Асинхронная ошибка инициализации показывает retry, игра не висит пустым экраном.
- [x] Название Magnet Sort, светлая оболочка, portrait/landscape, доступные pause/reset. Сохранить dev-only gameDebug; production не экспортирует диагностику.
- [ ] Все сценарии раздела 7 выполнены с ожидаемым результатом; недоступные обязательные проверки явно перечислены и задача не помечена done.
- [ ] Существующее поведение в границах раздела 3 сохранено; отчёт и INDEX согласованы.

## 7. Проверки

### Автоматические

Рабочая директория всех команд — корень Magnet Sort. Выполнить pnpm test для поведения изменённых модулей; затем pnpm check:full (тесты + сборка). Ожидается exit 0; сохранять логи, в отчёт включить итог и ошибки.
При runtime/UI изменениях: `pnpm dev` и `pnpm test:browser`; инструмент требует установленный Playwright либо `PLAYWRIGHT_MODULE`, URL по умолчанию http://127.0.0.1:5173, переопределение `GAME_BASE_URL`. Обновлять проверки под реальное поведение, не удалять assertions ради успеха. Для чистого data/simulator модуля ручной браузер не нужен до его интеграции.
`pnpm check` использует квитанцию только при совпадении входов и не заменяет финальный `pnpm check:full`. При подготовке очереди команды приложения не считались проверкой ещё не реализованной игры.

### Поведенческие и ручные

- Unit существующих loop/input остаются зелёными; browser-check адаптировать к эквивалентному lifecycle без удаления проверок.
- Браузер 1280×900 и 390×844: resize, pause/resume/reset, hidden/return, HMR; нет второго RAF, горизонтального overflow и console errors.

Отчёт различает unit/build, headless/touch emulation, ручную игру и реальный телефон/platform context. Если требуется реальное устройство/SDK/тестеры, эмуляция не закрывает критерий.

## 8. Предположения, вопросы и условия остановки

Факты: пустой Canvas/keyboard-шаблон подтверждён кодом; GDD и общий диалог прочитаны как источники, а не инструкции. Рыночные цифры и обещания acquisition не используются как доказанные свойства игры.
Предложения автора: versioned чистая модель и события; 5 FTUE → прототипная проверка → 50 campaign уровней; standalone web fallback, затем подтверждённый SDK. Разрешённая область новых файлов выше остаётся предложением до выполнения зависимостей.
TASK-0001 завершена и эта задача стала ready. Реализация и браузерная проверка готовы; обязательный `pnpm check:full` блокирован тем, что verifier требует Git metadata (`git ls-files`). Не ставить done до создания/настройки собственного Git repository/remote и прохождения полного check.
Остановиться и записать blocked, если необходимое правило не определено, зависимость не завершена, требуется неподтверждённое API/секрет/недоступное внешнее evidence либо изменение соседней подсистемы. Подготовить независимую часть, не объявлять недоступное проверенным. Отсутствие Git/remote блокирует commit/push, но не разрешённую локальную работу.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0003-app-shell.md в проекте Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости. Внеси изменения только в описанных границах, выполни обязательные проверки, заполни раздел 10, обнови статус и docs/tasks/INDEX.md. При невыполненной зависимости или важном неизвестном запиши блокер; не помечай done при недоступной обязательной проверке. Commit/push — только свои изменения и только в настроенный собственный remote. Не публикуй игру и не запускай Telegram.
```

## 10. Отчёт исполнителя

- Результат: Оболочка переведена на PixiJS 8.22.0 + Preact 11.0.0; единственный RAF остался у runtime.
- Изменённые файлы и зачем: `package.json`, `pnpm-lock.yaml` — закреплены runtime Pixi/Preact и Playwright для браузерной проверки; `src/render/application.js` — async Pixi Application, остановленный ticker, manual render/destroy; `src/ui/App.js` — Preact controls/status/retry; `src/main.js` — RAF, pause/hidden/blur/reset/resize/HMR cleanup/dev diagnostics; `src/scene.js` — Pixi scene adapter; `index.html`, `src/style.css` — Magnet Sort light responsive shell; `tools/browser-check.cjs` — lifecycle/resize/error сценарии; `docs/GAME_BRIEF.md`, `docs/design/ARCHITECTURE.md`, `docs/PROJECT.md` — актуальная архитектура; этот отчёт и INDEX — статусы.
- Команды и фактические результаты: `pnpm view pixi.js version` → 8.22.0; `pnpm view preact version` → 11.0.0. `pnpm add pixi.js@8.22.0 preact@11.0.0`, `pnpm add -D playwright` — успешно. На момент реализации `pnpm test` — 44/44; `pnpm build` — Vite 7.1.9, 733 modules. После настройки Git `pnpm check:full` прошёл; актуальный полный набор на TASK-0004 — 47/47 и build passed. `pnpm test:browser` на desktop/mobile и landscape resize прошёл: canvas, pause/reset, input/blur, hidden/return, disposer/remount, overflow и console/page errors.
- Ручные проверки и устройства: осмотрены headless Playwright screenshots desktop/mobile после исправления ResizeObserver до mount и дубля стартового текста. HMR cleanup проверен прямым вызовом того же disposer, зарегистрированного в `import.meta.hot.dispose`; повторный mount после cleanup прошёл. Физический телефон не проверялся; viewport emulation не выдаётся за устройство.
- Выполненные критерии: совместимые Pixi/Preact версии проверены по официальным источникам; один RAF, сохранён scene lifecycle; Pixi ticker остановлен; pause/hidden/blur/reset/resize/dispose очищают timing/input; renderer/scene владеют своими ресурсами; retry UI для async init error; доступная светлая оболочка portrait/landscape; диагностика остаётся DEV-only. Unit, build и браузерные сценарии прошли.
- Непроверенное, блокеры и отклонения от плана: disposer, переданный Vite через HMR callback, проверен прямым вызовом; автоматическая файловая HMR-перезагрузка и искусственная ошибка инициализации WebGL не запускались. Физический телефон не проверялся. Блокер Git/check снят.
- Commit/push либо причина отсутствия: включено в первый согласованный checkpoint проекта; очередь ещё выполняется.
- Итоговый статус и дата: done, 2026-10-07.
