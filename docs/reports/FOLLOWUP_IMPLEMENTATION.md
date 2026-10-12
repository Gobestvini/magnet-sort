# TASK-0043–0047 — реализация 2026-10-12

Реализованы объёмный растровый фон и согласованная маска idle, новый макет/ассеты/DOM экран победы с затемнением, смешанные стопки с целями 50*N, прямые лучи магнита на две клетки и согласованные эффекты. Задачи завершены; удалённые полные проверки и публикация успешны. История и чужие локальные правки сохранены.

## Реализация

- 0043: background-v2.png, background-grid-mask-v2.png, manifest; одинаковый center/cover для body/loading/mask, прежний 11s sweep. Маска получена из тёмных канавок финального bitmap, не отдельной геометрии. Оригиналы сохранены.
- 0044: docs/design/victory-v2/reference.png, blank panel.png, five-point star.png, preview.html, SPEC.md/manifest/prompts. Реальные тексты/числа/CTA не запечены в runtime PNG. Макет и варианты 1/2/3 звёзд/последнего уровня проверены в браузере.
- 0045: decoded victory-panel-v2/victory-star-v2, DOM heading/stat tiles/earned stars, overlay rgba(25,5,86,.65), inert board, прежний focus trap/handlers/result timing; убран парящий магнит. Next level/Play again/Play from start.
- 0046: mixed-groups-v2: cell → height6/12 → groupCount2/3 → distinct group colors; равные непрерывные группы; goal50*N и динамический onboarding. Очередь, clear6, reserve-last-cell, IDs, масса, stars formula сохранены.
- 0047: magnet-influence.js — общий dry resolve/preview, 6 axial-лучей по 2 клетки, динамическое перекрытие чужим верхом, поштучные соседние события. V3 BFS не изменён. influence-effects.js — retained pool 25 контуров/48 частиц/12 волн; fade и параболы при drag, рабочие волны на активных рёбрах timeline; cache по state/cell/color, reduced/static и board cleanup.

Генерация: встроенная imagegen, четыре финальных результата. Полные prompts: [prompts.json](../design/victory-v2/prompts.json); подготовка alpha/crop/маски: tools/prepare-followup-art.cjs. Public PNG лежат в public/art/mockup; перенесённые assets не ссылаются на внешнее хранилище.

Чужие начальные изменения board.js/magnet-glow.js и draw-order.js сохранены вне коммита. Board в index содержит только свои добавления поверх HEAD (paintCell/paintUnit), без зависимости от untracked draw-order.js. Для проверки сформирована чистая копия Git index в %TEMP%/magnet-followup-verified.

## Проверки и фактические ограничения

- 28 целевых tests: лучи на чётных/нечётных рядах, 1/2/3 шаг, bent radius2, X/чужой верх/отсутствующая клетка/обход, opening нижнего цвета, preview == resolution, immutable/RNG/масса, 100 seeds mixed groups, параболы, v3 fixtures и drag FPS — pass.
- Полный набор: `node --no-opt --test --test-concurrency=1 tests/*.test.js` — 173/173 pass, лог artifacts/followup-serial-tests.log. `pnpm check:full` первоначально прошёл; финальные повторы получают native access violation 3221225477 в неизменённом legacy campaign, включая короткий путь, jitless и диагностический preload. Отдельный legacy campaign с --no-opt — 6/6 pass. Не удалён, не ослаблен.
- Чистая production-сборка `node --no-opt node_modules/vite/bin/vite.js build` — pass. Обычный Rollup один раз получил нативное повреждение состояния V8; no-opt build прошёл. Общий chunk warning >500k сохранён без соседнего refactor.
- `pnpm test:browser` (dev 5181, BROWSER_CHANNEL=msedge) — desktop/mobile победа за 11 реальных ходов, queue/moves/stars/retry/pause — pass. Chromium получил native page crash; переход в Edge предусмотрен заданиями.
- `tools/v4-level-browser-check.cjs` — level2 seed0: 102/100 за22 действия; level12 seed4: 600/600 за215 действий — pass. Длинная presentation завершалась существующим end-sampling hook; это не ручной просмотр всех 215 полных анимаций.
- `tools/v4-visual-check.cjs` — 6 направлений ×5 фаз ×desktop/mobile, 20units identities, hidden/pre-clear badges, border reset, layouts/pause/reset, 20GPU reuse cycles — pass.
- `tools/followup-browser-check.cjs` — 320/390×844/1280×900/900×500, DOM preview 1/2/3/final/long values, image decode/no overflow, shared cover mask/11s idle, active waves, source/path preview and reduced zone — pass; кадры визуально просмотрены.
- Pointer drag/resource test сравнивает ресурсы после первого GPU-прогрева (контур и точки впервые загружаются при drag). Некоторые попытки Edge/Chrome и Node driver получили нативные V8 crashes; `BROWSER_STABLE=1 node --no-opt tools/influence-drag-check.cjs` — pass:20 pointer drag/cancel cycles, truthful preview, pause cancellation, fixed GPU resources and reduced zone.

Реальные устройства не проверялись; viewport/headless не выдаются за телефон. Настоящие result 1/2/3 earned stars проверены на публичной игре:seed0/11ходов, seed5/8ходов, seed17/5ходов,54/50. tools/star-browser-check.cjs проверяет число earned slots, реальные moves/cleared, затемнение, inert board, Tab/Shift+Tab, Next level/Play again. После настоящих побед уровней2/12 дополнительно проверены Next level и Play from start. Баланс 3звёзд для всех seeds не обещается. Сохранённые маршруты — tools/fixtures/followup-witnesses.json; старый greedy больше не свидетель новой модели. Поиск свидетелей не подключён в runtime.

## Публикация

Коммит реализации `05dd9ae` отправлен в remote main. [Check game](https://github.com/Gobestvini/magnet-sort/actions/runs/38272136726) — success, включая шаг `pnpm check:full` на Node22/Linux. [Deploy GitHub Pages](https://github.com/Gobestvini/magnet-sort/actions/runs/38272136661) — success.

Публичный `GAME_BASE_URL=https://gobestvini.github.io/magnet-sort/ BROWSER_CHANNEL=msedge node --no-opt tools/pages-browser-check.cjs` — pass, desktop/mobile реальная победа за11ходов, очередь/шаги/звёзды/retry/pause. Публичный star-browser-check — три настоящих победы1/2/3stars и проверки overlay/inert/focus/actions — pass. [Игра](https://gobestvini.github.io/magnet-sort/).

Статусы done опираются на функциональные/browser/CI evidence, не на физический телефон. Проверочные команды с native Windows fault явно перечислены выше; Linux CI подтвердил полный стандартный check:full без адаптеров и исключений. Итоговый отчёт/расширенные browser witnesses сохраняются отдельным коммитом; его CI/deploy проверяется дополнительно.
