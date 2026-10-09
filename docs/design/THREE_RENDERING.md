# Three.js rendering contract — GDD v0.3

2026-10-09. Этот контракт заменяет PIXI_RENDERING для активного entry. В проекте установлен Three.js 0.186.1; API сверены с установленной версией и официальной документацией.

## Владение

| Слой | Файл | Ответственность |
| --- | --- | --- |
| Чистая модель v3 | `src/prototype/model.js` | Immutable applyMagnet, ordered units, routing, thresholds, turn/result |
| Авторский контент | `src/prototype/levels.js` | Три поля, обучение, ограничения, проверяемые решения |
| Presentation | `src/prototype/motion.js` | Timeline отдельных элементов, stagger/landing/clear, pure sampling |
| Three view | `src/prototype/board.js` | Renderer, scene/camera/light, shared geometry/material, meshes, raycasting |
| Runtime | `src/prototype/runtime.js` | Единственный RAF, fixed step, input gate, pointer capture, pause/reset/hidden/resize/dispose |
| DOM | `src/prototype/App.js`, `prototype.css` | Preact HUD, магниты, обучение, результат, keyboard/live status |

View не вызывает симулятор. Модель не знает о Three.js, DOM, wall clock или FPS. UI не меняет stacks самостоятельно. Результат рассчитывается один раз; конечный state показывается после воспроизведения timeline.

## Рендер и ввод

- WebGLRenderer, WebGL 2; OrthographicCamera под фиксированным углом. Нет OrbitControls или второго animation loop.
- Отдельная mesh-группа на реальный элемент; фактическая высота соответствует индексу в массиве units. Geometry/material общие для сцены, оригинальные процедурные формы без импортированных ассетов референса.
- Resize задаёт CSS размер, drawing buffer с текущим DPR и frustum камеры. Весь board остаётся в кадре portrait/landscape.
- Pointer переводится из актуального `canvas.getBoundingClientRect()` в NDC, затем Raycaster проверяет плитки. Модель повторно проверяет разрешение на placement; target от view — только cell, не mesh.
- Drag захватывает pointer, игнорирует второй pointer и отменяется при cancel, lost capture, blur, hidden, resize, pause/reset/dispose. Tap поля с большим перемещением указателя не превращается в случайное размещение.
- Landing позиции рассчитываются по fromIndex/toIndex, отдельная низкая дуга и вращение не меняют model cells. Reduced motion отключает вращение/подъём.

## Lifecycle и стоимость

Casual-перенос 2026-10-09: общие ExtrudeGeometry со скруглённым hex-контуром, керамическая рамка клеток и hex-отверстия колец. RoomEnvironment/PMREM создаются один раз при инициализации board; временные room/generator освобождаются сразу, render target принадлежит board и освобождается вместе с остальными ресурсами. Новые RAF/загрузчики текстур не добавлены. DOM рисует краткий +6 из активного события очистки, не вычисляет игровой результат. Фон — оригинальный локальный SVG, логотип и UI-магниты — SVG/DOM/CSS.

RAF принадлежит runtime и нужен только при активной timeline. Pause/hidden сбрасывают накопитель и предыдущий timestamp. Reset удаляет presentation и восстанавливает исходные units, переиспользуя renderer и GPU-ресурсы. При смене уровня mesh-экземпляры пересоздаются, shared buffers остаются.

Владелец board освобождает geometries/materials, shadow render target и renderer; runtime удаляет listeners/observer, отменяет pointer и RAF, размонтирует Preact. Ошибка WebGL имеет DOM-экран и retry; context lost останавливает ввод. Автовозобновление после blur/hidden не выполняется — пользователь нажимает «Продолжить».

Не добавлять тяжёлую физику, постобработку или оптимизацию без измерения конкретной проблемы. DPR cap 2, PCFSoftShadowMap 1024 и shared geometry — настройки этого среза. Desktop headless GPU, число draw calls и отсутствие роста geometries при reset не доказывают p95 на телефоне.

## Источники API

Проверены 2026-10-09: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html), [cleanup](https://threejs.org/manual/pages/cleanup.html). При обновлении зависимости проверять changelog/API заново.
