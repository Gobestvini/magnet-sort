# Стопки меньше 10 и компактные фишки

2026-10-20, TASK-0074/0075, исходная ревизия `9f6756d`.

## Результат

Генерация 6/8 вместо 6/10, одинаковое число RNG choices и прежние равные группы. Устойчивые стопки <10 целиком, значит скрытая группа тоже <10. Входные стопки >=clearSize в любой точке поля целиком создают unitsCleared перед переносом, даже при другом верхнем цвете. При обычном притяжении сбор десятки немедленный, остаток сохраняется. Все ID проходят прежнюю timeline и начисляются в HUD по прибытии.

Все семь цветов используют общий CHIP_HEIGHT .08 вместо .14: вертикальный шаг меньше на 42.86%. Ширина, PNG, footprint, камера и количество ID прежние. Chip layout уже компенсирует нижнюю половину шага; единый параметр используется также при перелёте, badge и старте DOM-сбора. Снимки 1/6/8/9 и mixed просмотрены; перерисовка не понадобилась.

Seed/action replay несовместим с прежней генерацией. Новая contentVersion `sub-ten-2026-10-20.1` переводит старую запись в штатный unsupported-version с явным recovery, не удаляет её автоматически. Пересчитаны и проверены 36 winning witnesses, четыре пары win/worse и 36 production/explicit A state/event traces. Старые pre-seam hashes больше не описывают текущую версию контента.

## Проверки

Из отдельного checkout с независимым pnpm install --offline; чужие изменения board.js, magnet-glow.js и draw-order.js не попали в проверки или релиз.

- `pnpm check:full`: 239/239 тестов, build PASS. Логи `.telegram-check-logs/` в проверочном checkout.
- `node tools/compact-stacks-browser-check.cjs`: desktop 1280×900, portrait390×844, landscape844×390 PASS. Все 7 цветов, 47 ID, измеренный шаг .14→.08, одинаковый для всех слоёв. В normal/reduced: mixed10 вне радиуса +6+8 matching → ровно20 собранных, 0 начислений на старте, remainder4, нет дублей. 20 одинаковых повторов после прогрева без роста geometries. Pause/resume/restart PASS, console/page errors отсутствуют.
- `node tools/pages-browser-check.cjs`: production desktop/mobile, победа за7 ходов, конечный collected, stars, retry и pause PASS.
- `node tools/tutorial-browser-check.cjs`: production5 viewports, mouse/touch, resize/scroll, pause/reduced PASS.
- Сравнения снимков: `artifacts/compact-before/` и `artifacts/compact-stacks/` проверочного checkout; базовый снимок использует прежний .14 на той же ручной fixture. Финальный исходник восстановлен в .08.
- При подготовке проверены структура двух задач, существование файлов/символов, команды и зависимости. После авторизации выполнена реализация; исходные задания не выдаются за тесты.

Для frozen fixture используется viewport screenshot с проверкой ID после снимка: fullPage в landscape вызывал resize и возвращал реальную игровую сцену поверх инспекции. Этот неудачный подход выявлен assertion и заменён. Первое появление backing геометрии при перелёте — прогрев, поэтому рост проверяется повтором одинаковой стадии, а не сравнением разных стадий.

## Измерение сложности

`node tools/verify-v4-balance.mjs compact --measure-only`: 1200 runs,12 уровней×50seed×2policy, cutoff320; 36 winning replays/4 альтернативы проверены. Greedy wins по уровням:50,50,50,48,50,49,50,46,47,30,47,5 из50. Timeout0 во всех группах; random wins30,32,20,1,1,0,0,0,0,0,0,0. L12 greedy median272 хода среди побед. Это описание выбранных политик/seed, не человеческая выигрышность и не гарантия проходимости. Соседняя калибровка целей/cadence/радиусов не выполнялась. Исторические баланс-gates не считаются пройденными этим measure-only запуском.

## Публикация

Коммит реализации `d66c2ce5188d87e726be00812c2be75281b64a46` отправлен в remote main. [Check game](https://github.com/Gobestvini/magnet-sort/actions/runs/39413561423) и [Deploy GitHub Pages](https://github.com/Gobestvini/magnet-sort/actions/runs/39413561389) success, включая loading/pages/tutorial, platform builds/tests и embed packaging. Опубликованный build-info.json подтвердил точную ревизию d66c2ce. `GAME_BASE_URL=https://gobestvini.github.io/magnet-sort/ node tools/pages-browser-check.cjs` из checkout того же коммита: desktop/mobile, победа за7 ходов, collected/stars, retry/pause PASS. TASK-0074/0075 — done. Последующий коммит закрытия меняет только документацию.

При повторной локальной проверке на Node24 наблюдался нестабильный сбой неизменённого legacy campaign.test.js (один native exit3221225477, один standalone TypeError в compareIds). Финальный полный прогон239/239 и независимый Linux CI/Node22 прошли. Legacy модуль в этих задачах не менялся; это ограничение воспроизводимости локальной среды, отдельная причина не установлена.

Снимки и итоговые логи сохранены в основной рабочей папке: `artifacts/compact-before/`, `artifacts/compact-stacks/`, `artifacts/compact-stacks/verification-logs/`. Применён приём проверки релиза из чистого checkout и точной ревизии; новая проектная заметка добавлена в существующую docs/knowledge/direct-magnet-effects.md.

Физический телефон и native Telegram не запускались. Производительность реального телефона не измерялась.
