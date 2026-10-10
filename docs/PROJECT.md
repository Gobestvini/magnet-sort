# Карта проекта

## Активный 3D-прототип — 2026-10-09

| Путь | Назначение |
| --- | --- |
| `src/main.js` | Entry только нового прототипа |
| `src/prototype/runtime.js` | Единственный RAF/fixed step, input gate, tap/drag/capture, keyboard, pause/hidden/resize/reset/dispose |
| `src/prototype/model.js` | Rules v3: ordered units, immutable applyMagnet, BFS, верхний цвет, очистка по 6, победа/поражение |
| `src/prototype/levels.js` | Три авторских поля и детерминированные решения |
| `src/prototype/motion.js` | Поэлементная timeline: запуск, соседний полёт, посадка, очистка, reduced motion |
| `src/prototype/board.js`, `ring.js` | Three.js 0.186.1, OrthographicCamera, объёмные кольца с PNG-текстурой верха, плитки/магниты, raycasting, GPU cleanup |
| `src/prototype/assets.js`, `public/art/mockup/` | Декодирование PNG до ввода, общие текстуры, nine-slice рамки, manifest вырезок |
| `src/prototype/App.js`, `prototype.css` | Preact HUD, магниты, правила, hint/result/retry, адаптивная композиция |
| `src/game/hex.js`, `src/loop.js` | Переиспользуемые чистые hex helpers и fixed step |
| `tests/prototype-v3.test.js` | Соседство каждого переноса, открытые слои, масса, immutable state, все legal first placements, решения и timeline |
| `tools/browser-check.cjs` | Новый desktop/mobile viewport сценарий Three.js; `pnpm test:browser` |
| `tests/ring.test.js`, `tools/ring-browser-check.cjs` | Сквозное отверстие, толщина кольца, ориентация, UV без боковины; число реально отображаемых элементов и позиции слоёв на 782 кадрах |
| `src/legacy-main.js`, `tools/legacy-browser-check.cjs` | Сохранённые entry/браузерный сценарий прежнего MVP, не подключённые новым entry |
| `docs/design/GDD_V0.3.md`, `THREE_RENDERING.md` | Актуальные правила и renderer contract |
| `docs/design/mockups/2026-10-09-facebook-casual/index.html` | Галерея 12 AI-мокапов состояний; предложение оформления, не runtime UI |
| `docs/design/FIGMA_ASSEMBLY.md`, `tools/slice-exact-figma.py`, `tools/verify-exact-figma.py` | Актуальная Figma: 12 оригинальных мокапов из 615 растровых слоёв, независимая проверка нарезки и экспорта Figma |
| `tools/build-figma-screens.cjs`, `tools/figma-screen-importer.js` | Архивная приближённая векторная сборка, отклонена пользователем; не источник текущего оформления |
| `tools/figma-preview-check.cjs` | Проверка офлайн-превью, изображений, шрифта, внутренних ссылок SVG и обрезания текста; не проверка native Figma |
| `docs/design/CASUAL_MIGRATION.md`, `docs/reports/CASUAL_DESIGN.md` | План и проверенный первый перенос casual-темы в активную игру |
| `public/art/casual-hex.svg` | Оригинальный кодовый hex-фон нового UI, не растровый скриншот |
| `docs/reports/THREE_PROTOTYPE.md` | Референс, реализованный объём и фактические проверки |

Команды из корня: `pnpm dev`, `node --test tests/prototype-v3.test.js`, `pnpm check:full`, `pnpm test:browser`. Для нестандартного порта установить `GAME_BASE_URL`. Старый прогресс не изменяется, v1–2 не сравниваются с v3.

## Legacy MVP v0.2 — сохранённые исходники

Таблица ниже описывает прежнюю PixiJS-игру и её исторические проверки, а не активный import graph. PixiJS пока нужен её тестам; новая сборка использует Three.js.

