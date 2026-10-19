# Ассеты Magnet Sort

## Активный Three.js-дизайн — 2026-10-09

Отдельные PNG и nine-slice из утверждённых мокапов: [MOCKUP_ASSETS](MOCKUP_ASSETS.md), каталог `public/art/mockup/`. Ниже — исторические ресурсы Pixi MVP.

## Активное аудио v4 — 2026-10-19

TASK-0065: оригинальная композиция **Little Orbits**, D major, 96 BPM, 4/4,
32 такта / 80 секунд, форма A / A′ / B / A-return. Партитура — 384 явно заданные
ноты в `src/prototype/audio-score.js`: мягкий mallet, pad-трезвучия, бас,
низкий pulse и тихий brush. Используются sine/triangle осцилляторы и огибающие,
без записей, сторонних мелодий, samples и внешних генераторов. Код и партитура
созданы для Magnet Sort; сторонних аудиолицензий/файлов нет, сетевой вес аудиофайлов — 0.

| Сигнал | Момент |
| --- | --- |
| `ui`, `select`, `place`, `reject` | Действие UI, один выбор/drag, accepted placement, занятая клетка/X |
| `move`, `collect`, `arrive` | Посадка `unitMoved`, accentStart десятки, flights[].end сбора |
| `spawn`, `queue` | Start соответствующего presentation segment |
| `won`, `lost` | Переход к результату после timeline, один раз за run; музыка кратко приглушается |

`audio.js` принадлежит runtime: один gesture-started AudioContext, отдельные
music/SFX gain buses, low-pass и общий compressor, максимум 16 голосов, из них
8 SFX. Музыка использует audio clock и один lookahead timer 100 мс / 250 мс.
Pause сохраняет позицию музыки; hidden/platform/blur полностью останавливают вывод.
Dispose закрывает контекст, освобождает nodes/listeners/timer. В игровой idle нет
дополнительного RAF. В production нет audio debug journal.

`audio-settings.js`: изолированный `magnet-sort.audio.v1`, defaults 35% music / 70%
SFX, оба enabled после разрешённого жеста. Кнопки Music/Sounds и две громкости
на паузе; volume=0 не меняет enabled. Ошибка storage оставляет настройки в памяти.
Legacy progress и haptics не переносятся. Пользователь одобрил записи музыки и
эффектов 2026-10-19; технические проверки и ограничения — в [GAME_AUDIO](../reports/GAME_AUDIO.md).

API сверены по [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
и [OfflineAudioContext.startRendering](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering), 2026-10-19.

## Визуальный стиль по референсу — 2026-10-07

Фишки, округлённые hex-лунки, деревянные ящики и U-магнит созданы для проекта как SVG в src/render/art.js. Референс пользователя используется для композиции и материалов; фрагменты приложенной картинки в runtime не копируются. public/art/garden.svg — оригинальный векторный сад с небом, листьями и горшками. SVG-иконки HUD/result создаются в src/ui/icons.js.

При запуске 19 общих SVG растеризуются в 256×256 canvas/Texture: три вида клетки, четыре цвета × три высоты стопки, четыре магнита. Размытие тени запекается один раз, Pixi filters на каждой фишке отсутствуют. Text показывает актуальную массу поверх общей текстуры; удаление фишки не уничтожает shared assets. Загрузка ждёт всех операций и освобождает созданные текстуры при ошибке. Владелец ресурсов — Pixi application; scene уничтожает только display objects.

Локальный variable font public/fonts/Nunito.ttf (276 932 байта) получен из [Google Fonts, Nunito](https://github.com/google/fonts/tree/main/ofl/nunito). Право использования — SIL Open Font License 1.1; полный текст и copyright сохранены в public/fonts/OFL.txt. Шрифт обслуживается с игрой, обращения к Google Fonts во время игры не нужны.

Отчёт и сценарий визуальной проверки: [VISUAL_REFERENCE.md](../reports/VISUAL_REFERENCE.md).

## Историческое аудио Pixi MVP и тактильная обратная связь

В задаче TASK-0017 звуковые сигналы создаются кодом через Web Audio API; внешние записи, samples, fonts и изображения для звука не используются.

| Сигнал | Игровое событие | Источник и права | Файловый вес |
| --- | --- | --- | --- |
| Низкий короткий щелчок | `actionAccepted` | Синтез осциллятора, параметры в `src/audio/feedback.js`; код создан для проекта | 0 байт внешних audio-файлов |
| Мягкий частотный sweep | Первый `tokenMoved` за Action | Синтез осциллятора, параметры в `src/audio/feedback.js`; код создан для проекта | 0 байт внешних audio-файлов |
| Короткий восходящий тон | `stackMerged` | Синтез осциллятора, параметры в `src/audio/feedback.js`; код создан для проекта | 0 байт внешних audio-файлов |
| Короткий высокий аккордовый звон | `stackCleared` | Синтез осциллятора, параметры в `src/audio/feedback.js`; код создан для проекта | 0 байт внешних audio-файлов |

Огибающие и gain задаются в runtime; один Action ставит не более восьми последовательных звуков. Web Audio node освобождаются по `ended`/pause/reset/dispose. Звук включён настройкой по умолчанию, но `AudioContext` создаётся и возобновляется только в пользовательском жесте. Мьют и haptics preference сохраняются локально и доступны из Home и HUD. Vibration API вызывается только при наличии и позволяет ничего не делать на неподдерживаемом устройстве. Интерфейс и события игры остаются визуальными/текстовыми; звук и вибрация не являются единственным сигналом.

ASMR и заимствованные аудиоматериалы исключены. Реальный телефон не проверен; громкость, субъективное звучание и фактическая сила вибрации не измерялись.
