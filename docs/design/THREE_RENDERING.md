# Three.js rendering contract — GDD v0.3

2026-10-09. Этот контракт заменяет PIXI_RENDERING для активного entry. В проекте установлен Three.js 0.186.1; API сверены с установленной версией и официальной документацией.

## Владение

| Слой | Файл | Ответственность |
| --- | --- | --- |
| Чистая модель v3 | `src/prototype/model.js` | Immutable applyMagnet, ordered units, routing, thresholds, turn/result |
| Авторский контент | `src/prototype/levels.js` | Три поля, обучение, ограничения, проверяемые решения |
| Presentation | `src/prototype/motion.js` | Timeline отдельных элементов, stagger/landing/clear, pure sampling |
| Three view | `src/prototype/board.js` | Renderer, scene/camera, shared PNG textures/geometry/material, meshes, raycasting |
| Runtime | `src/prototype/runtime.js` | Единственный RAF, fixed step, input gate, pointer capture, pause/reset/hidden/resize/dispose |
| DOM | `src/prototype/App.js`, `prototype.css` | Preact HUD, магниты, обучение, результат, keyboard/live status |

View не вызывает симулятор. Модель не знает о Three.js, DOM, wall clock или FPS. UI не меняет stacks самостоятельно. Результат рассчитывается один раз; конечный state показывается после воспроизведения timeline.

## Рендер и ввод

- WebGLRenderer, WebGL 2; OrthographicCamera под фиксированным углом. Нет OrbitControls или второго animation loop.
- Отдельная mesh-группа на реальный элемент; фактическая высота соответствует индексу в массиве units. Geometry/material/texture общие для сцены. Актуальная графика — PNG-плоскости из утверждённых мокапов, ориентированные к фиксированной камере; это 2.5D в Three. Свет и отверстия запечены в рисунке.
- Resize задаёт CSS размер, drawing buffer с текущим DPR и frustum камеры. Весь board остаётся в кадре portrait/landscape.
- Pointer переводится из актуального `canvas.getBoundingClientRect()` в NDC, затем Raycaster проверяет плитки. Модель повторно проверяет разрешение на placement; target от view — только cell, не mesh.
- Drag захватывает pointer, игнорирует второй pointer и отменяется при cancel, lost capture, blur, hidden, resize, pause/reset/dispose. Tap поля с большим перемещением указателя не превращается в случайное размещение.
- Landing позиции рассчитываются по fromIndex/toIndex, отдельная низкая дуга и вращение не меняют model cells. Reduced motion отключает вращение/подъём.

## Lifecycle и стоимость

Растровая редакция 2026-10-09 заменяет прежние ExtrudeGeometry/RoomEnvironment/PMREM на общую PlaneGeometry, отдельную ShapeGeometry для raycast и восемь sRGB-текстур. MeshBasicMaterial не меняет запечённые цвета освещением или tone mapping. PNG загружаются и декодируются до ввода, включая DOM/nine-slice ресурсы. При ошибке партии успешные текстуры освобождаются; generation token отклоняет результаты после retry/dispose. Подробности и источники: [MOCKUP_ASSETS](MOCKUP_ASSETS.md). DOM +6 берётся из события очистки, не вычисляет игровой результат.

RAF принадлежит runtime и нужен только при активной timeline. Pause/hidden сбрасывают накопитель и предыдущий timestamp. Reset удаляет presentation и восстанавливает исходные units, переиспользуя renderer и GPU-ресурсы. При смене уровня mesh-экземпляры пересоздаются, shared buffers остаются.

Владелец board освобождает geometries/materials/textures и renderer; runtime удаляет listeners/observer, отменяет pointer и RAF, размонтирует Preact. Ошибка WebGL имеет DOM-экран и retry; context lost останавливает ввод. Автовозобновление после blur/hidden не выполняется — пользователь нажимает «Продолжить».

Не добавлять тяжёлую физику, постобработку или оптимизацию без измерения конкретной проблемы. DPR cap 2 и shared geometry/textures — настройки этого среза. Desktop headless GPU, число draw calls и отсутствие роста geometries при reset не доказывают p95 на телефоне.

## Источники API

Проверены 2026-10-09: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html), [cleanup](https://threejs.org/manual/pages/cleanup.html). При обновлении зависимости проверять changelog/API заново.