| Путь | Назначение |
| --- | --- |
| src/legacy-main.js | Прежний app-owned RAF, Preact controls, resize/hidden/blur/HMR, dev gameDebug |
| src/render/application.js | PixiJS Application lifecycle; render обслуживается app-owned RAF |
| src/render/board.js | PixiJS 7×7 hex board view с псевдо‑2.5D слоями cells/tokens/magnet из LevelDefinition |
| src/render/art.js, src/render/stack-art.js, src/render/visual-assets.js | Оригинальная SVG-графика, общий cap из шести отображаемых слоёв, запечённые варианты текстур на цвет и cleanup; общий стиль Pixi/DOM |
| src/render/resolution-player.js | Replays simulator events into visual token poses; deterministic presentation timeline with reduced-motion profile and cancellation |
| src/render/effects.js | Lightweight Pixi Graphics for pull trails, placement magnet, merge mass, chain badge and cleared-cell pulse |
| src/render/layout.js | DPR-aware screen/cell helpers и преобразование координат указателя |
| src/ui/icons.js, public/art/garden.svg, public/fonts/ | Векторные иконки, садовый фон и локальный Nunito с OFL |
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
| src/platform/facebook.js | Feature-detected Instant Games adapter for validated entry data, explicit share, pause lifecycle, unverified leaderboard rows and bounded optional ads calls |
| src/platform/standalone.js | No-op platform lifecycle and explicit unsupported responses for remote-only features |
| src/platform/ads.js | Rewarded grant bound to a run ID, conservative completion gate, standalone unavailable path and disabled-by-default interstitial frequency policy |
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
| src/levels/campaign/*.json | Уровни 6–50 contentVersion 2: несколько цветов, тесный лимит, статические решения и crate puzzles rules v2 |
| tools/rebalance-campaign.mjs | Офлайн-авторинг кампании через simulator, поиск решений и отбор по случайной игре/размещениям; runtime не генерирует поля |
| src/ui/tutorial.js | Локальные подсказки ошибок, шаги choose/place/pull и session skip обучения |
| tests/ftue.test.js | FTUE solutions, timer-only hint, progression, skip/retry/completion |
| tests/campaign.test.js | 50 campaign replays, rules bands, массовый баланс и crate resolution |
| tests/boosters.test.js | Full-state Undo, bounded legal hints, cancellation, grant provider, assisted flags and extra-move eligibility |
| tests/audio-feedback.test.js | Audio unlock timing, cue order/deduplication, bounded voices, settings, unsupported API and cleanup |
| tests/analytics.test.js | Event schemas/dedupe, payload privacy, bounded collection, async sink failures and rewarded completion validation |
| tests/platform.test.js | Standalone and Instant Games adapter capability, lifecycle, validation, fallback, timeout, share, leaderboard and ad-completion behavior |
| tests/ads.test.js | Rewarded completion/cancel/stale-run/deduplication and disabled/interstitial policy gates |
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
| tools/reference-visual-check.cjs, docs/reports/VISUAL_REFERENCE.md | Повторяемые кадры плотного поля, drag/pull/result и отчёт переделки по референсу |
| docs/design/GDD_SOURCE.md | Полный текст исходного GDD v0.1 с SHA-256 DOCX |
| docs/design/GDD_V0.2.md, docs/design/PIXI_RENDERING.md | Текущая спецификация PixiJS/pseudo‑2.5D и rendering contract |
| docs/design/DECISIONS.md | Источники, расхождения и границы MVP |
| docs/design/RULES.md | Детерминированная трактовка правил и JSON-контрактов, rulesVersion 1–2 |
| docs/design/ASSETS.md | Источник/права/вес runtime-синтезированных звуков и ограничения тактильной обратной связи |
| docs/design/ANALYTICS.md | Event semantics, collection lifecycle, privacy allowlist and hypothesis denominators |
| docs/design/FACEBOOK_CAPABILITIES.md | Meta Instant Games documented capabilities vs account-specific unknowns and evidence boundary |
| docs/design/PLATFORM_CONTRACT.md | Async platform adapter surface, lifecycle, validation, privacy and standalone fallback |
| docs/design/ADS_POLICY.md | Disabled-by-default ad formats, verified rewarded-grant conditions and proposed interstitial limits |
| docs/design/LEVELS.md | Концепты, aha, bands и ограничения кампании 1–50 |
| docs/design/ARCHITECTURE.md | Владельцы модели/UI/runtime, lifecycle и план устройств/бюджетов |
| docs/design/fixtures/rules-v1.json | Восемь ручных before/action/after сценариев модели |
| docs/design/references/ | Визуальные схемы GDD; только внутренние референсы |
| docs/tasks/INDEX.md | Очередь Magnet Sort: 22 задания; рендер остаётся на PixiJS |
| docs/reports/PROTOTYPE_GATE.md | Протокол теста трёх новых игроков и baseline performance/readability gate |
| docs/reports/MVP_ACCEPTANCE.md | Internal technical MVP evidence, open device/platform waivers, and public rollout gate |
| docs/tasks/PREPARATION_REPORT.md | Фактические проверки подготовки и ограничения среды |

Рабочая директория всех команд — корень шаблона. `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm check:full`, `pnpm context -- "тема"`.

Порядок: ввод → fixed update → render(alpha). При добавлении движения храни previous/current и интерполируй только графику. Обновляй карту при изменении владельцев подсистем; не записывай каждый внутренний helper.
