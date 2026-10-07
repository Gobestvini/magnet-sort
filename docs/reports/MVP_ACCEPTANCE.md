# Приёмка Magnet Sort MVP

Дата: 2026-10-07  
Проверенная ревизия кода: `64598cb` (TASK-0021)  
Решение: **внутренний технический MVP принят с waiver; публичный rollout остаётся `rework`**.

## Объём принятия

Текущая ветка содержит законченный standalone web puzzle loop, кампанию и FTUE, локальный прогресс, challenge URL/rematch, daily rotation, assisted boosters, synthesized audio/optional haptics, privacy-safe dev analytics и feature-detected Instant Games/adapters. UI и gameplay остаются на PixiJS 8 + Preact с псевдо‑2.5D 2D scene graph; Three.js не использован.

Это принятие проверяет воспроизводимые игровые правила, сборку и автоматизированный браузерный сценарий. Оно **не является** пользовательским тестом понятности, оценкой телефонной производительности, реальной интеграцией Meta app, проверкой рекламной политики или разрешением опубликовать игру. Публичный gate из `docs/reports/PROTOTYPE_GATE.md` сохраняет `rework`.

## Проверенное evidence

| Проверка | Результат | Граница evidence |
| --- | --- | --- |
| `pnpm test` на коде TASK-0021 | 119/119 passed | Автоматические unit/behavior и проектные инструментальные тесты, не ручное ощущение игры |
| `pnpm test:browser` на коде TASK-0021 | Passed: desktop/mobile layout, pause/reset, input, runtime errors | Playwright browser/touch-viewport surrogate, не реальный телефон и не конкретная browser version measurement |
| `pnpm check:full` на коде TASK-0021 | Тесты и production build passed | Build не доказывает host approval или performance |
| `git diff --check` | Passed | Проверка пробелов/patch integrity |
| Campaign/FTUE/replay | В suite проверяются 50 campaign levels, пять FTUE уровней, авторские решения, conservation и determinism | Не является human usability study |
| Platform/ad fallback | Adapter mocks проверяют capabilities, malformed entry, timeout/rejection, pause cleanup, explicit completion, stale run и disabled interstitial | Не является Meta SDK/app/test-placement evidence |

Полный вывод проверок и журналы остаются в `.telegram-check-logs/`. Детали отдельных этапов: [TASK index](../tasks/INDEX.md), TASK-0011 prototype gate, TASK-0020 platform adapter report и TASK-0021 ads report.

## Функциональная сверка

- **Подтверждено автоматизацией:** 50 валидируемых кампанийных уровней; пять FTUE уроков; детерминированные pull/merge/clear, сохранение массы и replay; end-state/result/retry; challenge payload validation и локальный web share fallback; дневная UTC rotation; local progress; Undo/Hint/one-per-run Extra Move и assisted marking; event allowlist/PII boundaries; audio and optional haptics lifecycle.
- **Platform boundary:** standalone path доступен без FB SDK. FB adapter используется только при обнаруженном `window.FBInstant`; entry data проходит существующую challenge/daily validation, share вызывается действием игрока. Friend ranking UI остаётся disabled; unverified client scores не выдаются за доверенный рейтинг.
- **Ads boundary:** standalone dev-only test reward имеет явную подпись и не считается рекламой. Production default-deny. Rewarded grant требует явного completion-флага и неизменного run ID; пустая placement configuration не запускает ad. Interstitial выключен по умолчанию; предложенный policy cap при отдельном одобрении — один за сессию, минимум 120 секунд между показами, без FTUE.
- **Визуальная граница:** сцена построена в PixiJS 8 и содержит псевдо‑2.5D слои/кромки/тени. Автоматизированная проверка не доказывает читаемость и ощущение объёма на физическом телефоне.

## Открытые проверки и условие выпуска

По прямому распоряжению пользователя проверки, требующие предоставления телефона, привлечения тестеров или доступа к Meta app/dashboard, пропущены с waiver. Они не обозначаются как пройденные.

| Открытый пункт | Статус | Условие повторной проверки |
| --- | --- | --- |
| Три независимых новых игрока, понятность FTUE, интерес/повтор | Не выполнено; waiver | Провести протокол из `PROTOTYPE_GATE.md` на трёх участниках |
| Touch feel и читаемость псевдо‑2.5D на телефоне | Не выполнено; waiver | Физический целевой телефон, фактические OS/browser/build |
| p95 кадра, input-to-feedback, cold-load transfer, retry resource growth | Не измерены; waiver | Записать baseline и сценарий на том же устройстве по `GAME_BRIEF.md`/`PROTOTYPE_GATE.md` |
| Meta app approval/API access/real challenge context/friend ranking | Не подтверждено; waiver | App-specific developer/tester context и текущее evidence из Meta dashboard |
| Rewarded test placement, cancellation/no-fill и completion semantics | Не подтверждены; waiver; ad выключен | Реальный непубличный test placement и прямой JS SDK flow |
| Interstitial policy/account eligibility | Не подтверждены; waiver; interstitial выключен | Отдельное актуальное Meta policy/account review до включения |

Продуктовые предположения 20–60 секунд сессии и 150–300 мс input response остаются гипотезами/целями, не результатами измерений. Не включать рейтинги или рекламные форматы и не объявлять публичный release gate пройденным по этому отчёту. Публикация не выполнялась в рамках TASK-0022.

## Дефекты и ограничения

При последнем автоматизированном прогоне runtime/assertion дефектов не зарегистрировано. Вывод о production release не выносится из-за перечисленного открытого human/device/platform evidence. Численные performance и memory результаты отсутствуют, поскольку физический телефон не был доступен в рамках этого разрешения.
