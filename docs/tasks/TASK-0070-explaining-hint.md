# TASK-0070: Давать конкретную объясняющую подсказку v4

- Статус: review
- Приоритет: normal
- Создана: 2026-10-19
- Обновлена: 2026-10-25
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: средняя; высокий уровень рассуждения — чистая оценка и доступное отображение без solver promises.
- Зависимости: TASK-0066 done; актуальный assisted/session contract. TASK-0067 желательна для согласованной терминологии, не блокирует.

## 1. Цель и запрос пользователя

Кнопка Hint показывает доступный цвет/клетку и объясняет видимый эффект, сохраняя решение за игроком. Сейчас hint() выдаёт общий текст и кнопка не выведена → после изменения можно понять конкретный ход. Приём объяснения взят из Зеркальных котов; вынужденность их ходов на Magnet Sort не переносится.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Проверено чтением кода 2026-10-19, HEAD 2c77551ade5f790d4462a3d7e956ebe33ea65d5a. Активны Three.js0.186.1/Preact11/Vite7.1.9 и rules v4. Полный исходный запрос, ссылки на конкурентов и аудит наших игр: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md). Чужие локальные board.js, magnet-glow.js, draw-order.js и .codex-remote-attachments/ не включать и не откатывать. После изменения HEAD контекст перепроверить.

| Файл / символ | Проверенный факт / назначение |
| --- | --- |
| `src/prototype/runtime.js::hint; src/prototype/App.js::PrototypeApp` | Общая заглушка и неиспользуемый onHint prop. |
| `src/prototype/magnet-influence.js::resolveMagnetInfluence` | Dry resolve только текущего поля, без будущего RNG/spawn. |
| `src/prototype/tutorial-guide.js::tutorialPlacement` | Уже выбирает target без RNG, но оптимизирует число sources, а не гарантирует победу. |
| `../Doku/mirror-cats/dist/game.mjs::showHint` | Объяснение и отдельное применение; чужую логику вынужденности не импортировать. |
| `TASK-0066-v4-save-continue.md` | Assisted metadata и active attempt owner после выполнения. |

## 3. Область изменений

Новый src/prototype/hint-v4.js, runtime/App/prototype.css и небольшой hint marker в board при необходимости; tests/hint-v4.test.js, tools/hint-v4-browser-check.cjs. Не делать полный solver, будущий RNG lookahead, автоприменение, рекламу или платную помощь. Сохранить tutorial первого хода.

Перед кодом прочитать AGENTS.md, docs/PROJECT.md и применить game-quality/ai-economy. Для input/render/lifecycle сверить docs/knowledge/pixijs-practices.md («Ввод», «Lifecycle») и legacy docs/design/PIXI_RENDERING.md; активный контракт — docs/design/THREE_RENDERING.md и GDD_V0.4. Сохранить чистую seeded модель, один clock, cancel/pause/reset/dispose, reduced motion. Чужую отрисовку не исправлять попутно.

## 4. Требуемое поведение

1. Перебрать legal пары available color/free cell через чистый resolver. Ранжировать лексикографически: больше реально очищенных units, больше свободных клеток после dry resolve, больше moved units, затем стабильный порядок цветов текущего tray и row/col. Результат {color,cell,clearedDelta,freeDelta,movedCount}; не использовать будущий spawn/queue.
2. Если все кандидаты имеют movedCount=0, показать честное пояснение о ближайшем пополнении и не подсвечивать заведомо полезный ход. Не утверждать отсутствие решения или необходимость проигрыша.
3. Hint выбирает рекомендованный цвет и маркер клетки, но не создаёт action. Текст 'This can collect 10 pieces and free 2 tiles before new stacks' вычислять из текущего поля; при отсутствии clear показать moved count. Не обещать победу/лучший ход.
4. При выдаче конкретной подсказки сохранить assisted=true для attempt; общий текст без рекомендации помощь не начисляет. Повтор одного hint без изменения state не тратит RNG и может использовать cache по state.
5. Маркер/текст сбрасываются на accepted move, другом выборе цвета, reset/Undo, смене уровня, pause/hidden/dispose; stale async не нужен. Pause/резюмирование не оставляет плавающую подсветку.
6. Кнопка Hint доступна pointer/tap/keyboard, >=44px; disabled при resolving/loading/error/paused/terminal. Reduced motion — статичный маркер; touch не требует hover. Не менять правила вида мини-карт магнитов.

## 5. План для исполнителя

1. Дождаться 0066 и обновить точные symbols для assisted, перечитать изменения после 0067/0068 если они выполнены.
2. Написать pure ranker/explanation tests, проверить immutability/RNG.
3. Связать явную кнопку с selection/marker и общим cleanup, сохранить обучение.
4. Проверить реальные UI события, объяснения и переходы; обновить docs/reports/V4_HINT.md и INDEX.

