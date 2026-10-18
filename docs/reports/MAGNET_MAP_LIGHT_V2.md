# Мини-карта C и полный объём света v2

2026-10-18. Исходная ревизия50f34d4. Пользователь попросил сгенерировать экраны с другими магнитами и исправить отсутствие idle, переднего света и покрытия всего хекса. Из трёх экранов A/B/C пользователь выбрал C — мини-карта радиуса.

## Генерация и перенос C

Встроенный image_gen создал три полных мобильных экрана в текущем стиле игры. Экраны/исходный screenshot/промпты сохранены в docs/design/magnet-range-light/concepts-v2; выбран C. Из этого направления отдельными генерациями получены RGBA мини-карты7/19, затем выполнена точечная cleanup-итерация встроенным image_gen. Финальные PNG находятся в public/art/range-map-1.png и range-map-2.png; размеры/хэши/происхождение в concepts-v2/manifest.json. У обоих mode RGBA, alpha0…255 и прозрачный угол проверены чтением файла. Внешних изображений/лицензионных заимствований нет: референс — screenshot собственной игры.

App.js показывает карту рядом с магнитом и DOM-подпись1 RING/2 RINGS, карта радиуса1 меньше радиуса2. CSS hue-rotation согласует нейтральный голубой рисунок с семью цветами. Runtime переносит ту же карту/подпись в drag/hover. Магниты сохраняют исходный PNG-арт U-формы, как в выбранном C. URL mini-map через BASE_URL; существующий decode/retry загрузчик заранее получает оба новых PNG. Старые маленькие SVG-плашки не используются.

## Свет

Вместо узкой плоскости только за стопкой — полный внешний силуэт471×512 PNG, включая нижнюю переднюю стенку, задний и передний полупрозрачные объёмы. Шесть пиксельных опор:235,1;469,136;469,372;235,510;1,372;1,136. Ширина99.4% PNG, высота509/512: соответствует видимому силуэту, а не малой части внутреннего углубления. Реальные размеры/offset tile приходят из board без правки board.js.

Pool18×3 meshes, две общие ShapeGeometry и три ShaderMaterial принадлежат board. Back/floor/front order=cellOrder+3/+4/+70; фронт проходит поверх собственных chips, перелёты остаются выше. Цифры читаются через слабый прозрачный передний свет. sampleSourceLightIdle: дыхание3.2с, широкая волна вверх2.6с; эффект движется при неподвижном указателе. Envelope hold/fade550мс сохранён, reduced статичен с fade80мс. Один runtime clock, без RNG/RAF внутри эффекта; pause/hidden/reset/dispose сохранены. Matching sources и радиусы не менялись, частицы не возвращались.

Отдельный макет света просмотрен до переноса. В процессе исправлена ошибка GLSL `local.y--negative`: numeric literal помещён в скобки. Браузерная регрессия теперь слушает console.error наряду с pageerror, чтобы невидимый shader compilation failure не считался успехом.

## Реальные проверки

- Чистый release worktree без чужих board.js/magnet-glow.js/draw-order.js: pnpm check:full —194 tests passed, build passed. Node/build подтверждены отдельно от браузера.
- node tools/range-light-browser-check.cjs — desktop1280×900/mobile390×844, дополнительно320×844/844×390. Новые карты/подписи, full-hex6 vertices, back/front order, stationary idle при неизменном state, hold/fade/reduced, отсутствие particles, реальный drag/cancel/keyboard, pause/reset,20 циклов без роста geometries/textures, отсутствие pageerror/HTTP errors/WebGL console.error. Подписи внутри кнопок, горизонтального overflow нет.
- node tools/pages-browser-check.cjs — production /magnet-sort/, desktop/mobile реальные действия до победы за7 ходов, retry/pause, PNG decode и загрузка без404.
- Просмотрены screenshots полного макета, передний свет на стопках6/10 и чистые игровые desktop/mobile кадры. Записаны6 секунд idle/hold/fade: artifacts/light-v2/idle-and-fade.webm. Это browser surrogate, физический телефон не проверялся; производительность реального GPU не заявляется.
- Проверки gameplay/36 seeded routes по-прежнему проходят; правила/баланс/RNG не менялись.

Логи и кадры: artifacts/light-v2/ и artifacts/light-v2/release/. Публикация выполняется по постоянному AGENTS.md; итоговые GitHub run IDs и published smoke сохраняются в artifacts/light-v2/release/final-deploy.json после завершения deploy. Чужие локальные renderer-изменения не входят в коммит.

## Уточнения после скриншота пользователя — 2026-10-18

Предыдущая проверка подтвердила polygon, но не достаточную видимую альфу внизу. Исправлены sides shader у земли (без бокового сужения), floor.72 и передний ground+.32. Реальная pixel-регрессия читает lit/off screenshots по переднему центру, двум передним углам и обоим внешним плечам; старая версия провалила cyan-порог, новая проходит desktop/mobile. Тест: node tools/light-base-browser-check.cjs; результаты и кадры artifacts/light-base-fix/.

По новому указанию мини-карта остаётся только в панели выбора. Подписи1/2 RINGS удалены из текущего UI; floating overlay и его код/ref/CSS полностью удалены, при drag/hover карта не появляется на поле. Радиус остаётся в aria-label. Три исходных PNG-концепта не переписывались: это история в закрытом details; актуальный preview показывает только иконки без подписей.

Волна через маски расширена втрое: radial half-width.16→.48; края квинтически уходят к alpha0. Скорость/направление/количество волн и геометрия масок не менялись. Просмотрены фазы.25/.5/.75с, ошибок WebGL нет. Обновлённый range-light-browser проверил реальный drag, отсутствие подписей и floating overlay, hold/fade/reduced/pause/reset и20 resource cycles. Финальный чистый release: pnpm check:full —194/194 tests и build passed; оба browser-сценария passed, production /magnet-sort/ desktop/mobile дошли до победы за7 ходов, retry/pause passed. Чужие board/glow/draw-order исключены. Логи и кадры в artifacts/light-base-fix/release/.
