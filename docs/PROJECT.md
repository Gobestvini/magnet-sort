# Карта проекта

| Путь | Назначение |
| --- | --- |
| src/main.js | App-owned RAF, Preact controls, resize/hidden/blur/HMR, dev gameDebug |
| src/render/application.js | PixiJS Application lifecycle; render обслуживается app-owned RAF |
| src/render/board.js | PixiJS 7×7 hex board view с псевдо‑2.5D слоями cells/tokens/magnet из LevelDefinition |
| src/render/resolution-player.js | Replays simulator events into visual token poses; deterministic presentation timeline with reduced-motion profile and cancellation |
| src/render/effects.js | Lightweight Pixi Graphics for pull trails, placement magnet, merge mass, chain badge and cleared-cell pulse |
| src/render/layout.js | DPR-aware screen/cell helpers и преобразование координат указателя |
| src/ui/App.js | Preact shell, accessible status, tutorial, pause/reset/retry |
| src/ui/home.js | Home/Continue, disabled Daily/friend availability entries and local reduced-motion setting |
| src/input/pointer.js | Pointer capture, drag/tap placement validation, preview, cancellation and lock |
| src/loop.js / createStepper | Шаг 1/60 с, максимум 8 шагов кадра, dropped time, alpha |
| src/input.js / createInput | Клавиатура event.code, blur/reset/dispose |
| src/scene.js / createScene | Pixi prototype-level scene: update/render/resize/reset/snapshot/dispose |
| src/game/session.js / createSession | Validates FTUE/prototype levels, gates lesson progression, resolves simulator outcomes, supports skip/retry/next and dev snapshots |
| src/game/scoring.js | RULES v1 RunResult scoring, clear percentage, assisted challenge eligibility and shared deterministic run comparator |
| src/game/boosters.js | One-per-run booster policy, bounded authored-solution hint resolver, extra-move eligibility and standalone test grant provider |
| src/game/progress.js | Versioned local progress, best/completed runs, FTUE/campaign unlocks, safe storage fallback and settings |
| src/analytics/events.js | Allowlisted funnel event schema, bounded development collector, disabled injectable sink and verified rewarded completion gate |
| src/audio/feedback.js | Gesture-started synthesized Web Audio cues, event dedupe/order, optional Vibration API, mute/pause/hidden/dispose lifecycle |
| src/social/challenge.js | Versioned challenge links, bounded/safe URL decoding, frozen puzzle resolution, explicit Web Share/clipboard fallback and local SVG result card |
| src/social/daily.js | UTC dailyId and versioned deterministic rotation across reviewed frozen campaign puzzles |
| src/ui/game-hud.js | Session-driven objective, moves, magnets, Undo/Hint/Extra Move and sound/haptics controls |
| src/ui/result.js | Accessible win/loss result card with score, moves, active time, clear percentage, chain links and contextual retry/next actions |
| src/ui/challenge-entry.js | Incoming challenge target, assisted-policy notice, and single action to start the shared frozen puzzle |
| src/ui/home.js | Home/Continue, UTC daily card and per-day local best, disabled friend availability entry, and reduced-motion setting |
| src/game/hex.js | odd-r/axial преобразования, 7×7 neighbors/distance/ID и materialization empty/blocker/crate/token клеток |
| src/game/levels.js | LevelDefinition validation rules v1/v2, deterministic normalization и загрузка FTUE/prototype/campaign |
| src/game/state.js | Immutable simulator state creation/copy, crate occupancy and legal-placement invariants |
| src/game/simulator.js | Pure deterministic pull→merge→clear/crate resolution and canonical replay serialization |
| src/levels/prototype/*.json | Три versioned prototype puzzles с goal и авторским решением |
| src/levels/ftue/*.json | Пять первых campaign-уровней с tutorial metadata и проверенными решениями |
| src/levels/campaign/*.json | Уровни 6–50 со статическими решениями, bands и crate puzzles rules v2 |
| src/ui/tutorial.js | Локальные подсказки ошибок, шаги choose/place/pull и session skip обучения |
| tests/ftue.test.js | FTUE solutions, timer-only hint, progression, skip/retry/completion |
| tests/campaign.test.js | 50 campaign replays, rules bands, массовый баланс и crate resolution |
| tests/boosters.test.js | Full-state Undo, bounded legal hints, cancellation, grant provider, assisted flags and extra-move eligibility |
| tests/audio-feedback.test.js | Audio unlock timing, cue order/deduplication, bounded voices, settings, unsupported API and cleanup |
| tests/analytics.test.js | Event schemas/dedupe, payload privacy, bounded collection, async sink failures and rewarded completion validation |
| tests/daily.test.js | UTC date identity, deterministic frozen daily mapping, active-run continuity across midnight, and rotation bounds |
| tests/progress.test.js | Storage fallback, v1→v2 migration, per-day best/assisted result, comparator, FTUE progression and settings |
| tests/challenge.test.js | Challenge URL safety/versioning, frozen board/session, result comparator, card, and share fallback |
| index.html, src/style.css | Название Magnet Sort, адаптивная светлая оболочка |
| tests/loop.test.js, tests/input.test.js | Частоты кадров, stalls, ввод и очистка |
| tests/hex.test.js, tests/levels.test.js, tests/layout.test.js, tests/board-render.test.js, tests/pointer.test.js, tests/simulator.test.js | Geometry, level validation, rendering/input immutability, pointer commands and simulator fixtures/invariants |
| tools/telegram/knowledge.js | Память, актуальность хэшей, ограничение контекста |
| tools/telegram/verify.js | Тесты/сборка, логи, квитанция проверки |
| tools/telegram/economy.js | Инструкции экономии, JSONL usage, учёт кэша |
| docs/knowledge/pixijs-practices.md | Курсы и проверенные практики PixiJS 8 для Magnet Sort |
| docs/knowledge/threejs-journey.md | Только общие переносимые инженерные советы из Three.js Journey |
| docs/design/PIXI_RENDERING.md | Rendering-контракт Magnet Sort: PixiJS 8 и псевдо‑2.5D |
| tools/browser-check.cjs | Desktop/mobile/landscape, first-launch FTUE/skip, daily, challenge copy/open/rematch, booster Undo/Hint/Extra Move, session win/loss/retry, animation resolve/cancel, pause/reset, hidden/blur, HMR disposer, ошибки |
| docs/design/GDD_SOURCE.md | Полный текст исходного GDD v0.1 с SHA-256 DOCX |
| docs/design/GDD_V0.2.md, docs/design/PIXI_RENDERING.md | Текущая спецификация PixiJS/pseudo‑2.5D и rendering contract |
| docs/design/DECISIONS.md | Источники, расхождения и границы MVP |
| docs/design/RULES.md | Детерминированная трактовка правил и JSON-контрактов, rulesVersion 1–2 |
| docs/design/ASSETS.md | Источник/права/вес runtime-синтезированных звуков и ограничения тактильной обратной связи |
| docs/design/ANALYTICS.md | Event semantics, collection lifecycle, privacy allowlist and hypothesis denominators |
| docs/design/LEVELS.md | Концепты, aha, bands и ограничения кампании 1–50 |
| docs/design/ARCHITECTURE.md | Владельцы модели/UI/runtime, lifecycle и план устройств/бюджетов |
| docs/design/fixtures/rules-v1.json | Восемь ручных before/action/after сценариев модели |
| docs/design/references/ | Визуальные схемы GDD; только внутренние референсы |
| docs/tasks/INDEX.md | Очередь Magnet Sort: 22 задания; рендер остаётся на PixiJS |
| docs/reports/PROTOTYPE_GATE.md | Протокол теста трёх новых игроков и baseline performance/readability gate |
| docs/tasks/PREPARATION_REPORT.md | Фактические проверки подготовки и ограничения среды |

Рабочая директория всех команд — корень шаблона. `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm check:full`, `pnpm context -- "тема"`.

Порядок: ввод → fixed update → render(alpha). При добавлении движения храни previous/current и интерполируй только графику. Обновляй карту при изменении владельцев подсистем; не записывай каждый внутренний helper.
