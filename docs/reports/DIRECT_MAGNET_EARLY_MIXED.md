# Прямой магнит и ранние смешанные стопки — 2026-10-16

Исходный релиз TASK-0058/0059 описан ниже. Текущее оформление preview уточнено пользователем после релиза: см. последнее дополнение «Маски бортиков вместе с небольшими частицами».

TASK-0058 и TASK-0059 подготовлены и по следующему указанию пользователя реализованы. Исходный HEAD `bae15eea211be1411e9b69119100f0da89bda878`. Чужие локальные `board.js`, `magnet-glow.js`, untracked `draw-order.js` и remote attachments сохранены вне коммита. Изолированный release worktree использует board из HEAD.

## Поведение

Магнит собирает matching верхние группы всех обычных клеток hex-радиуса 2 непосредственно source→target. Промежуточный X, чужой цвет или отсутствующая клетка не мешают; X не источник, radius 3 и скрытые группы не участвуют. Каждый unit ID имеет один перенос, deterministic distance/row/col; clear по 6, остаток, conservation, spawn/queue/goal/stars сохранены.

Подсветка/волны на соседних бортиках и рабочие контуры убраны. Сама magnetic tile работает как прежде. Hover/drag/keyboard preview показывает по 3 частицы из каждой обычной клетки двух колец, включая пустые и чужого цвета, до 54. Частицы идут к magnetAnchor по параболе высотой 1.1 world unit, период 1.35s, radius .04; shared geometry/material, общий runtime clock, без RNG. Work использует actual sources. Reduced motion, cancel/pause/hidden/reset/resize гасят preview.

Уровни 1–3 уже начинают с обоих видов стопок: 1 и 2 цвета. Первые две выбранные seeded клетки гарантируют разнообразие без reroll; остальные и последующие партии выбирают [1,2]. Группы 6 или 12 единиц, 3+3/6+6 в смешанной стопке; верхний счётчик и очередь по открытым цветам сохранены. Поздние bands и палитры не менялись.

## Проверки

- `pnpm check:full`: 186/186 unit tests, production build passed, также в отдельном worktree без чужих исходников.
- `node tools/progression-browser-check.cjs`: ранние mixed openings, границы palette/group bands, реальные 1/2/3 слота, keyboard/tap/drag, retry/pause, прямой дальний перелёт без подсветки, три viewport.
- `node tools/border-preview-browser-check.cjs`: движущийся/неподвижный hover/drag/keyboard preview, 3 частицы на каждую клетку, отсутствие соседних контуров, семь цветов, reduced motion, invalid targets, три viewport, 20 resource reuse cycles.
- `node tools/influence-drag-check.cjs`: 20 реальных pointer drag/cancel циклов, pause, неизменность RNG/state при отмене, стабильные geometries/textures.
- `node tools/v4-visual-check.cjs`: шесть направлений × пять фаз × desktop/mobile, IDs, hidden/preclear badges, border deactivation, progress endpoint, pause/restart/20 resets.
- `pnpm test:browser`: desktop/mobile seeded победа за 5 ходов, goal/moves/stars, retry/pause.
- Просмотрены PNG `artifacts/border-preview/held-mobile.png`, `phase-1440-0.4.png`, `artifacts/progression-browser/level-1-390.png`; ранние смешанные слои и отсутствие подсветки читаются. Изолированный release browser повторяет проверку увеличенных частиц.
- `node tools/followup-browser-check.cjs` в изолированном release worktree: четыре viewport (включая 320 px), result variants, inward particles/отсутствие контуров, reduced, полный 11s idle — passed.
- `node tools/pages-browser-check.cjs` в изолированном worktree: production `/magnet-sort/` flow passed. Staged source hashes сопоставлены с прошедшей проверки release-копией; board соответствует чистому исходному HEAD.
- Полные локальные логи: `artifacts/task-0058-*.log`, `.telegram-check-logs/`; release логи и screenshots сохранены в `artifacts/direct-magnet-release/` перед архивацией временного worktree. Это browser surrogate/визуальный просмотр, не физический телефон.

## Влияние на сложность

`node tools/verify-v4-balance.mjs direct-early --measure-only`: 12×50 seed, greedy/random, предел 320 ходов. 600/600 greedy побед, 36 актуальных winning witnesses, 4 winning/worse пары (уровни 4/7/10/12), каждый replay проверен моделью и `tests/v4-balance.test.js`. Не является проверкой прежних численных ориентиров умеренной сложности.

