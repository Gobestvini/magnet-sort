# PixiJS: программа обучения и практики для игр

Проверено 2026-10-07 по официальным PixiJS 8 tutorials/guides и материалам курса/обучающих занятий. Текущая игра использует PixiJS 8.22.0; при реализации сверять примеры с установленной версией и не переносить вслепую API v7 или старше.

## Учебные материалы

Официальный [PixiJS 8 tutorials](https://pixijs.com/8.x/tutorials) содержит интерактивные пошаговые упражнения: Getting Started, Fish Pond, Choo Choo Train и Spine Boy Adventure. Начинать с Getting Started и повторять ровно ту тему, которая нужна текущему срезу. Официальные [Guides](https://pixijs.com/8.x/guides) — основной источник по архитектуре, scene graph, ticker, assets, событиям, тексту, accessibility и производительности.

Для изучения законченных game slices полезны официальный [PixiJS Open Games](https://github.com/pixijs/open-games) и [Showcase](https://pixijs.com/showcase). В Open Games есть исходники отдельных маленьких игр; изучать README/лицензию конкретного примера и брать только нужную идею. Showcase показывает разнообразие проектов, но сам по себе не гарантирует открытый код или актуальный v8 API.

Старые community videos/books могут обучать полезным общим концепциям, но часто показывают API v4–v7. В проекте применять их только после проверки различий с [v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8).

## Практики для Magnet Sort

### Сцена и владельцы

- Строй display tree по смысловым слоям: фон/доска, клетки, фишки, эффекты, подсказки. Контейнеры помогают управлять трансформами, видимостью и порядком отрисовки; не сортируй большие поддеревья каждый кадр без нужды.
- Сохраняй правила игры в чистых модулях `src/game/*`; Pixi view отображает immutable state/events и не принимает решения о legal move, merge или результате.
- В проекте app runtime уже владеет RAF/fixed-step. Вызывай рендер из этого цикла; не включай второй Pixi Application ticker. Измеряй отдельно симуляцию и render CPU.
- Для pseudo‑2.5D держи слои простыми и предсказуемыми: тень/нижняя кромка, основная форма, блик/символ. Состояние board определяет порядок; не полагайся на случайную глубину или цвет сам по себе.

### Ввод и hit testing

- Для мыши, пера и касания предпочитай единый Pointer Events сценарий. В v8 проверь семантику `eventMode`; обычные `pointermove` приходят над интерактивным объектом, а движение вне цели требует global pointer event.
- Ограничивай интерактивность только теми объектами, которым она нужна. Задавай `hitArea` для удобных стабильных целей и отключай обход неинтерактивных веток (`eventMode = 'none'`/`interactiveChildren = false` где применимо).
- Pointer input только формирует candidate action. Контроллер/модель повторно проверяет фазу сессии, цвет, границы поля, blocker и занятость клетки.
- Для drag обрабатывай cancel/outside, pointer capture/lock, второй pointer, pause, reset, blur и dispose. Чувствительные к размеру цели измеряй в CSS pixels, независимо от DPR.

### Ассеты и загрузка

- Предпочитай `Assets` API и манифесты/пакеты: async load, кэширование и алиасы дают единый путь доступа к ресурсам. Не загружай один URL повторно в каждом компоненте.
- Показывай loading/error/retry состояние, если загрузка обязательного ассета не завершилась. По возможности сначала загружай только ресурсы первого играбельного экрана, остальное — фоном после старта.
- Для повторяющихся элементов используй spritesheet, если набор и draw order это оправдывают. Держи scale variants для мобильной плотности разумного размера; проверяй transfer и texture memory, не только исходные PNG bytes.
- Удаление display object и выгрузка общего Texture — разные действия. Явно назначай владельца общим текстурам; не уничтожай shared texture вместе с одной фишкой. Unload после подтверждения, что ресурс больше не нужен.

### Производительность и графика

- Сначала измерь один и тот же сценарий на целевом устройстве. Не оптимизируй гипотетическую нагрузку и не принимай заявленные engine benchmark как результат своей игры.
- Сохраняй статичные `Graphics`/контексты; не пересоздавай сложную геометрию при каждом кадре. Для повторяемой графики рассматривай один переиспользуемый объект или спрайт/текстуру.
- Группируй похожие текстуры/операции по draw order; смены blend mode, масок, фильтров и текстур могут разбивать batch. Эффекты — прежде всего читабельность, после этого стоимость.
- Не включай culling вслепую: он может ускорить GPU-bound сцену и ухудшить CPU-bound. В небольшой статичной 7×7 доске сравнивать до/после, а не добавлять по умолчанию.
- Меняющийся каждый кадр текст не перерисовывай без необходимости. Текст и эффекты обновляй только при изменении значения; для больших динамических текстовых наборов изучи BitmapText.
- Мягкий псевдо‑объём предпочитает готовые лёгкие слои/текстуры; массовые динамические filters и sprite masks оставляй за пределами MVP, пока измерения не оправдают их.

### Lifecycle и качество

- Описывай явный `dispose`: удалить принадлежащие сцене display objects, event listeners, timers/tweens, DOM handlers и выделенные ресурсы. Не уничтожать shared assets без владельца.
- Проверяй повторяемые циклы mount → play → reset → pause/hidden → resume → dispose. Сравни число listeners/объектов и память до/после серии повторов.
- Изменение размеров проверяй в portrait, landscape, resize и разных DPR. Геометрию поля считай в CSS layout space, потом применяй renderer resolution; координаты ввода используй через актуальный canvas rect/layout.
- Сочетай unit тесты чистых правил и layout с browser flow для pointer/resize/lifecycle; эмуляция touch не подтверждает физические ощущения и производительность телефона.

## Курс как последовательность для исполнителя

1. Getting Started: Application init, Canvas mount и базовый render.
2. Scene graph/Container/Sprite/Graphics: разложить поле на слои и отрисовать prototype board.
3. Assets: загрузить только нужные текстуры, переиспользовать кэш, показать ошибку загрузки.
4. Events: протащить pointer/touch command в существующий input controller.
5. Ticker/render loop: подключить render к app-owned RAF и сохранить fixed step.
6. Resize + accessibility: проверить portrait/landscape и доступный DOM HUD.
7. Performance + cleanup: снять профиль того же игрового сценария; найти ненужные объекты, draw calls, filters и утечки.
8. Fish Pond или Choo Choo Train: изучать как пример сборки сцены/движения, не переносить архитектуру целиком в puzzle.

На каждый урок фиксируй: конкретное поведение игры; минимальное изменение; владельцев созданных ресурсов; поведенческий критерий; один измеримый результат; какие API проверены для v8. Не копируй готовый tutorial game в продукт.

## Источники

- [Официальные PixiJS 8 tutorials](https://pixijs.com/8.x/tutorials), проверены 2026-10-07.
- [PixiJS Open Games](https://github.com/pixijs/open-games), репозиторий с исходными кодами игр и индивидуальными README; просмотрен 2026-10-07.
- [PixiJS Showcase](https://pixijs.com/showcase), примеры выпущенных проектов; просмотрен 2026-10-07.
- [PixiJS 8 guides](https://pixijs.com/8.x/guides) и [architecture](https://pixijs.com/8.x/guides/concepts/architecture), проверены 2026-10-07.
- [Performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips), проверены 2026-10-07.
- [Assets](https://pixijs.com/8.x/guides/components/assets), [Events / Interaction](https://pixijs.com/8.x/guides/components/events), [Container](https://pixijs.com/8.x/guides/components/scene-objects/container), [Garbage Collection](https://pixijs.com/8.x/guides/concepts/garbage-collection), [v8 migration](https://pixijs.com/8.x/guides/migrations/v8), проверены 2026-10-07.
- [Legacy community tutorials](https://legacy.pixijs.com/tutorials/) использованы только для поиска уроков; большинство материалов устарели и не являются v8 API reference.
