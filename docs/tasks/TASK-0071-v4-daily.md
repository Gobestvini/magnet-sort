# TASK-0071: Добавить отдельную доску дня v4

- Статус: draft
- Приоритет: normal
- Создана: 2026-10-19
- Обновлена: 2026-10-19
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения — версия контента, UTC rotation и изоляция режимов.
- Зависимости: TASK-0066 и TASK-0068 done; TASK-0069 с принятым человеком коротким пресетом и отдельным зафиксированным решением внедрения. До этого не ready.

## 1. Цель и запрос пользователя

Игрок возвращается к одной короткой доске дня, общей для данной версии игры; кампания и её незаконченная партия сохранены. Вдохновение — legacy daily Magnet Sort, адаптированный под активный seeded цикл.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Проверено чтением кода 2026-10-19, HEAD 2c77551ade5f790d4462a3d7e956ebe33ea65d5a. Активны Three.js0.186.1/Preact11/Vite7.1.9 и rules v4. Полный исходный запрос, ссылки на конкурентов и аудит наших игр: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md). Чужие локальные board.js, magnet-glow.js, draw-order.js и .codex-remote-attachments/ не включать и не откатывать. После изменения HEAD контекст перепроверить.

| Файл / символ | Проверенный факт / назначение |
| --- | --- |
| `src/social/daily.js::getDailyPuzzle` | Старый UTC rotation использует src/game/levels.js и несовместим с текущими правилами. |
| `src/prototype/runtime.js::loadLevel; levels-v4.js` | Пока одна singleton-партия кампании. |
| `TASK-0066-v4-save-continue.md; TASK-0068-v4-undo.md` | Session/assisted/restore boundaries, которые должны реально существовать до старта. |
| `TASK-0069-telegram-session-pace.md` | Требуемый короткий preset ещё не принят; не использовать произвольный L12 для daily. |

## 3. Область изменений

Новые src/prototype/daily-v4.js и reviewed daily catalog/presets; расширение session/progress и небольшой entry в pause/result, отдельный result с Return to campaign; tests/daily-v4.test.js и tools/daily-v4-browser-check.cjs. Без рейтинга, сервера, платежей/экономики, рассылки и CloudStorage.

Перед кодом прочитать AGENTS.md, docs/PROJECT.md и применить game-quality/ai-economy. Для input/render/lifecycle сверить docs/knowledge/pixijs-practices.md («Ввод», «Lifecycle») и legacy docs/design/PIXI_RENDERING.md; активный контракт — docs/design/THREE_RENDERING.md и GDD_V0.4. Сохранить чистую seeded модель, один clock, cancel/pause/reset/dispose, reduced motion. Чужую отрисовку не исправлять попутно.

## 4. Требуемое поведение

1. Сначала зафиксировать immutable daily catalog из 30 проверенных {levelId,seed,contentVersion,presetId}; у каждой доски есть проверенный победный replay на общем simulator. Параметры утверждённого короткого пресета указать в задаче перед ready; cutoff=unknown, не unsolvable. Не менять catalog задним числом под тем же version.
2. getDaily(instant) использует UTC YYYY-MM-DD, epoch2026-01-01 и неотрицательный modulo30 для индекса. Одна дата+версия → одна доска на всех устройствах. Дата закрепляется на старте попытки: переход через полночь не заменяет поле посередине.
3. Вход через добровольную Daily кнопку. До входа сохранить кампанию; daily — отдельная attempt с seed/actions/assisted. Возврат восстанавливает campaign state/selection/history. Reload daily может открыть её же, но campaign envelope не меняется.
4. Локальные результаты по date/version: bestUnassisted и bestAssisted отдельно; сначала победа, затем меньше moves, tie — сохранить ранний результат. В result текст 'Local best'; нет 'world rank' или подтверждённого рекорда.
5. Показывать 7-дневный календарь завершений. Пропуск не отнимает награды/доступ/прогресс; retry одного дня не начисляет повторное completion. Историю ограничить последними90 днями, без большой валютной системы.
6. Смена часов устройства может менять доступный день: это клиентский режим без призов. Валидировать сохранённую дату, двойной entry, unknown catalog/content version. Несовместимая доска даёт понятный Return/Update, не молчаливый другой seed.
7. Кнопки Retry/Return/Hint/Undo работают в своём режиме; победа не открывает campaign level. После ежедневной победы Next campaign не показывать. Audio остаётся общим настройкам, не дублируется.

