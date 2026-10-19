# TASK-0066: Сохранять и продолжать активную партию v4

- Статус: review
- Приоритет: high
- Создана: 2026-10-19
- Обновлена: 2026-10-19
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения — replay, версии данных и восстановление при прерванной анимации.
- Зависимости: нет; TASK-0065 не блокирует, его отдельные audio settings сохраняются.

## 1. Цель и запрос пользователя

Закрытие страницы или Mini App не теряет кампанию и текущую попытку. На чистом профиле остаётся быстрый вход в первый уровень; на существующем незавершённая партия продолжается, после победы предлагается следующий уровень. Это первый срез из запроса пользователя об улучшении Telegram-билда; полный запрос и сравнение игр — в отчёте TELEGRAM_IMPROVEMENT_IDEAS.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Проверено чтением кода 2026-10-19, HEAD 2c77551ade5f790d4462a3d7e956ebe33ea65d5a. Активны Three.js0.186.1/Preact11/Vite7.1.9 и rules v4. Полный исходный запрос, ссылки на конкурентов и аудит наших игр: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md). Чужие локальные board.js, magnet-glow.js, draw-order.js и .codex-remote-attachments/ не включать и не откатывать. После изменения HEAD контекст перепроверить.

| Файл / символ | Проверенный факт / назначение |
| --- | --- |
| `src/platforms/bootstrap.js::startGame` | Импортирует singleton runtime; здесь можно передать общие сервисы до старта. |
| `src/prototype/runtime.js::submit/reset/loadLevel/startRuntime` | State уже окончателен перед timeline; reset повторяет runSeed, startup всегда level 1. |
| `src/prototype/model-v4.js::createV4State/applyV4Magnet` | Seed+последовательность accepted actions полностью воспроизводят state/RNG/очередь. |
| `src/prototype/App.js::PrototypeApp` | Нет Home/level picker; текущий result последнего уровня предлагает Play from start. |
| `src/game/progress.js; ../White Tower/src/storage/save-schema.ts` | Первый файл legacy, второй — пример проверки данных; не импортировать чужую модель. |

## 3. Область изменений

Runtime/App и компактные новые src/prototype/session.js, progress-v4.js (либо равноценное деление), tests/progress-v4.test.js, tools/save-v4-browser-check.cjs; документация/отчёт задачи. Не менять правила/пороги, не добавлять Home, CloudStorage, account backend, audio store или карту уровней. Создать общий session owner без Telegram API.

Перед кодом прочитать AGENTS.md, docs/PROJECT.md и применить game-quality/ai-economy. Для input/render/lifecycle сверить docs/knowledge/pixijs-practices.md («Ввод», «Lifecycle») и legacy docs/design/PIXI_RENDERING.md; активный контракт — docs/design/THREE_RENDERING.md и GDD_V0.4. Сохранить чистую seeded модель, один clock, cancel/pause/reset/dispose, reduced motion. Чужую отрисовку не исправлять попутно.

## 4. Требуемое поведение

1. Новый ключ magnet-sort.v4.progress.v1, schemaVersion=1 и отдельный contentVersion. Envelope: lastLevelId, completedByLevel (bestStars 1..3), activeAttempt {levelId, seed:uint32, actions, assisted:boolean}; active mode пока только campaign. Поля расширять совместимо; legacy magnet-sort.progress и magnet-sort.audio.v1 не читать/не удалять.
2. Источником истины activeAttempt служат начальный seed и accepted actions {type:'placeMagnet',color,cell:{col,row}}. Восстанавливать через createV4State/applyV4Magnet, проверяя каждое accepted. Не доверять сохранённым числам cleared/stars/RNG. Максимум 2048 действий; при достижении лимита партия остаётся играбельной в памяти с понятным статусом сохранения.
3. Сохранять после accepted submit синхронно в том же обработчике, до первой анимации; при мгновенном закрытии восстановить конечный state без повторного перелёта/начисления. Cancel/invalid/drop/selection не создают actions. При чтении нет timeline/drag, displayedCleared=state.cleared.
4. Старт: incomplete active — восстановить ту же попытку; lost — восстановить поражение с Retry того же seed; won — идемпотентно записать bestStars и открыть следующий уровень с новым seed. После последнего won оставаться на итоговом результате, Play from start запускает новую попытку без удаления рекордов.
5. Валидировать версию, известный levelId, типы/диапазоны/координаты/цвета, непрерывность replay, запрет действий после terminal. Повреждённое/несовместимое сохранение не перезаписывать молча: играть в memory, показать краткое сообщение в паузе и отдельное добровольное Start fresh save. Не блокировать поле ошибкой storage.
6. Доступ к localStorage может бросать и на чтении, и на записи. Одна атомарная запись envelope, никаких зеркал. Ошибки quota/denied оставляют игру рабочей; не обещать перенос между устройствами. Отдельный namespace на origin сохраняет другие игры.
7. При двух вкладках не перетирать новую чужую запись: optimistic revision/read-before-write; обнаружив изменение с другой вкладки, перейти в memory и предложить reload. Это защита обычного конфликта, не обещание полной межпроцессной транзакции.
8. Session owner должен уметь предоставить/заменить активную attempt и получить replay-state; будущие daily/challenge смогут запускать transient attempt без записи campaign. Не реализовывать эти режимы сейчас. При валидированном URL seed в browser fixtures использовать временную попытку, не перетирать реальный campaign save.

