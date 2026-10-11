# TASK-0025: отчёт, 2026-10-11

Собран [новый экран Figma](https://www.figma.com/design/Nntj95XfGJSGVy0FwadZMN?node-id=9-89), экспорт 941×1672 сохранён в `docs/design/prototypes/gameplay-counted-hex/figma-gameplay.png`. Отдельный Three.js preview использует те же изображения и проекцию. После замечания пользователя плоские векторные клетки заменены отдельными объёмно нарисованными PNG; возвращены point-up ориентация, раскладка 3–4–5–4–3, верхний/нижний blocker. Сохранены английские HUD/магниты и прежние 12 экранов.

## Проверки

- 5 новых unit tests: top run (включая повтор цвета через другой цвет), ID conservation/resting/flying/clearing/cleared, изменение счётчика на границах, цепочка 8 hops / 4 IDs, соседство/посадка/шаг.
- Браузерный сценарий: PASS, 14 fixture/motion combinations; проверены mesh/object IDs, счётчики, координаты посадок (ошибка x/z = 0), 320×640/390×844/430×932, pause/replay, 12 повторных reset без роста геометрий, dispose, отсутствие page errors. JSON, кадры, лог: `artifacts/gameplay-counted-hex/`.
- Запись цепочки: `docs/design/prototypes/gameplay-counted-hex/chain-motion.webm`.
- Через обычный in-app browser просмотрены mixed/chain, pause и scrub, reduced/tall20; в Figma проверены отдельные units, редактируемый счётчик, native components и PNG export. Полного ручного прохода каждой фазы всех fixtures не заявляем.
- `pnpm check:full`: тесты и production build прошли; полный лог `artifacts/gameplay-counted-hex/check-full.log`, журналы `.telegram-check-logs/`.

## Ограничения / оставшаяся приёмка

Это browser surrogate, не проверка физического телефона. Конкуренты не проходились live; использованы пользовательские кадры и ранее проверенные официальные описания, тайминги авторские. Figma MCP исчерпал Starter limit; изменения выполнены через браузерный редактор, без обхода доступа или изменения тарифа.

Художественное совпадение по пикселям не достигнуто/не измерено. Регулярная сетка и новые PNG отличаются от отдельных нерегулярно нарисованных фасок исходной генерации. Preview использует painted planes с flip в 3D; это не готовые универсальные volumetric chips. Перед переносом в production нужны окончательная визуальная приёмка, подтверждение разделимости 20 слоёв и оценка силуэта/пересечений при flip. Автоматический ID-check не доказывает отсутствие визуальных пересечений.

Итог: **review**, не done. Production `src/*` не изменялся. Параметры, источники и карта ассетов — `docs/design/GAMEPLAY_COUNTED_HEX.md`.
