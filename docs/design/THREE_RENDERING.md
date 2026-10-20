# Three.js rendering contract — GDD v0.3

Уточнение 2026-10-20 (TASK-0075): общий CHIP_HEIGHT равен .08 вместо прежних .14. Его используют idle, from/to посадки, badges, упаковка и начало DOM-сбора. Footprint, камера, PNG и число элементов сохранены. Более старые числа ниже описывают исходную реализацию. Сравнены одинаковые fixtures всех семи цветов на desktop/portrait/landscape: [COMPACT_STACKS](../reports/COMPACT_STACKS.md).

## Активное уточнение 2026-10-18

Повторная проверка нижнего края: полного polygon недостаточно, прежний shader сужал боковую альфу в основании и давал слабый floor. Теперь ground mix отключает боковое затухание снизу, floor alpha .72, передняя нижняя часть усилена на .32 с мягким переходом вверх. Проверяется реальное RGB на пяти видимых точках плитки desktop/mobile, а не только шесть вершин. Envelope/reduced/lifecycle не менялись. Волна по retained маскам: half-width .48 вместо .16, квинтический smootherstep обнуляет первую и вторую производные на краях альфы; скорость2.4с/3.4 и зона масок сохранены.

По уточнению пользователя карты7/19 видны только у магнитов в tray. Видимые подписи1/2 RINGS и floating-range удалены; при drag/hover/размещении на поле карты нет. Screen-reader aria-label продолжает сообщать радиус. Основное изображение магнита центрировано в tray-карточке, мини-карта сохраняет прежний правый нижний anchor.


Уточнение после выбора C 2026-10-18: `source-light.js` владеет пулом18 источников ×3 retained mesh: полный floor-fill по шести вершинам полного внешнего силуэта PNG, включая переднюю стенку, задний объём и передний прозрачный объём. Две общие ShapeGeometry и три общих ShaderMaterial принадлежат board. Отступы/размеры tile приходят из board через influence-effects, поэтому свет начинается по всей ячейке. Порядок back/floor/front = cellOrder+3/+4/+70; фишки остаются между back и front, перелёты выше света. Передний слой полупрозрачен, цифры читаются. `sampleSourceLightIdle` задаёт дыхание3.2с и плавно поднимающуюся широкую волну2.6с через тот же runtime clock; reduced остаётся статичным. Каждый source держится до своего последнего unitMoved.end из timeline.sourceArrivals, затем fade550мс/reduced80мс; паузы collection между batch не завершают источник. Общие материалы получают opacity своего mesh в onBeforeRender с uniformsNeedUpdate=true (API подтверждён в установленном Three r186). Новых GPU-ресурсов на кадр нет. Pause/hidden/reset/dispose сохранены.

`influence-effects.js` сохраняет6/18 масок бортиков и показывает свет только actual matching sources. `magnet-radius.js` выбирает PNG мини-карты7/19 по типу, `App.js` показывает карты только в панели выбора; runtime-overlay карты и видимые подписи удалены. Два PNG заранее decode через существующий assets.js и BASE_URL, hue rotation согласует голубой исходник с семью цветами. Старые SVG-плашки больше не используются. Три сгенерированных экрана и исходные промпты: docs/design/magnet-range-light/concepts-v2/. Пользователь выбрал C; карточки перенесены после выбора. Макет света использует тот же shader, на высоких стопках6/10 проверены front/back/full-hex и idle. Browser проверяет также console.error: ошибки компиляции WebGL не обязательно дают pageerror.

## Исторические уточнения v4 — 2026-10-12

Предпросмотр 2026-10-16, уточнение после TASK-0058: восстановлен исходный shader сходящихся волн через 18 масок только верхних бортиков PNG, включая занятые/X клетки геометрических колец. Координаты маски и параметры 2.4s/3.4/.16 прежние. Дополнительно по 3 частицы radius .022 из каждой обычной клетки (до 54); preview-particles.js задаёт разные фазы, duration 1.05–1.85s, высоту .75–1.55 и боковой изгиб до .35, меняя дуги по проходам без model RNG. Всё обновляется одним runtime RAF. Любая рабочая timeline сразу скрывает preview-частицы и соседние маски; reduced оставляет статичный цвет бортиков .45 без частиц. Target magnetic tile сохранён.

Правила — [GDD v0.4](GDD_V0.4.md); clauses v3 ниже сохраняются как история и общие требования владения, ввода/cleanup. При конфликте применяются следующие решения v4:

