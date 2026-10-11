# Посадка X: отдельная подложка и символ

2026-10-11. Предыдущая проверка измеряла границы mesh, но не серые пиксели внутри старого PNG. Поэтому правильно размещённая геометрия всё ещё показывала меньшую подложку с неподходящими углами.

Теперь `src/prototype/blocker.js` создаёт сплошную серую поверхность с мягким градиентом и тонким тёмным краем. Внешний контур повторяет 97.5% внутреннего углубления плитки. Символ X — отдельный прозрачный PNG, ориентированный в ту же камеру и помещённый в центр подложки. Фишки и правила не изменены. Общие geometry/material/texture освобождаются владельцем board.

## Новый ассет

Путь: `public/art/mockup/blocker-x.png`, 1280×1280 RGBA, 1 066 971 байт. SHA-256: `997C54BCFE13FA57C8675FD15DC8B872D6C6621EBBEA04B10B66969C9CDDCE89`. Создан встроенным `imagegen` в режиме edit с прозрачным фоном. Источник редактирования — прежний `public/art/mockup/blocker.png`; выход генерации `exec-ef24dacf-557a-42e5-b82f-3a4efbf762c3.png`. Старый PNG сохранён, активная игра загружает только отдельный символ.

Полный промпт:

> Precise game asset extraction/edit. Edit target: the supplied grey hex button. Output ONLY its central metallic lavender-grey X symbol as one isolated game UI sprite on real transparent background. Remove the ENTIRE hexagon plaque, the cream hex cell rim, all background, and all shadows cast on that removed plaque. Preserve the same thick chunky rounded X silhouette, soft silver-lavender bevel, upper-left soft highlight, thin dark-purple lower edge, premium glossy casual mobile puzzle style. Near front orthographic view, symmetric centered X, no perspective rotation or foreshortening, very shallow bevel. No hexagon, no surrounding frame, no disc, no other objects, no text, no extra marks, no checkered painted background. Tight square composition, X occupies about 90% of image width and height, clean antialiased transparent edges. This X will be placed separately on a precisely fitted dark hex plaque in Three.js.

## Проверки

`tools/chip-browser-check.cjs` дополнительно читает реальные пиксели в 12 точках возле шести углов двух препятствий: поверхность заполнена серым, кремовые/прозрачные клинья не проходят проверку. Проверены 782 кадра, счётчики, ID, поэлементные перелёты, контуры, оба профиля движения и отсутствие роста шести GPU-геометрий. Стопки 20 элементов просмотрены в viewport 320/390/430.

Основная папка одновременно изменялась другим процессом; первый `pnpm check:full` остановился с «Код изменился во время проверок». Финальная проверка выполнена в изолированной копии от `2035541`, поверх уже сохранённых обновлений UI и drag, без несохранённых параллельных правок.

- `pnpm check:full`: тесты и сборка прошли. Лог: `artifacts/gameplay-counted-hex/blocker-isolated-check-full.log`.
- Проверка кадров: 782 кадра, 1237 перелётов, шесть общих геометрий, 12 заполненных углов подложки. Лог: `artifacts/gameplay-counted-hex/blocker-isolated-chips.log`.
- Desktop/mobile viewport, управление, drag, pause/reset/dispose: browser-check прошёл. Лог: `artifacts/gameplay-counted-hex/blocker-isolated-browser.log`.
- Ручной просмотр в браузере: пройден первый уровень, на втором серый X заполняет своё углубление и отделён от кремового бордера. Скриншот: `artifacts/gameplay-counted-hex/blocker-plate-game-proof.png`.

После сохранения параллельных изменений повторены проверки основной папки: `pnpm check:full` прошёл поверх `f179abe` и затем `1fcdc0c` (`blocker-final-check-full.log`), проверка 782 кадров и 12 углов прошла (`blocker-final-chips.log`), desktop/mobile browser-check прошёл (`blocker-final-browser.log`). Логи находятся в `artifacts/gameplay-counted-hex/`.

Реальный телефон и его производительность не проверены.

## Наклон символа

По уточнению пользователя X теперь повёрнут относительно своей billboard-подложки на угол камеры (около 33°): его нормаль направлена по world Y, как у поверхности поля. Масштабы Y/Z родителя одинаковы, чтобы поворот не искажал плоскость. Высота символа в проекции сокращается примерно до 84%, контур подложки и кремовые бордеры сохраняются. Ассет не перегенерировался.

Проверены 782 кадра и 12 углов подложки; три chip unit-теста прошли. Выполнен ручной просмотр второго уровня. Скриншот: `artifacts/gameplay-counted-hex/blocker-tilt-proof.png`.

Первый запуск полной проверки выявил отсутствующие установленные `@pixi/colord` и `vite` после очистки предыдущей временной копии. Автоматическая проверка отклонила восстановление зависимостей; пользователь явно разрешил `pnpm install --frozen-lockfile --force`. Зависимости восстановлены без обновления версий. Сборка основной папки прошла, но полная проверка остановилась из-за параллельных изменений кода.

Финальный `pnpm check:full` прошёл в отдельном worktree от `fcebbbe` с двумя hunks наклона X. Его `node_modules` установлен отдельно, без junction на основной проект. Лог: `artifacts/gameplay-counted-hex/blocker-tilt-isolated-full.log`. Проверка кадров: `blocker-tilt-chips.log` в той же папке. Desktop/mobile viewport, управление и lifecycle основной игры прошли browser-check: `blocker-tilt-browser.log`.
