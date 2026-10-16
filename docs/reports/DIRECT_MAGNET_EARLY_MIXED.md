# Прямой магнит и ранние смешанные стопки — 2026-10-16

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
- Полные локальные логи: `artifacts/task-0058-*.log`, `.telegram-check-logs/`; release логи и screenshots — в отдельном worktree до его архивации. Это browser surrogate/визуальный просмотр, не физический телефон.

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

Выполняется после финальной проверки release worktree; задачи остаются in-progress до успешного Pages/public smoke. Коммит содержит только собственные файлы. Результат deploy будет записан здесь после выполнения.
