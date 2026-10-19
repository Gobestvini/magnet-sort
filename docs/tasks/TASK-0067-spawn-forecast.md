# TASK-0067: Показывать ближайшее пополнение поля

- Статус: ready
- Приоритет: high
- Создана: 2026-10-19
- Обновлена: 2026-10-19
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: средняя; высокий уровень рассуждения — небольшой read-only helper и согласование HUD с timeline.
- Зависимости: нет; можно до/после TASK-0066, редактировать общие runtime/App последовательно.

## 1. Цель и запрос пользователя

Игрок видит, через сколько принятых ходов появятся новые стопки и сколько запланировано. Сейчас пополнение происходит без счётчика → после изменения можно заранее решить, освобождать поле или собирать цель. Предложение автора по исходному запросу улучшения Telegram-билда.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Проверено чтением кода 2026-10-19, HEAD 2c77551ade5f790d4462a3d7e956ebe33ea65d5a. Активны Three.js0.186.1/Preact11/Vite7.1.9 и rules v4. Полный исходный запрос, ссылки на конкурентов и аудит наших игр: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md). Чужие локальные board.js, magnet-glow.js, draw-order.js и .codex-remote-attachments/ не включать и не откатывать. После изменения HEAD контекст перепроверить.

| Файл / символ | Проверенный факт / назначение |
| --- | --- |
| `src/prototype/model-v4.js::stacksForMove` | Возвращает 0/1/2/3 по будущему movesUsed и номеру уровня. |
| `src/prototype/difficulty.js::spawnInterval` | 1 на L1–6, 2 на L7–9, 3 на L10–12. |
| `src/prototype/runtime.js::ui/submit/tick` | Final state доступен раньше конца presentation; важен момент смены forecast. |
| `src/prototype/App.js::PrototypeApp` | HUD goal/MOVES, статус и tray уже занимают мобильную высоту. |
| `tests/progressive-spawn.test.js; tests/ten-range.test.js` | Проверяют текущий spawn и conservation. |

## 3. Область изменений

Новый pure helper src/prototype/spawn-forecast.js, runtime/App/prototype.css, tests/spawn-forecast.test.js, tools/spawn-forecast-browser-check.cjs и краткий отчёт. Не менять выдачу/RNG/радиусы/цели, не показывать будущие случайные клетки/цвета. Сохранить source light и мини-карты tray без новых подписей на магнитах.

Перед кодом прочитать AGENTS.md, docs/PROJECT.md и применить game-quality/ai-economy. Для input/render/lifecycle сверить docs/knowledge/pixijs-practices.md («Ввод», «Lifecycle») и legacy docs/design/PIXI_RENDERING.md; активный контракт — docs/design/THREE_RENDERING.md и GDD_V0.4. Сохранить чистую seeded модель, один clock, cancel/pause/reset/dispose, reduced motion. Чужую отрисовку не исправлять попутно.

## 4. Требуемое поведение

1. forecast(state) возвращает {turnsUntilSpawn, plannedCount} либо null для terminal. Искомое k — минимальное целое >=1 с stacksForMove(movesUsed+k,levelNumber)>0; plannedCount берётся для этого хода. Не считать по текущему заполнению поля: это план, а не обещание фактического числа.
2. Примеры: L1 moves=4 → 1 ход/+1; L1 moves=5 → 1/+2; L1 moves=10 → 1/+3; L7 moves=0 → 2/+1; L7 moves=1 → 1/+1; L10 moves=0 → 3/+1. Эти границы вывести из общего helpers, не захардкодить отдельные правила UI.
3. Английская короткая подпись: 'New stacks in 2 moves: +1' / 'New stacks next move: +2'; рядом доступное пояснение 'Up to this many stacks, if space remains'. Проверить, что singular/plural не создаёт непонятный текст.
4. В playing показывать forecast текущего board. Во время resolving держать before forecast до start первого segment с type='stackSpawned'; с этого момента переходить к after forecast. Если spawn в этом ходе отсутствует — менять на queueStart; для выигранного/проигранного after скрывать forecast по окончании хода. Поля timeline.spawnStart сейчас нет: вычислить границу из существующих segments, не обращаться к вымышленному свойству. Если spawn был ограничен свободными клетками, не утверждать, что прилетело plannedCount.
5. Данные derivation не тратят RNG и не зависят от FPS, hover/resize/audio/reduced. Invalid/cancel не сдвигают счётчик. Это текст/небольшие готовые иконки HUD, без второго RAF.
6. Новый элемент не перекрывает goal, MOVES, поле, tray или tutorial; long/short portrait и landscape. При нехватке места допустима компактная строка статуса. Не менять существующие картинки/порядок мини-карт.

