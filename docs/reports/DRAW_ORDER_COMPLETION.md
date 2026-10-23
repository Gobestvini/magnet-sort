# Завершение локальных изменений отрисовки

2026-10-23. Проверена рабочая копия относительно `e0ae7a3` по запросу пользователя.

## Разбор и результат

Локальный `draw-order.js` повторял формулы `paintCell`/`paintUnit` из опубликованного
`board.js`: нового алгоритма сортировки в нём не было. Модуль сохранён как единый
источник порядка и включён в Git вместе с использующим его board. Видимый порядок
и профиль движения не изменены: плитка, тень, задний свет/основание, стоящие фишки
снизу вверх, счётчик, передний свет; затем ближний ряд. Перелёты выше наземных слоёв.
Это painter order для фиксированной камеры и PNG без depth test, а не универсальная
сортировка пересекающихся 3D-поверхностей.

Незавершённый параметр `order` в `magnet-glow.js` удалён: единственный runtime-вызов
скрывает старый эффект через `draw(null, ...)`, активный свет обслуживается
`influence-effects.js`/`source-light.js`. Файл восстановлен до HEAD. Старый эффект
не включали, его ресурсы и lifecycle не меняли. Посторонние `.codex-remote-attachments/`
не включаются в коммит.

## Подтверждение

- `pnpm check:full`: 239/239 тестов и production build PASS.
- `node tools/draw-order-browser-check.cjs`: 324 sampled кадра, 216 с движением,
  шесть направлений и встречные источники, normal/reduced, desktop 1280×900,
  portrait 390×844, landscape 844×390. Проверены фактические renderer orders:
  своя плитка/слои/счётчик, ближний ряд, задний/передний свет и перелёты над ними.
  Idle содержит семь цветов и высоты 1/6/8/9; перелёты — смешанные стопки 9/7,
  настоящий clear по 10 и честный конечный набор ID, включая spawn. Скрытые badges,
  акцент 10 перед сбором и восстановление финальной сцены PASS.
- По 20 одинаковых повторов после прогрева без роста: 9 geometries, 18 textures.
  Pause/resume/reset и отсутствие console/page errors подтверждены.
- `node tools/range-light-browser-check.cjs`: живой ввод, idle, независимое гашение
  источников, floor/back/front, reduced, pause/reset/resize и 20 повторов PASS.
- `node tools/pages-browser-check.cjs`: production под `/magnet-sort/`, desktop/mobile,
  победа за 7 ходов, счётчик, звёзды, retry и pause PASS.
- `node tools/tutorial-browser-check.cjs`: пять viewport, endpoints, выбор/resize/scroll,
  mouse cancel, pause/reduced и touch drop PASS.

75 снимков и `results.json`: `artifacts/draw-order/`; логи:
`artifacts/draw-order-*.log`, полные unit/build — `.telegram-check-logs/`.
Просмотрены contact sheet шести направлений (25/50/75% и pre-clear), исходные
desktop/mobile кадры и landscape idle. Чёрных прямоугольников/треугольников и
нарушенного перекрытия в просмотренных кадрах нет. Tutorial DOM скрыт только
в синтетической инспекции, поскольку описывает настоящую партию, а не fixture;
отдельный tutorial smoke проверяет штатное отображение и ввод.

Это проверка текущего рендера в Chromium, не установление причины исторического
чёрного артефакта из TASK-0042. Её художественный review остаётся отдельным.
Физический телефон и native Telegram не проверялись; Telegram не запускался.

Публикация выполняется через remote main и `deploy-pages.yml`; точный SHA,
результат CI и проверка опубликованной игры фиксируются в итоговом сообщении
и локальных артефактах выпуска.
