# Анимации и прогрессивные уровни — TASK-0026–0030

2026-10-11. Реализовано на базе ad32dc6; активный Three.js/Preact runtime v3. Правила модели не менялись. Чужие изменения board.js/magnet-glow.js/draw-order.js сохранены в рабочем дереве и исключены из коммита этой работы.

## Результат

- TASK-0026: 280 мс на соседнее перекладывание, stagger 105 мс. Отдельный подъём, один переворот через ребро на 180°, замедленная посадка. PNG переключает сторону в момент ребра и возвращается к upright-ориентации непрерывно. Shared backing остаётся единственным объёмным ребром; model ID и counter contract сохранены.
- TASK-0027: current/previous/target/home size в CSS pixels; над любой плиткой — проекция board.magnetScreenSize(), снаружи — размер захвата. Сглаживание rate=20, без overshoot, интерполяция render(alpha); drop ждёт сходимости размера, промах восстанавливает home. Tap, keyboard и capture/cancel сохранены.
- TASK-0028: уровни 4–12, группы с минимумом 2/3/4 полезных ходов. По три выигрышных witness, альтернативные первые клетки одного цвета с другими маршрутами и полезные проигрышные развилки у каждого. Offline solver использует точный отсев по числу оставшихся цветов и различает unknown. [Сложность и решения](../design/V3_LEVELS.md), [полное evidence](../design/v3-level-evidence.json).
- TASK-0029: panel entry 320 мс, backdrop 200 мс, небольшой scale settle; ключ по типу Modal предотвращает повтор от rerender. Оба reduced режима оставляют fade 80 мс, без перемещения. Focus trap, inert, Escape и Retry сохранены; кнопки не ждут окончания входа.
- TASK-0030: статический декор удалён. 42 частицы из двух боковых эмиттеров, спавн за 280 мс, движение вверх/наружу и падение с угасанием; общий срок менее 1.7 с. CSS-анимации удаляют узлы на animationend, unmount отменяет их; нет нового RAF/interval или GPU-ресурсов. Hidden/reduced отменяют burst, повторный показ той же победы его не запускает.

## Фактические проверки

Рабочая директория — корень проекта. Полные журналы находятся на диске.

| Проверка | Результат |
| --- | --- |
| node --test tests/hex-flip.test.js tests/magnet-drag.test.js tests/prototype-v3.test.js tests/progressive-levels.test.js tests/chip.test.js tests/collection.test.js | 20/20 успешно; один half-turn, непрерывные endpoints, reduced, scale 30/60/120/144 FPS, ID/масса, решения и доказанные ошибки |
| node tools/verify-v3-levels.mjs | Девять полей, три win witnesses и bad-ветка каждого; unknown отсутствует; 10–309 состояний на поле |
| pnpm test:browser | Desktop 1280×900 и touch/mobile viewport 390×844; исходные три поля, pointer/tap/drag, keyboard, pause/reset/resize/blur/hidden/reduced/dispose; ошибок нет |
| node tools/polish-browser-check.cjs | Девять новых полей пройдены кликами; альтернативные решения и bad→lost для 4/7/10; Hint/Retry/Next 12→1; пять открытий Pause, CSS startTime не меняется при rerender, keyboard trap; scale сходится к target/home в пределах 2 CSS px; 20 mounts/unmounts burst, максимум 42 узла; hidden не перезапускает; шесть направлений на 20 элементах, 2028 кадров |
| node tools/chip-browser-check.cjs | 4170 кадров, 6543 наблюдения перелёта, по 6 геометрий на всех 24 сменах уровня, честные counters/ID; 12 проверок пикселей blocker; высокие стопки при 320/390/430 px |
| node tools/collection-browser-check.cjs | Mobile/desktop/reduced: 12 receipts, обычный режим — 12 уникальных DOM-фишек; reduced — 0 экранных перелётов; resize/reset/pause/dispose сохранены |
| Дополнительные браузерные сценарии artifacts/task-polish/error.cjs и pause.cjs | Преднамеренный отказ chip-violet: popup error, focus trap, доступный ранний Retry и восстановление. Pause/reset отдельно на подъёме, ребре и посадке сохраняют elapsed и очищают timeline |
| pnpm check:full | 154/154 теста, production build успешна; .telegram-check-logs/tests.log и build.log |

Первый новый browser assertion прочитал pending CSS startTime=null; исправлено ожидание старта анимации в тесте. Первый chip-browser прогон упёрся в screenshot timeout после тысяч синхронно отправленных WebGL draws; добавлен yield каждые 100 тестовых кадров, повтор прошёл. Runtime из-за этого не менялся. Сборка сохраняет предупреждение о чанке больше 500 kB; оптимизация bundle вне этих задач.

## Визуальное evidence и границы

В artifacts/task-polish/ находятся before.png, before-win.png, before-video/, after-video/, after-victory-burst.png, level-12.png, popup-landscape.png, launch-error-entry.png и flip-0..5-{lift,edge,land}.png; polish-report.json содержит итог расширенного прогона. Записи и изображения — локальные артефакты, не часть Git-коммита. Повторяемые сценарии сохранены в tools/.

Визуально просмотрены кадры выброса, уровня 12, входа Pause в landscape и последовательность подъём/ребро/посадка высокой стопки. На последовательности заметен отдельный переворот, на ребре сохраняется тонкий объём, при посадке верх фишки остаётся upright. Частицы группируются у эмиттеров и расходятся снаружи панели; текста и кнопок не закрывают. Эта оценка относится к просмотренным кадрам, а видео записано для дальнейшего просмотра пользователем.

Все browser-результаты получены в headless Chromium, touch — эмуляция. Это не реальный телефон, измерение p95 FPS, пользовательское исследование интересности уровней или художественное одобрение пользователя. Такие исследования не выдаются за выполненные. Обязательные критерии пяти задач проверены в доступной браузерной среде; физический device test был условным («при доступности»). Игра не публиковалась, Telegram не запускался.