- `model-v4.js` — immutable RNG/spawn/goal/queue/scoring; `levels-v4.js` — только sparse blockers и identity. `model.js` сохраняет исторический v3 BFS; `magnet-influence.js` разрешает прямой source→magnet из полного v4 hex-радиуса 2 без промежуточных препятствий, общий dry preview без RNG. Рабочие частицы следуют исходным sources.
- Seven RGBA PNG magnets, four new chip colors, seven border-only magnetic tiles and complete blocked tile load through the shared BASE_URL/decode/retry lifecycle. Manifest: `public/art/mockup/v4-generated-manifest.json`.
- Magnet handoff activates a colored border around an EMPTY ordinary cream floor. No magnet glyph or freestanding magnet is drawn during activation/active/deactivation. Shared opacity crossfade and one retained travelling edge highlight use sampled time. No second RAF; reset restores ordinary tile.
- V4 neighbour animation uses `sampleHexTransfer`: 30° maximum rocking hop with .28 lift, original authored face throughout, continuous flat landing. V3 `sampleHexFlip` remains for regression. Unlit double-sided backing preserves authored color; flipping a lit body and switching PNG faces is not part of the active profile.
- Participating cells hide badges for an entire edge batch, including stagger. A .24s pre-clear accent shows exactly the six credited IDs, then badges hide during packing/collection.
- Collection aims at the current right edge of filled progress, derived from numeric displayedCleared/goal and actual track rect. No CSS width transition or counter-scale modifies the target; clipping at rounded endpoints keeps payoff inside the track. Result waits for all arrivals.
- The embossed backdrop background-v2.png and groove mask background-grid-mask-v2.png share center/cover; mask is extracted from the same generated bitmap. Original 11s sweep; reduced/hidden/pause stop idle. Victory v2 uses a decoded RGBA panel and five-point star with live DOM values and a dark purple scrim.


2026-10-09. Этот контракт заменяет PIXI_RENDERING для активного entry. В проекте установлен Three.js 0.186.1; API сверены с установленной версией и официальной документацией.

## Владение

| Слой | Файл | Ответственность |
| --- | --- | --- |
| Чистая модель v3 | `src/prototype/model.js` | Immutable applyMagnet, ordered units, routing, thresholds, turn/result |
| Авторский контент | `src/prototype/levels.js` | 12 полей: три учебных и девять прогрессивных; проверяемые решения и offline witnesses |
| Presentation | `src/prototype/motion.js` | Timeline отдельных элементов, stagger/landing/clear, pure sampling |
| Three view | `src/prototype/board.js` | Renderer, scene/camera, shared PNG textures/geometry/material, meshes, raycasting |
| Runtime | `src/prototype/runtime.js` | Единственный RAF, fixed step, input gate, pointer capture, pause/reset/hidden/resize/dispose |
| DOM | `src/prototype/App.js`, `prototype.css` | Preact HUD, магниты, обучение, результат, keyboard/live status |
| Сбор в HUD | `src/prototype/collection.js` | DOM-фишки, SVG-шлейф/искры и реакция счётчика, общий sampled clock |

View не вызывает симулятор. Модель не знает о Three.js, DOM, wall clock или FPS. UI не меняет stacks самостоятельно. Результат рассчитывается один раз; конечный state показывается после воспроизведения timeline.

## Рендер и ввод