| Уровень | Greedy / 50 | Random / 50 | Медиана ходов greedy |
| --- | --- | --- | --- |
| 1 | 50 | 50 | 4 |
| 2 | 50 | 50 | 9 |
| 3 | 50 | 50 | 15 |
| 4 | 50 | 46 | 21 |
| 5 | 50 | 48 | 26 |
| 6 | 50 | 44 | 32 |
| 7 | 50 | 44 | 73 |
| 8 | 50 | 44 | 83 |
| 9 | 50 | 46 | 95 |
| 10 | 50 | 38 | 161 |
| 11 | 50 | 44 | 177 |
| 12 | 50 | 28 | 193 |

Прямое притяжение заметно повышает успешность random против прежнего routing (например, L7 44/50 вместо 0/50). Прежний разрыв >=5 побед с random не достигается на L4/L5. Это следствие запрошенного прямого действия, не исправляется изменением соседнего баланса. Числа goal/spawn/stars оставлены прежними. Старый `V4_BALANCE.md` описывает прошлый rules snapshot; его выводы о moderate difficulty не переносить автоматически.

## Публикация

Реализация опубликована коммитом `998c4fbfb1b4fbdfe95854e6273acaa6d14f8783` в origin/main. [Check game](https://github.com/Gobestvini/magnet-sort/actions/runs/38919987004) и [Deploy GitHub Pages](https://github.com/Gobestvini/magnet-sort/actions/runs/38919986847) — success на этом коммите.

Public `GAME_BASE_URL=https://gobestvini.github.io/magnet-sort/ node tools/pages-browser-check.cjs`: seeded победа за 5 ходов, top-color queue, moves/stars, retry/pause — desktop/mobile passed. Лог `artifacts/task-0058-public.log`. Отдельно normal-motion keyboard preview на public URL просмотрен в desktop/mobile: видны частицы без подсветки источников и ранние mixed layers; page errors отсутствуют. Снимки `artifacts/task-0058-public-preview-{desktop,mobile}.png`. TASK-0058/0059 done; физический телефон не проверялся.

## Маски бортиков вместе с небольшими частицами — уточнение 2026-10-16

Запрос: вернуть прежнюю подсветку через маску, оставить меньшие и менее одинаковые частицы, убрать их во время перелёта хексов.

Восстановлены исходные геометрия upper-rim mask и shader из `bae15ee`: 18 переиспользуемых масок двух геометрических колец, в том числе X, три сходящиеся волны с параметрами 2.4s/3.4/.16. Углубление и передняя стенка плитки не окрашиваются. В reduced motion остаётся статичная маска .45 без частиц.

Радиус частиц уменьшен с .04 до .022 world unit. Новый чистый `preview-particles.js` задаёт индивидуальные скорость/фазу/размер, высоту .75–1.55, боковой изгиб до .35. На следующем проходе дуга меняется. Visual hash зависит только от cell/index/cycle, не расходует RNG модели и не зависит от FPS. Источники частиц — обычные клетки колец, по 3; X участвует в маске, но не испускает частицы. Любая timeline сразу скрывает preview-частицы и маски соседей: activation, unitMoved, collection, spawn. Оформление самой активной клетки остаётся в board. Прямой радиус, ранние mixed stacks и игровой баланс не менялись.

Проверки до публикации:

- `pnpm check:full`: 188/188 tests + production build, также в изолированном release worktree с чистыми board.js/magnet-glow.js из HEAD.
- `node tools/border-preview-browser-check.cjs`: совместные маски/частицы, разные duration, уменьшенный размер, все фазы timeline без частиц, hover/drag/keyboard, reduced, семь цветов, desktop/mobile/landscape, invalid targets, 20 reset/resource cycles. Повторено на изолированном release.
- `node tools/influence-drag-check.cjs`: 20 pointer drag/cancel циклов, ожидаемые маски и частицы, pause/reduced, стабильные GPU resources.
- `node tools/progression-browser-check.cjs`: direct radius-two transfers и ранние mixed openings без регрессий, рабочие кадры без частиц.
- В изолированном release: `node tools/pages-browser-check.cjs` — seeded победа за 5 ходов, retry/pause, desktop/mobile; `node tools/followup-browser-check.cjs` — четыре viewport, masked preview с частицами, отсутствие рабочих частиц, reduced и полный 11s idle. Оба прошли.
- Снимки held-mobile и desktop phase .4 просмотрены: подсветка только на верхних бортиках, частицы заметно меньше. Browser surrogate, физический телефон не проверялся.

Исходные чужие изменения `board.js`, `magnet-glow.js`, `draw-order.js` и remote attachments сохранены вне коммита. Публикация текущего коммита и public smoke выполняются после этих проверок по AGENTS.md; результат сообщается в финальном ответе.
