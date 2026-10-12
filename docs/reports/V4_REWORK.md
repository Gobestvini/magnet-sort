# Переделка Magnet Sort v4 — 2026-10-12

Реализованы наблюдаемые результаты TASK-0031–0042 по запросу выполнить всю очередь. Магнитная клетка исправлена по уточнению пользователя: НЕТ рисунка магнита в центре, только цветные бортики и эффект по контуру.

## Новый цикл

model-v4.js: immutable seed/LCG, initial spawn, послеходовый bounded spawn, цели 100*N, очередь из трёх, растущие шаги и pure earnedStars. В model.js сохранено routing ядро v3; его лимит/terminal/initial mass не экспортируются в v4 state.
levels-v4.js: 12 layout с 1–4 крестами, валидатор схемы/связности. V3 authored solutions сохранены, Hint скрыт для случайных полей. UI показывает goal/result/stars и реальное начисление.

Изначальный авторский baseline 3–6 дал накопление неполных остатков: greedy level12/seed0 достиг 1200 за 1090 ходов; seed1 не достиг за 1200. Исправлен общий spawn на 6 или 12, равновероятно. После этого seed1: уровень1 — 102 за 8; уровень2 — 210 за 13; уровень12 — 1206 за 68. Это контрольные прогоны выбранной стратегии, не доказательство всех seeds и не пользовательское исследование.

## Ассеты и visual

Built-in image_gen, не CLI: 7 новых магнитов, 4 новых chips, 7 border-only magnetic cells, один complete blocked tile. Все конечные PNG находятся public/art/mockup; происхождение/промпты: v4-generated-manifest.json. Сгенерированные U-inlay пробы отклонены пользователем, не подключались к runtime. Контактный лист: artifacts/v4-visual/seven-color-contact.png.

Пользователь одобрил шесть border-only вариантов и попросил привести фиолетовый к ним. Фиолетовый перегенерирован по синему: рамка и вся нижняя стенка purple, cream только внутри. Первая cream-outside violet проба заменена.

Activation → receiving → deactivation: crossfade ordinary/border PNG и retained edge highlight, затем обычный материал. Отдельного U во время работы нет, hover/drag сохраняют инструмент.
Logo stacking исправлен, ниже modal/drag. Collection target — кромка filled track из numeric progress и актуального rect, ширина без CSS lag; payoff на полосе, не в цифре.
Backgrid и idle share SVG pattern 96×166.276 без независимых raster/crop. 11-секундный цикл, reduced/hidden/pause.
V4 соседний перенос теперь rocking hop до 30°/.28 lift; не переключает лицевую PNG, не выворачивает освещённую обратную сторону. V3 180° сохранён. Участвующие badges скрыты по всему batch, clear акцент 240мс показывает ровно 6, packing/collection без цифры. Unlit backing хранит цвет.

Причина исходного пользовательского чёрного артефакта не подтверждена однозначно: сравнение Standard/Basic на одном кадре не дало выраженного различия. Вместо заявления о единственной причине активный профиль заменён так, чтобы исключить переключение face и освещённую обратную сторону; чёрная обводка динамических badges также больше не участвует в перелёте. На сохранённых кадрах шести направлений новый артефакт не наблюдался. Художественное впечатление пользователя не подменяется автоматическими assertions.

## Проверки

- pnpm check:full — тесты и production build (окончательный результат фиксируется в отчётах задач после финального запуска).
- Финальный clean staged tree: 167/167 и сборка прошли в C:/Users/gobes/AppData/Local/Temp/magnet-v4-verify-20261012. Во вложенной OneDrive-копии legacy campaign.test.js аварийно завершался (3221225477), в той же копии по короткому пути вне OneDrive — полный успех без изменений тестов. Отключение JIT во вложенной копии не помогло; точная причина native сбоя среды не установлена. Это не исправление игровой логики и не пропуск теста. Production browser smoke clean tree прошёл также в artifacts/v4-clean: goal102 за8 UI ходов, stars/retry/pause, desktop/mobile viewport.
- pnpm test:browser / tools/v4-browser-check.cjs — реальное прохождение seeded уровня1 через DOM/keyboard, три уникальных инструмента, steps/stars/result, retry/pause; desktop/mobile viewport, ordinary pipeline с system reduced motion.
- tools/v4-level-browser-check.cjs — уровни2/12 через реальные UI actions; для длительных серий presentation семплируется в конечную позу отдельным DEV hook. Это интеграция model/UI, не полный просмотр каждой анимации. Goal и displayedCleared совпадают.
- tools/chip-browser-check.cjs — 4163 кадра, 6290 active flights по retained v3 fixtures, conservation/посадка/raycast/shared geometry. Прежняя пиксельная проверка отдельной blocker-подложки теперь неприменима (blockerPixels=0), новый integral X проверен кадрами/layout/placement semantics.
- tools/v4-visual-check.cjs (и актуальные collection/polish wrappers) — шесть направлений×5 кадров×desktop/mobile, 20-unit fixtures, hidden/pre-clear badges, all seven border variants, collection target внутри track, responsive 320/390/landscape900, pause/reset и 20 GPU geometry reuse cycles. Полный idle цикл просмотрен через снимки до/после. Browser frames не являются физическим телефоном.
- Старые browser flows сохранены tools/v3-*.cjs, действующие project browser/pages команды используют v4.
- HMR во время одного dev smoke сбросил run и вызвал timeout поиска pink; сценарий повторён после стабилизации и прошёл. Финальный Pages smoke выполняется по неподвижной production сборке.

## Границы и публикация

Чужие исходные изменения board.js/magnet-glow.js/draw-order.js сохранены в artifacts/rework-baseline и рабочем checkout. В индекс коммита не включаются чужой magnet-glow.js, draw-order.js и remote attachments. В закоммиченном board локальные painter helpers принадлежат этому renderer-переходу; рабочий checkout сохраняет прежний import draw-order.js как residual local diff. Clean staged tree проверяется отдельно, чтобы не зависеть от чужих untracked modules.

Физический телефон, FPS/texture memory телефона и внешняя художественная оценка не проверялись. Новые исходные PNG увеличивают объём ресурсов; размер группы magnet/tile ресурсов около 32MB (23 файла, включая прежние связанные sprites). Автоматическая загрузка не является доказательством мобильного memory budget.

Код/отчёты находятся в review до успешной доставки проверенного commit в main, deploy-pages.yml и smoke публичного адреса. После этого task/index статусы переводятся в done; дальнейший balance/user feedback может открыть отдельное уточнение.