## 5. План для исполнителя

1. Проверить новый HEAD, current entry, отсутствие смешивания с TASK-0065 и чужими renderer-изменениями; зафиксировать contentVersion для нынешних правил.
2. Реализовать чистые normalize/replay/save-result helpers и общий session owner; сначала проверить replay и повреждённые данные.
3. Связать submit/reset/next/startRuntime с owner до монтажа готового поля; сохранить итог accepted submit до timeline, не serialise presentation.
4. Добавить компактный storage status/recovery в pause, не менять первый запуск и control layout без необходимости.
5. Проверить сценарии ниже, обновить docs/PROJECT.md и docs/reports/V4_SAVE_CONTINUE.md, раздел 10 и INDEX.

## 6. Критерии готовности

- [x] Закрытие сразу после accepted placement и во время collection восстанавливает идентичный state без дубля прогресса.
- [x] Повторный старт после won/последнего won и после lost имеет заданное поведение; Retry сохраняет seed.
- [x] Повреждённый save, denied/quota и обычный конфликт вкладок не ломают игру и не стирают запись молча.
- [x] Legacy/audio keys и чужие изменения сохранены; web/embed/Telegram используют общий owner.
- [x] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; собственный commit/push/deploy выполнен по AGENTS.md.

- [ ] Реальный Telegram close/reopen на физическом телефоне — review.

## 7. Проверки

### Автоматические

Из корня проекта: node --test tests/progress-v4.test.js tests/prototype-v4.test.js tests/ten-range.test.js; pnpm check:full; pnpm build:platforms; pnpm test:platforms. Новый tools/save-v4-browser-check.cjs должен сам обслуживать production build или документировать GAME_BASE_URL. В unit покрыть replay, terminal/overflow/2048 boundary, version/types и storage throws/conflict.

Новые проверки подтверждают наблюдаемое поведение и регрессии, а не повторяют implementation. Полные логи остаются на диске. Финальные tests/build — pnpm check:full; квитанция не заменяет UI-критерии. Введённые новые commands/tools исполнитель добавляет только в указанных границах и документирует точный запуск.

### Ручные

Production web и Telegram mock bridge: accepted→reload на разных стадиях, lost→reload→Retry, won→reload дважды, final won, Reset, denied/quota, две вкладки; 390×844 и 844×390, keyboard/tap. Реальное закрытие/открытие Telegram на телефоне — отдельная проверка, при недоступности явно review без выдачи mock за телефон.

Проверка браузера, Telegram mock, настоящий Telegram и физический телефон имеют разные статусы. Без требуемой проверки не ставить done; записать review/блокер. Не запускать Telegram без пользовательского запроса; авторизация готовить задачу не авторизует сообщения другим людям.

## 8. Предположения, вопросы и условия остановки

Схема и UX recovery — предложения автора, достаточные для реализации. Не мигрировать v2/v3. При другом runtime/state контракте актуализировать задачу; если требуется account sync или автоматическое удаление повреждённого save, остановить расширение scope.

Сначала проверить зависимости и реальный код, не трактовать исторические done MVP как выполненную функцию v4. Не расширять scope соседними улучшениями. При параллельных изменениях runtime/App согласовать последовательность; самовольно не откатывать. Опубликование по постоянному разрешению AGENTS.md касается своего проверенного коммита; не включать чужие файлы и не делать force push.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0066-v4-save-continue.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md и задачу целиком; проверь актуальность HEAD и зависимостей. Если статус draft, сначала проверь условия перевода в ready; при невыполненной зависимости реализацию не начинай. Примени game-quality и ai-economy, соблюди scope и критерии. Заполни раздел 10, обнови INDEX и соответствующий отчёт. Различай code/unit/build/browser/Telegram/phone и человеческую оценку. Заверши собственными commit/push/deploy по AGENTS.md; чужие изменения не трогай.
```

## 10. Отчёт исполнителя

- Результат: Реализован общий session/replay-save, техническая часть завершена; review для реального закрытия/открытия Telegram на физическом телефоне.
- Изменённые файлы и зачем: progress-v4.js/session.js — schema/replay/storage/entry policy; runtime/App/prototype.css — интеграция и статус; tests/progress-v4.test.js/tools/save-v4-browser-check.cjs — поведение и отказы.
- Команды и фактические результаты:24 релевантных tests PASS; общий pnpm check:full239/239 + build PASS; build:platforms PASS. Подробнее docs/reports/V4_SAVE_CONTINUE.md.
- Ручные проверки: Codex browser pause/save status, production web/Telegram mock390×844/844×390; immediate reload, won/lost/final, recovery, две вкладки и denied/quota.
- Выполненные критерии: технические критерии выполнены, старые audio/legacy keys не затронуты; доставка общего коммита и published smoke отражены в финальном ответе.
- Непроверенное, блокеры и отклонения от плана: физический телефон/настоящий Telegram close/reopen недоступны; mock не объявлен их заменой. LocalStorage conflict protection optimistic, без CAS.
- Итоговый статус и дата: review,2026-10-19.
