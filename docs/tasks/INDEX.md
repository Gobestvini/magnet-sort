# Очередь Magnet Sort

Подготовлена 2026-10-07 по GDD v0.1 и общему диалогу, обновлена по текущему решению PixiJS/pseudo‑2.5D. TASK-0001–0010 завершены; TASK-0005 и TASK-0010 имеют явный waiver для физического теста.

Пользователь разрешил пропускать запросы на недоступные замеры и внешнее участие; каждое такое исключение помечено как waiver, а не как собранное evidence. TASK-0011 и последующие задачи в работе. После правок документации требуется `pnpm check:full`. Текущий дизайн: [GDD v0.2](../design/GDD_V0.2.md), [PixiJS rendering contract](../design/PIXI_RENDERING.md), [DECISIONS](../design/DECISIONS.md); оригинал: [GDD_SOURCE](../design/GDD_SOURCE.md).

Порядок продукта: первый цикл TASK-0001–0007 → анимации/score/FTUE TASK-0008–0010 → проверка TASK-0011 → кампания и web/social MVP → реальная платформа/реклама → приёмка TASK-0022. До go не начинать массовый контент, монетизацию и интеграции. Наличие отдельной задачи исследования платформы не требует ранней реализации SDK.

| Задача | Статус | Приоритет | Зависимости | Исполнитель |
| --- | --- | --- | --- | --- |
| [TASK-0001: Зафиксировать исполнимые правила и контракты игры](TASK-0001-rules-contract.md) | done | high | нет | сильная; высокий |
| [TASK-0002: Сделать hex-сетку и проверяемый формат уровней](TASK-0002-hex-level-data.md) | done | high | TASK-0001 | средняя; высокий |
| [TASK-0003: Подготовить оболочку Pixi.js и Preact с сохранением lifecycle](TASK-0003-app-shell.md) | done | high | TASK-0001 | средняя; высокий |
| [TASK-0004: Нарисовать читаемое поле и стеки](TASK-0004-board-render.md) | done | high | TASK-0002, TASK-0003 | средняя; средний |
| [TASK-0005: Сделать drag и tap-to-place для магнитов](TASK-0005-magnet-input.md) | done | high | TASK-0004 | средняя; высокий |
| [TASK-0006: Реализовать детерминированный ход pull → merge → clear](TASK-0006-deterministic-simulator.md) | done | high | TASK-0001, TASK-0002 | сильная; высокий |
| [TASK-0007: Собрать первый полный играбельный цикл](TASK-0007-playable-session.md) | done | high | TASK-0005, TASK-0006 | средняя; высокий |
| [TASK-0008: Сделать наглядные pull, merge и clear-анимации](TASK-0008-motion-feedback.md) | done | high | TASK-0007 | средняя; высокий |
| [TASK-0009: Добавить честный score и экран результата](TASK-0009-score-result.md) | done | high | TASK-0007 | средняя; высокий |
| [TASK-0010: Научить механике через первые пять уровней](TASK-0010-ftue-five-levels.md) | done | high | TASK-0008, TASK-0009 | средняя; средний |
| [TASK-0011: Проверить прототип и принять решение о расширении](TASK-0011-prototype-gate.md) | blocked | high | TASK-0010 | сильная; высокий |
| [TASK-0012: Собрать проверенную кампанию из 50 уровней](TASK-0012-campaign-fifty.md) | draft | normal | TASK-0011 | сильная; высокий |
| [TASK-0013: Сделать Home и устойчивый локальный прогресс](TASK-0013-progress-navigation.md) | draft | normal | TASK-0012 | средняя; высокий |
| [TASK-0014: Сделать web-ссылку на тот же puzzle и rematch](TASK-0014-friend-challenge.md) | draft | normal | TASK-0009, TASK-0011 | средняя; высокий |
| [TASK-0015: Добавить ежедневное общее поле и локальный рекорд](TASK-0015-daily-puzzle.md) | draft | normal | TASK-0012, TASK-0013, TASK-0014 | средняя; высокий |
| [TASK-0016: Добавить Undo, Hint и Extra Move с учётом assisted runs](TASK-0016-boosters.md) | draft | normal | TASK-0012, TASK-0014 | сильная; высокий |
| [TASK-0017: Добавить звук и доступную обратную связь](TASK-0017-sound-haptics.md) | draft | normal | TASK-0008, TASK-0013 | средняя; средний |
| [TASK-0018: Инструментировать воронку игры и challenge](TASK-0018-analytics.md) | draft | normal | TASK-0010, TASK-0014, TASK-0015, TASK-0016 | средняя; высокий |
| [TASK-0019: Проверить возможности Facebook Instant Games для MVP](TASK-0019-facebook-capabilities.md) | ready | high | нет | сильная; высокий |
| [TASK-0020: Подключить Instant Games и доступные социальные функции](TASK-0020-facebook-social.md) | draft | normal | TASK-0014, TASK-0015, TASK-0018, TASK-0019 | сильная; высокий |
| [TASK-0021: Подключить подтверждённые rewarded и ограниченные interstitial](TASK-0021-rewarded-ads.md) | draft | normal | TASK-0016, TASK-0018, TASK-0019, TASK-0020 | сильная; высокий |
| [TASK-0022: Провести полную приёмку MVP и записать ограничения](TASK-0022-mvp-acceptance.md) | draft | normal | TASK-0012, TASK-0013, TASK-0014, TASK-0015, TASK-0016, TASK-0017, TASK-0018, TASK-0020, TASK-0021 | сильная; высокий |

## Следующий шаг

TASK-0010/0011 получили явный waiver недоступных ручных проверок по указанию пользователя; завершить gate по имеющемуся evidence и перейти к TASK-0012.

## Покрытие GDD и границы

| Требование GDD | Задачи |
| --- | --- |
| §§4–5 hex/pull/merge/clear/goal/moves | 0001, 0002, 0004–0007 |
| §6 50 уровней, blockers/две опции/mini stacks | 0002, 0006, 0010, 0012 |
| §7 challenge entry/card/rematch/daily/friends | 0014, 0015, 0019, 0020 |
| §§8–9 Home/HUD/help/result/input/style/pseudo-2.5D rendering/animation/sound | 0003–0005, 0008–0013, 0017 |
| §10 hint/undo/extra move/rewarded/interstitial | 0016, 0019, 0021 |
| §11 PixiJS/Preact/determinism/JSON/deep link | 0001–0003, 0006, 0014 |
| §12 analytics/product hypotheses | 0011, 0018, 0022 |
| §16 prototype go/no-go, затем challenge | 0007–0011, 0014 |

Post-MVP без задач реализации: 51+ portals, Reverse/Twin, Bomb/Swap/Push, косметика/ASMR, аккаунты, meta, UGC, real-time multiplayer, фотореалистичное высокополигональное окружение и дорогой post-processing. Псевдо‑2.5D PixiJS board, фишки и магнит входят в MVP; несколько игр на общем engine не входят.

## Проверка подготовки

Проверены существующие точки входа, формат команд, 10 разделов каждого задания, ссылки, совпадение статусов/зависимостей и отсутствие циклов. Git-ревизии нет: папка не является репозиторием. `pnpm context` через launcher упёрся в автоустановку зависимостей; прямой `node tools/telegram/knowledge.js -- "магнит задачи"` прочитан успешно, специфичной памяти игры нет. Фактический результат обязательной попытки check:full указан в [отчёте подготовки](PREPARATION_REPORT.md).