- WebGLRenderer, WebGL 2; OrthographicCamera под фиксированным углом. Нет OrbitControls или второго animation loop.
- Отдельная mesh-группа на реальный элемент; индекс в массиве units определяет подъём слоя. После визуальной коррекции 2026-10-11 используется полный псевдо‑3D PNG: верх, яркая фаска и передняя стенка. Фишка и плитка смотрят в одну камеру; PNG не подвергается повторному наклону. Основание занимает 97.5% измеренного внутреннего углубления: shared BufferGeometry адаптирует шесть углов PNG к его плечам и вершинам. Подъём слоя в world Y 0.14 — шаг presentation, а не толщина физического тела. Тонкая backing ExtrudeGeometry глубиной 0.028 видна только при перелёте и даёт ребро на перевороте. Вращение применяется поверх ориентации камеры. Сначала рисуются задние клетки, затем их слои, затем перелёты и цифры.
- Центр внутреннего углубления кремовой плитки — пиксель x=235 из 471, y=234 из 512. Сдвиг плоскости `(234/512 - .5) * tileHeight` направлен вниз по screen-up; прежний обратный знак смещал основание к нижнему бордеру. Фишка компенсирует подъём половины первого слоя и дополнительно приподнята на4/512 высоты плитки (4 пикселя исходного PNG), чтобы одиночный хекс не прижимался к нижнему краю. Все шесть углов основания остаются внутри углубления. Препятствие X состоит из сплошной серой подложки с тонким краем и отдельного прозрачного `blocker-x.png`: старый PNG с интегрированной плиткой не используется. Контуры обоих элементов проверяются внутри всех шести граней углубления и на покрытие 97.5%; реальные пиксели возле углов подтверждают заполнение подложки. Контактная тень использует одну общую CanvasTexture. [Исправление и источник X](../reports/BLOCKER_PLATE.md).
- Sprite-счётчик показывает непрерывную верхнюю группу цвета среди стоящих элементов presentation. При сборе оставшиеся в ячейке элементы входят в цифру до своего запуска; при соседнем переносе прилетевшие добавляются при посадке. Шрифт Nunito декодируется до создания текстур цифр.
- Очистка имеет отдельные стадии: поэлементное уменьшение сверху вниз (.20 с на хекс, последовательные запуски в пределах .48 с), короткий акцент (.07 с), затем поэлементный полёт в цифру CLEARED (.56 с, stagger .05 с). У каждого ID собственный progress/масштаб; высота равна сумме шагов нижележащих элементов, поэтому верхний не проходит сквозь ещё полный нижний. Цифра башни скрывается на время уменьшения. При запуске ID передаётся из Three view в DOM; при прибытии начисляется ровно один элемент. SVG-шлейф и частицы используют тот же sampled time, фиксируемый пул и актуальные экранные координаты; второго RAF/таймеров нет. Reduced motion сокращает стадии и исключает экранный перелёт и частицы. [Проверки сбора](../reports/COLLECTION_FLIGHT.md).
- Resize задаёт CSS размер, drawing buffer с текущим DPR и frustum камеры. Весь board остаётся в кадре portrait/landscape.
- Pointer переводится из актуального `canvas.getBoundingClientRect()` в NDC, затем Raycaster проверяет плитки. Модель повторно проверяет разрешение на placement; target от view — только cell, не mesh.
- Drag захватывает pointer, игнорирует второй pointer и отменяется при cancel, lost capture, blur, hidden, resize, pause/reset/dispose. Tap поля с большим перемещением указателя не превращается в случайное размещение.
- Landing позиции рассчитываются по fromIndex/toIndex. Профиль 2026-10-11: 280 мс на соседний перенос, stagger 105 мс; подъём до 0.58 world unit, один переворот на 180° поперёк экранного направления. Чистый sampleHexFlip задаёт lift/travel/angle. Во второй половине face контрповорачивается на PI в момент ребра: обе стороны показывают upright PNG, конечная поза непрерывно совпадает с неподвижной. Backing виден в перелёте, новые buffers/textures не создаются. Reduced motion отключает вращение/подъём.
- Drag хранит previous/current/target/home size в CSS px; над любой плиткой цель — magnetScreenSize(), снаружи — home. Экспоненциальное сглаживание rate=20 без overshoot, интерполяция render(alpha); перед передачей к board размер сходится с проекцией.
- Modal появляется за 320 мс через opacity/translate/scale с небольшим settle; backdrop — 200 мс. Ключ по типу сохраняет одиночный вход и focus trap. Reduced (runtime или system) оставляет fade 80 мс. VictoryParticles принадлежит результату runId, остаётся смонтированным при pause и отменяется без перезапуска при hidden. 42 DOM-частицы, CSS delays 0–280 мс, lifetime 950–1400 мс, removal на animationend/unmount, без отдельного RAF/interval и GPU-ресурсов.

## Lifecycle и стоимость

Текущая browser-проверка фиксирует шесть GPU-геометрий без роста при reset. Восемь PNG sRGB-текстур дополняются общей контактной тенью и кешируемыми текстурами цифр. Растровые фишки используют явный painter order без depth write: альфа нарисованной стенки не обрезается соседней плоскостью. Raycast соответствует видимому контуру плитки. Нет PMREM, постобработки и теневых карт. PNG загружаются и декодируются до ввода, включая DOM/nine-slice ресурсы. При ошибке партии успешные текстуры освобождаются; generation token отклоняет результаты после retry/dispose. Подробности: [PSEUDO3D_CHIP_PLACEMENT](../reports/PSEUDO3D_CHIP_PLACEMENT.md). CLEARED отображает число прибывших элементов timeline; окончательный результат принадлежит модели.

RAF принадлежит runtime и нужен только при активной timeline. Pause/hidden сбрасывают накопитель и предыдущий timestamp. Reset удаляет presentation и восстанавливает исходные units, переиспользуя renderer и GPU-ресурсы. При смене уровня mesh-экземпляры пересоздаются, shared buffers остаются.

Владелец board освобождает geometries/materials/textures и renderer; runtime удаляет listeners/observer, отменяет pointer и RAF, размонтирует Preact. Ошибка WebGL имеет DOM-экран и retry; context lost останавливает ввод. Автовозобновление после blur/hidden не выполняется — пользователь нажимает «Продолжить».

Не добавлять тяжёлую физику, постобработку или оптимизацию без измерения конкретной проблемы. DPR cap 2 и shared geometry/textures — настройки этого среза. Desktop headless GPU, число draw calls и отсутствие роста geometries при reset не доказывают p95 на телефоне.

## Источники API

Проверены 2026-10-09: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html), [cleanup](https://threejs.org/manual/pages/cleanup.html). При обновлении зависимости проверять changelog/API заново.

V4 influence effects use 18 retained upper-rim masks with the original inward shader waves and a board-owned pool of 54 small particles. Each type shares its geometry/material; anchors and time come from the board/runtime. Three particles per ordinary preview cell (including empty/foreign-color cells, excluding X); mask rings include X. Stateless visual sampling varies speed, phase, height and lateral bend, including later passes. All surrounding effects hide during a turn timeline; no working source contours/particles. Reduced motion keeps static masks, no particles. Runtime caches preview per state/cell/color; no separate RAF/model RNG.