## 5. План для исполнителя

1. Проверить зависимости и решение о коротком preset; заполнить catalog version/preset numbers и обновить task до ready.
2. Проверить30 witnesses, написать pure UTC/catalog/result logic.
3. Связать transient session + отдельное сохранение daily с кнопками входа/выхода; campaign suspend/restore.
4. Провести midnight/reload/assisted flow, заполнить docs/reports/V4_DAILY.md и INDEX.

## 6. Критерии готовности

- [ ] Одна UTC-дата/версия даёт одинаковый seed/layout и прошедший replay.
- [ ] Midnight не меняет активную attempt; повтор не удваивает completion.
- [ ] Вход/выход/reload daily сохраняют campaign, Undo и настройки.
- [ ] Рекорды разделены по помощи; local/client limitations видимы и не маскируются рейтингом.
- [ ] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; собственный commit/push/deploy выполнен по AGENTS.md.

## 7. Проверки

### Автоматические

Из корня проекта: node --test tests/daily-v4.test.js tests/progress-v4.test.js tests/v4-undo.test.js; pnpm check:full; pnpm build:platforms; pnpm test:platforms; новый node tools/daily-v4-browser-check.cjs. Проверить UTC границы/DST, даты до epoch, все30 witnesses, corruption/version, assisted/tie и повторное completion.

Новые проверки подтверждают наблюдаемое поведение и регрессии, а не повторяют implementation. Полные логи остаются на диске. Финальные tests/build — pnpm check:full; квитанция не заменяет UI-критерии. Введённые новые commands/tools исполнитель добавляет только в указанных границах и документирует точный запуск.

### Ручные

В web и Telegram mock: незаконченная campaign→daily→Undo/reload→Return, UTC midnight при открытом поле, result/retry. Реальный Telegram/телефон отдельным видом evidence; при недоступности оставить review по этим критериям.

Проверка браузера, Telegram mock, настоящий Telegram и физический телефон имеют разные статусы. Без требуемой проверки не ставить done; записать review/блокер. Не запускать Telegram без пользовательского запроса; авторизация готовить задачу не авторизует сообщения другим людям.

## 8. Предположения, вопросы и условия остановки

Блокеры — непринятый короткий пресет и невыполненные session/Undo. Общий серверный день/рейтинг/награды за Stars требуют другой архитектуры и отдельного задания.

Сначала проверить зависимости и реальный код, не трактовать исторические done MVP как выполненную функцию v4. Не расширять scope соседними улучшениями. При параллельных изменениях runtime/App согласовать последовательность; самовольно не откатывать. Опубликование по постоянному разрешению AGENTS.md касается своего проверенного коммита; не включать чужие файлы и не делать force push.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0071-v4-daily.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md и задачу целиком; проверь актуальность HEAD и зависимостей. Если статус draft, сначала проверь условия перевода в ready; при невыполненной зависимости реализацию не начинай. Примени game-quality и ai-economy, соблюди scope и критерии. Заполни раздел 10, обнови INDEX и соответствующий отчёт. Различай code/unit/build/browser/Telegram/phone и человеческую оценку. Заверши собственными commit/push/deploy по AGENTS.md; чужие изменения не трогай.
```

## 10. Отчёт исполнителя

- Результат: Не выполнялась.
- Изменённые файлы и зачем: —
- Команды и фактические результаты: —
- Ручные проверки: —
- Выполненные критерии: —
- Непроверенное, блокеры и отклонения от плана: —
- Итоговый статус и дата: —