## 6. Критерии готовности

- [x] Рекомендация legal, стабильно воспроизводится и численно совпадает с dry resolve.
- [x] Нажатие Hint не делает ход/спавн; assisted сохраняется после reload.
- [x] Нет обещаний optimal/forced/guaranteed; zero-pull поясняется честно.
- [x] Маркер не переживает перечисленные переходы и не закрывает фишки.
- [x] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; доставка собственного коммита по AGENTS.md фиксируется в release.json и итоговом сообщении.
- [ ] Пользователь оценил понятность объяснения и соответствие видимому эффекту (§7). Техническая реализация и независимая приёмка завершены; review только для этой субъективной оценки.

## 7. Проверки

### Автоматические

Из корня проекта: node --test tests/hint-v4.test.js tests/tutorial-guide.test.js tests/ten-range.test.js; pnpm check:full; pnpm build:platforms; pnpm test:platforms; новый node tools/hint-v4-browser-check.cjs. Seeded replay с Hint/без него имеет те же model state/events.

Новые проверки подтверждают наблюдаемое поведение и регрессии, а не повторяют implementation. Полные логи остаются на диске. Финальные tests/build — pnpm check:full; квитанция не заменяет UI-критерии. Введённые новые commands/tools исполнитель добавляет только в указанных границах и документирует точный запуск.

### Ручные

На 390×844 и844×390: Hint→осмысленный tap, Hint→другой цвет, cancel, pause/hidden, reset, zero-pull, reduced. Человек должен сопоставить объяснение с видимыми sources; субъективную оценку записать отдельно.

Проверка браузера, Telegram mock, настоящий Telegram и физический телефон имеют разные статусы. Без требуемой проверки не ставить done; записать review/блокер. Не запускать Telegram без пользовательского запроса; авторизация готовить задачу не авторизует сообщения другим людям.

## 8. Предположения, вопросы и условия остановки

Это эвристическая помощь без гарантий. Если dry resolve изменился или требуется новый lookahead/solver, остановить расширение и уточнить отдельный scope.

Сначала проверить зависимости и реальный код, не трактовать исторические done MVP как выполненную функцию v4. Не расширять scope соседними улучшениями. При параллельных изменениях runtime/App согласовать последовательность; самовольно не откатывать. Опубликование по постоянному разрешению AGENTS.md касается своего проверенного коммита; не включать чужие файлы и не делать force push.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0070-explaining-hint.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md и задачу целиком; проверь актуальность HEAD и зависимостей. Если статус draft, сначала проверь условия перевода в ready; при невыполненной зависимости реализацию не начинай. Примени game-quality и ai-economy, соблюди scope и критерии. Заполни раздел 10, обнови INDEX и соответствующий отчёт. Различай code/unit/build/browser/Telegram/phone и человеческую оценку. Заверши собственными commit/push/deploy по AGENTS.md; чужие изменения не трогай.
```

## 10. Отчёт исполнителя

- Результат: Реализована объясняющая Hint с выбором цвета/клетки, точными dry counts, статичным маркером и сохранением помощи. Ход подтверждает игрок.
- Изменённые файлы и зачем: hint-v4.js — pure ranker/text; session.js — markAssisted; runtime/App/prototype.css/telegram viewport.css — доступный UI, проекция, keyboard и cleanup; tests/hint-v4.test.js/tools/hint-v4-browser-check.cjs — регрессии; карта/GDD/отчёт/знания обновлены.
- Команды и фактические результаты: 23 targeted tests PASS, 255 full tests/build PASS, build:platforms PASS, production Hint web/Telegram mock и DEV lifecycle PASS. Полный набор итоговых проверок и команды — docs/reports/V4_HINT.md.
- Ручные проверки: просмотрены portrait/landscape/zero-pull screenshots; браузерные реальные touch/keyboard события, selection/pause/reset/Undo/reload/terminal, resize/reduced/hidden/dispose. Независимый критик: 32 targeted tests, 4 viewport, safe-inset Telegram, keyboard и final lifecycle PASS; открытых дефектов нет.
- Выполненные критерии: все технические; seed/model/events/queue не меняются от Hint, помощь долговечна, zero-pull не начисляет помощь. После трёх warm cycles десять measured cycles стабильны: 8 geometries/13 textures.
- Непроверенное, блокеры и отклонения от плана: новый физический телефон/native Telegram не проверены; hidden и zero-pull — явно synthetic. Пользовательская оценка понятности текста ещё не получена, поэтому review. Статический DOM-маркер обошёлся без изменения board.js и нового clock.
- Итоговый статус и дата: review,2026-10-25; техническая реализация и независимая приёмка завершены.