## 5. План для исполнителя

1. Сверить segments/queueStart в makeTransferTimeline из motion.js и фактические пороги stacksForMove.
2. Написать pure derivation через существующие helpers, добавить boundary tests.
3. Передать отображаемый forecast из runtime в App, сохраняя before/after привязку.
4. Снять production portrait/landscape до/после accepted/cancel/reload и при reduced, заполнить отчёт/INDEX.

## 6. Критерии готовности

- [ ] На указанных границах HUD совпадает с реально следующим запланированным spawn.
- [ ] Счётчик не меняется от отменённого жеста и не перескакивает в начале collection.
- [ ] UI читается на 320×568, 390×844 и 844×390, controls доступны.
- [ ] Seed/actions дают тот же state/events до и после добавления UI.
- [ ] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; собственный commit/push/deploy выполнен по AGENTS.md.

## 7. Проверки

### Автоматические

Из корня проекта: node --test tests/spawn-forecast.test.js tests/progressive-spawn.test.js tests/ten-range.test.js; pnpm check:full; pnpm build:platforms; pnpm test:platforms. В helper tests проверить L1/7/10, пороги 5*N²/10*N² и terminal, отсутствие mutation/RNG. Browser tool проверяет соответствие текста стадиям реального хода.

Новые проверки подтверждают наблюдаемое поведение и регрессии, а не повторяют implementation. Полные логи остаются на диске. Финальные tests/build — pnpm check:full; квитанция не заменяет UI-критерии. Введённые новые commands/tools исполнитель добавляет только в указанных границах и документирует точный запуск.

### Ручные

Наблюдать два хода L7 и три L10, invalid drop, pause/resume во время collection, победу перед возможным spawn. На телефоне при наличии проверить читаемость; эмуляцию записать отдельно.

Проверка браузера, Telegram mock, настоящий Telegram и физический телефон имеют разные статусы. Без требуемой проверки не ставить done; записать review/блокер. Не запускать Telegram без пользовательского запроса; авторизация готовить задачу не авторизует сообщения другим людям.

## 8. Предположения, вопросы и условия остановки

Размещение компактной строки — локальный выбор исполнителя. Если новый принятый пресет поменял cadence, использовать его общий helper; не дублировать старую формулу.

Сначала проверить зависимости и реальный код, не трактовать исторические done MVP как выполненную функцию v4. Не расширять scope соседними улучшениями. При параллельных изменениях runtime/App согласовать последовательность; самовольно не откатывать. Опубликование по постоянному разрешению AGENTS.md касается своего проверенного коммита; не включать чужие файлы и не делать force push.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0067-spawn-forecast.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md и задачу целиком; проверь актуальность HEAD и зависимостей. Если статус draft, сначала проверь условия перевода в ready; при невыполненной зависимости реализацию не начинай. Примени game-quality и ai-economy, соблюди scope и критерии. Заполни раздел 10, обнови INDEX и соответствующий отчёт. Различай code/unit/build/browser/Telegram/phone и человеческую оценку. Заверши собственными commit/push/deploy по AGENTS.md; чужие изменения не трогай.
```

## 10. Отчёт исполнителя

- Результат: Не выполнялась.
- Изменённые файлы и зачем: —
- Команды и фактические результаты: —
- Ручные проверки: —
- Выполненные критерии: —
- Непроверенное, блокеры и отклонения от плана: —
- Итоговый статус и дата: —
