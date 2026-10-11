# Three.js rendering contract — GDD v0.3

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
- Центр внутреннего углубления кремовой плитки — пиксель x=235 из 471, y=234 из 512. Сдвиг плоскости `(234/512 - .5) * tileHeight` направлен вниз по screen-up; прежний обратный знак смещал основание к нижнему бордеру. Фишка центрируется по полному контуру основания, компенсируя подъём половины первого слоя. Препятствие X состоит из сплошной серой подложки с тонким краем и отдельного прозрачного `blocker-x.png`: старый PNG с интегрированной плиткой не используется. Контуры обоих элементов проверяются внутри всех шести граней углубления и на покрытие 97.5%; реальные пиксели возле углов подтверждают заполнение подложки. Контактная тень использует одну общую CanvasTexture. [Исправление и источник X](../reports/BLOCKER_PLATE.md).
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
