# Стопки по 10, радиусы и свет источников

2026-10-18, TASK-0060–0064. Исходная ревизия a2401c6. Запрос выполнен в активном Three.js/v4, legacy v3 не менялась. Чужие изменения board.js/magnet-glow.js/draw-order.js исключаются из релиза.

## Результат

- Генератор: стопки6/10 с прежними одноцветными/двухцветными группами. clearSize10: target собирает ровно10, остаток сохраняется; toIndex никогда не выше9. Аномальная входная стопка >10 целиком собирается через те же unitsCleared/collection, включая смешанные цвета и источники вне радиуса. В штатной игре такие состояния не возникают.
- Каждый выданный магнит seeded получает radius1/2 (50/50), retained сохраняет тип. Один resolver управляет моделью, rings, подписью и SVG-значком рядом с магнитом в tray/drag/hover. Подделанный action.radius не влияет на тип.
- Только actual exposed matching sources дают столбы цвета магнита. Они остаются после опустошения источника до конца обработки всего магнита, затем smoothstep fade550мс. Reduced fade80мс. Сохранены геометрические волны бортиков в радиусе выбранного типа.
- Убраны preview-частицы, collection bursts/sparkles, victory burst. Сами фишки и их непрерывные шлейфы в прогресс сохранены. Эффект использует общий clock/geometry и пул18, без RAF/RNG внутри.

## Макеты до переноса

`docs/design/magnet-range-light/index.html` + preview.js. Оригинальные code-native SVG public/art/range-1.svg/range-2.svg; авторская графика проекта, внешних заимствований нет. Общий shader source-light.js применяется сначала в макете, затем в игре. Показаны оба значка, выбранный вариант, preview/работа/fade, ручной scrub/play и reduced. На первой mobile версии исправлена растянутая orthographic проекция, затем просмотрены desktop1000×950/mobile390×844 и fade. Кадры artifacts/range-light/mockup-*.png. Параметры яркости/высоты столба уточнены на игровом фоне.

## Проверки

- Релевантные 29 tests: границы6/9/10/11, mixed overflow, conservation/ID/immutability, radius1/2 odd/even/edge, forged radius, seeded retained types, matching sources и fade.
- pnpm check:full: 192 tests, 192 passed, build passed; логи .telegram-check-logs/. Повторено на чистом release worktree без локальных чужих renderer-файлов: также192/192 + build.
- node tools/range-light-browser-check.cjs: desktop1280×900/mobile390×844; иконки/подписи, matching preview, active lights после снятия источника, hold/fade/reduced, отсутствие particles, реальный keyboard/drag/cancel, pause clock/reset/resize, 20 resource cycles без роста geometries/textures. Кадры/лог artifacts/range-light/.
- node tools/pages-browser-check.cjs: production /magnet-sort/, реальные keyboard действия до победы, retry/pause, desktop/mobile viewport — passed (7 ходов у контрольного seed).
- Дополнительный v4-visual-check проверяет шесть направлений, десять ID, pre-clear10 и края прогрессбара. Passed desktop/mobile, шесть направлений × пять фаз, pre-clear10, pause/reset/20 GPU cycles. Чистый browser level2/12: goal100/600 за15/227 реальных действий с выборкой окончания presentation.
- Физический телефон и субъективная проверка новичков не проводились; browser viewport не является проверкой реального устройства. Vite предупреждение о chunk>500kB прежнего класса, build успешна.

## Наблюдаемое влияние на сложность

Проверка `node tools/verify-v4-balance.mjs ten-range --measure-only`: 50 greedy и50 random seed каждого уровня, 1200 партий. Greedy победы по уровням1–12: 50/50/50/50/50/50/43/50/48/36/42/8, всего527/600. Все партии завершились won/lost, timeout0. Найдены и verifyReplay проверены36 победных маршрутов на разных seed и4 пары выигрыш/худшая альтернатива; fixtures пересчитаны. Это подтверждает доступность побед на каждом уровне, не все seed и не умеренную сложность. L12 заметно сложнее; прежний порог35/50 текущая комбинация не выполняет. Запрошенные правила сохранены, отдельная перенастройка баланса не добавлена.

## Поставка

Коммит `634df91` отправлен в remote main. [Check game39109610008](https://github.com/Gobestvini/magnet-sort/actions/runs/39109610008) и [Deploy Pages39109609995](https://github.com/Gobestvini/magnet-sort/actions/runs/39109609995) — success. После публикации production smoke по публичному URL прошёл desktop/mobile до победы за7 ходов, повтор и паузу. Опубликованный JS bundle совпал с чистой локальной production-сборкой, оба SVG range1/2 вернули HTTP200. Все TASK-0060–0064 done. Документационный коммит закрытия не меняет проверенный игровой код; по постоянному правилу также публикуется.

Логи чистого релиза и published smoke сохранены в artifacts/range-light/release/. Чужие локальные board.js/magnet-glow.js/draw-order.js и .codex-remote-attachments не включены в коммиты.
