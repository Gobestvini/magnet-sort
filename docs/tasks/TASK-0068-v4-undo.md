# TASK-0068: Отменять весь последний ход v4

- Статус: draft
- Приоритет: high
- Создана: 2026-10-19
- Обновлена: 2026-10-19
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения — полный rollback RNG/спавна/очереди и связь с сохранением.
- Зависимости: TASK-0066 done и проверенный актуальный session/save contract; до этого не ready.

## 1. Цель и запрос пользователя

Ошибку можно исправить кнопкой Undo, включая проигрыш от заполнения поля. Отмена возвращает не только переставленные фишки, но и весь спавн/выдачу последнего хода. Переносится полезный сценарий White Tower/сортировок, не их код модели.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Проверено чтением кода 2026-10-19, HEAD 2c77551ade5f790d4462a3d7e956ebe33ea65d5a. Активны Three.js0.186.1/Preact11/Vite7.1.9 и rules v4. Полный исходный запрос, ссылки на конкурентов и аудит наших игр: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md). Чужие локальные board.js, magnet-glow.js, draw-order.js и .codex-remote-attachments/ не включать и не откатывать. После изменения HEAD контекст перепроверить.

| Файл / символ | Проверенный факт / назначение |
| --- | --- |
| `src/prototype/runtime.js::submit/reset/loadLevel` | Принятый ход синхронно заменяет state, затем timeline блокирует ввод. |
| `src/prototype/model-v4.js::applyV4Magnet` | RNG, nextUnitId, magnetRadii, queue, cleared, movesUsed — части одного перехода. |
| `src/prototype/App.js::PrototypeApp` | Новый Undo нужен в gameplay и lost result; won result уже фиксирует достижение. |
| `TASK-0066-v4-save-continue.md` | Определяет action-log, replay и assisted metadata; фактические символы после done перечитать. |

## 3. Область изменений

Session/save из 0066, runtime/App/prototype.css; tests/v4-undo.test.js и tools/undo-v4-browser-check.cjs. Не добавлять валюту, лимиты помощи, рекламу, Redo или обратную анимацию всех фишек. Не импортировать legacy Undo.

Перед кодом прочитать AGENTS.md, docs/PROJECT.md и применить game-quality/ai-economy. Для input/render/lifecycle сверить docs/knowledge/pixijs-practices.md («Ввод», «Lifecycle») и legacy docs/design/PIXI_RENDERING.md; активный контракт — docs/design/THREE_RENDERING.md и GDD_V0.4. Сохранить чистую seeded модель, один clock, cancel/pause/reset/dispose, reduced motion. Чужую отрисовку не исправлять попутно.

## 4. Требуемое поведение

1. Undo доступен в settled playing и lost при наличии accepted actions; disabled в loading/error/paused/resolving и после won. Один Undo убирает последнее accepted action; повторный до начального state разрешён.
2. Восстановить через replay укороченного action-log или проверенный snapshot-cache внутри owner: stacks/ID/RNG/nextUnitId/queue/radii/cleared/moves/spawnedUnits/terminal/stars должны совпасть с исходным before по всем полям.
3. Очистить timeline, collection, drag, hover, pending effects. displayedCleared немедленно равен восстановленному cleared; использовать общий безопасный presentation reset, без второго mount/RAF и без старых completion callbacks.
4. После Undo повтор того же действия даёт тот же spawn и очередь. Другое действие может дать другой результат по обычным правилам. Invalid/cancel не попадают в историю.
5. Использование Undo выставляет assisted=true монотонно для этой попытки, даже после нескольких отмен; сохранение не теряет признак. После Retry начинается новая attempt того же seed. В будущем daily/challenge показывают помощь и отделяют рекорд, не выдают его за unassisted.
6. Undo из lost возвращает playing; после won история этой попытки не откатывается кнопкой Undo. Рекорды уже завершённых уровней не уменьшать.
7. Кнопка с доступной подписью и touch target >=44 CSS px; keyboard focus и disabled понятны. При resumed attempt Undo должен работать по восстановленному журналу. Пока история пуста — disabled.

## 5. План для исполнителя

1. Дождаться 0066, перечитать её отчёт и проверить restore/replaceAttempt API; перевести в ready только после обновления точных символов.
2. Сделать одну операцию session.undo, сохраняющую новый журнал и assisted; runtime вызывает presentation reset.
3. Добавить HUD/lost controls и обработать disabled/focus, не перезаписывая campaign result.
4. Сравнить полные before/after/replay snapshots и провести production lifecycle-проверки; обновить отчёт/INDEX.

## 6. Критерии готовности

- [ ] После хода с очисткой, новым спавном и refill Undo восстанавливает весь before; повтор даёт идентичный after.
- [ ] Lost→Undo→playing и Undo до нуля работают, won Undo недоступен.
- [ ] Сохранение/reload не теряют историю/assisted, controls не проходят в поле.
- [ ] 20 reset/Undo/pause циклов не дают stale collection/накопления ресурсов.
- [ ] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; собственный commit/push/deploy выполнен по AGENTS.md.

## 7. Проверки

### Автоматические

Из корня проекта: node --test tests/v4-undo.test.js tests/progress-v4.test.js tests/ten-range.test.js; pnpm check:full; pnpm build:platforms; pnpm test:platforms; новый node tools/undo-v4-browser-check.cjs. Покрыть retained/new radii, zero seed, spawn thresholds, invalid/cancel, lost, resumed log и assisted.

Новые проверки подтверждают наблюдаемое поведение и регрессии, а не повторяют implementation. Полные логи остаются на диске. Финальные tests/build — pnpm check:full; квитанция не заменяет UI-критерии. Введённые новые commands/tools исполнитель добавляет только в указанных границах и документирует точный запуск.

### Ручные

Реальные UI действия pointer/tap/keyboard на 390×844 и 844×390: ход→Undo→повтор, lost→Undo, reload→Undo, pause/hidden. Проверку Telegram mock и настоящего клиента различать.

Проверка браузера, Telegram mock, настоящий Telegram и физический телефон имеют разные статусы. Без требуемой проверки не ставить done; записать review/блокер. Не запускать Telegram без пользовательского запроса; авторизация готовить задачу не авторизует сообщения другим людям.

## 8. Предположения, вопросы и условия остановки

Бесплатный неограниченный Undo внутри попытки — предложение автора для первой итерации. Невыполненная 0066 или несовпадение session contract блокирует старт; платежи/квоты требуют отдельного задания.

Сначала проверить зависимости и реальный код, не трактовать исторические done MVP как выполненную функцию v4. Не расширять scope соседними улучшениями. При параллельных изменениях runtime/App согласовать последовательность; самовольно не откатывать. Опубликование по постоянному разрешению AGENTS.md касается своего проверенного коммита; не включать чужие файлы и не делать force push.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0068-v4-undo.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md и задачу целиком; проверь актуальность HEAD и зависимостей. Если статус draft, сначала проверь условия перевода в ready; при невыполненной зависимости реализацию не начинай. Примени game-quality и ai-economy, соблюди scope и критерии. Заполни раздел 10, обнови INDEX и соответствующий отчёт. Различай code/unit/build/browser/Telegram/phone и человеческую оценку. Заверши собственными commit/push/deploy по AGENTS.md; чужие изменения не трогай.
```

## 10. Отчёт исполнителя

- Результат: Не выполнялась.
- Изменённые файлы и зачем: —
- Команды и фактические результаты: —
- Ручные проверки: —
- Выполненные критерии: —
- Непроверенное, блокеры и отклонения от плана: —
- Итоговый статус и дата: —
