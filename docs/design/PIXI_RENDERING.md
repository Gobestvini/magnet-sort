# PixiJS pseudo‑2.5D rendering contract for Magnet Sort

Это обязательный rendering-контракт GDD v0.2 для игрового поля и эффектов. Несмотря на историческое имя файла, документ описывает PixiJS 8 и псевдо‑2.5D, не Three.js.

## Обязательные требования

- Игровое поле рендерится PixiJS 8 как 2D scene graph. Настоящие 3D-сцена, камера, mesh geometry и raycasting не являются требованиями.
- Псевдо‑объём создаётся контролируемыми 2D-слоями/спрайтами: кромка, тень, цветное лицо, блик и опциональный символ. Силуэты должны оставаться ясны при размере телефона.
- Hex grid, legal placement, pull/merge/clear, очки, RNG и replay остаются в чистой модели. Renderer отображает рассчитанные snapshots/events и никогда не меняет исход хода.
- Pointer Events mapping использует canvas bounding rect и board layout helpers; view возвращает candidate cell ID, затем модель/контроллер проверяет допустимость. Непустая/невалидная клетка не создаёт Action.
- Preact/DOM отвечает за HUD и доступные controls поверх canvas. Один app-owned RAF вызывает fixed-step update/render; Pixi `Ticker` не запускается параллельно.
- `Texture`, `GraphicsContext`, display objects, filters, event listeners и собственные canvas/asset resources имеют ясного владельца и cleanup. Shared assets освобождаются согласно общему lifecycle, не при каждом удалении фишки.
- Resize и DPR синхронизированы с CSS-размером viewport; DPR и antialias выбираются по замерам, не задаются как универсальные числа.
- Reset, pause, hidden, focus, HMR и dispose отменяют визуальные tween и pointer state, освобождают принадлежащие сцене объекты и не оставляют RAF/listener.
- Тени, фильтры, маски, сложные Graphics и дополнительные слои измеряются. Spritesheets/cache применяются только для подходящих повторно используемых/статичных элементов и после проверки на устройстве.

## Архитектурная граница

Реализация визуального референса 2026-10-07 использует retained Sprite containers и оригинальные SVG, запечённые в общие текстуры один раз при старте. Flat-top представление поворачивает экранную проекцию odd-r: row задаёт X, col и сдвиг нечётного row задают Y. Правила и IDs клеток остаются прежними; layout и pointer mapping используют одну проекцию. Во время slide интерполируются экранные координаты from/to клеток, включая stagger; сортировка стопок идёт по текущему Y. Preact использует те же SVG для кнопок и миниатюры уровня.

- `src/game/*`: rules, levels и simulator без PixiJS/DOM.
- `src/render/*`: PixiJS scene graph, layout/projection helpers, board/tokens/magnet, визуальное воспроизведение events и cleanup.
- app runtime: единственный RAF, resize, pause/hidden/reset/dispose.
- Preact/DOM: HUD и доступные controls.
- Общий assets module (если вводится): загрузка, кэш, scale variants, ошибки загрузки и владение общими текстурами.

## Definition of Done для псевдо‑2.5D

На реальном viewport board, tokens, blockers и magnet различимы без опоры только на цвет; псевдо‑объём улучшает считывание и не скрывает ячейки. Drag/tap placement остаётся точным при resize/DPR. Pause/reset/hidden/dispose не оставляют зависших эффектов и ресурсов. Производительность подтверждается одинаковым сценарием и устройством, а не общими обещаниями PixiJS.
