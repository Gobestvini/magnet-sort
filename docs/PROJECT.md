# Карта проекта

| Путь | Назначение |
| --- | --- |
| src/main.js | App-owned RAF, Preact controls, resize/hidden/blur/HMR, dev gameDebug |
| src/render/application.js | PixiJS Application lifecycle; render обслуживается app-owned RAF |
| src/render/board.js | PixiJS 7×7 hex board view с псевдо‑2.5D слоями cells/tokens/magnet из LevelDefinition |
| src/render/resolution-player.js | Replays simulator events into visual token poses; deterministic presentation timeline with reduced-motion profile and cancellation |
| src/render/effects.js | Lightweight Pixi Graphics for pull trails, placement magnet, merge mass, chain badge and cleared-cell pulse |
| src/render/layout.js | DPR-aware screen/cell helpers и преобразование координат указателя |
| src/ui/App.js | Preact shell, accessible status, pause/reset/retry |
| src/input/pointer.js | Pointer capture, drag/tap placement validation, preview, cancellation and lock |
| src/loop.js / createStepper | Шаг 1/60 с, максимум 8 шагов кадра, dropped time, alpha |
| src/input.js / createInput | Клавиатура event.code, blur/reset/dispose |
| src/scene.js / createScene | Pixi prototype-level scene: update/render/resize/reset/snapshot/dispose |
| src/game/session.js / createSession | Validates and loads prototype levels, gates actions by phase, resolves simulator outcomes, supports retry/next and dev snapshots |
| src/game/scoring.js | RULES v1 RunResult scoring, clear percentage, assisted challenge eligibility and shared deterministic run comparator |
| src/ui/game-hud.js | Session-driven objective, moves, magnet choices, event feedback and terminal actions |
| src/ui/result.js | Accessible win/loss result card with score, moves, active time, clear percentage, chain links and contextual retry/next actions |
| src/game/hex.js | odd-r/axial преобразования, 7×7 neighbors/distance/ID и 49-cell materialization |
| src/game/levels.js | LevelDefinition validation, deterministic normalization и загрузка prototype levels |
| src/game/state.js | Immutable simulator state creation/copy and legal-placement invariants |
| src/game/simulator.js | Pure deterministic pull→merge→clear action resolution and canonical replay serialization |
| src/levels/prototype/*.json | Три versioned prototype puzzles с goal и авторским решением |
| index.html, src/style.css | Название Magnet Sort, адаптивная светлая оболочка |
| tests/loop.test.js, tests/input.test.js | Частоты кадров, stalls, ввод и очистка |
| tests/hex.test.js, tests/levels.test.js, tests/layout.test.js, tests/board-render.test.js, tests/pointer.test.js, tests/simulator.test.js | Geometry, level validation, rendering/input immutability, pointer commands and simulator fixtures/invariants |
| tools/telegram/knowledge.js | Память, актуальность хэшей, ограничение контекста |
| tools/telegram/verify.js | Тесты/сборка, логи, квитанция проверки |
| tools/telegram/economy.js | Инструкции экономии, JSONL usage, учёт кэша |
| docs/knowledge/pixijs-practices.md | Курсы и проверенные практики PixiJS 8 для Magnet Sort |
| docs/knowledge/threejs-journey.md | Только общие переносимые инженерные советы из Three.js Journey |
| docs/design/PIXI_RENDERING.md | Rendering-контракт Magnet Sort: PixiJS 8 и псевдо‑2.5D |
| tools/browser-check.cjs | Desktop/mobile/landscape layout, session win/loss/retry, animation resolve/cancel, pause/reset, hidden/blur, HMR disposer, ошибки |
| docs/design/GDD_SOURCE.md | Полный текст исходного GDD v0.1 с SHA-256 DOCX |
| docs/design/GDD_V0.2.md, docs/design/PIXI_RENDERING.md | Текущая спецификация PixiJS/pseudo‑2.5D и rendering contract |
| docs/design/DECISIONS.md | Источники, расхождения и границы MVP |
| docs/design/RULES.md | Детерминированная трактовка правил и JSON-контрактов, rulesVersion 1 |
| docs/design/ARCHITECTURE.md | Владельцы модели/UI/runtime, lifecycle и план устройств/бюджетов |
| docs/design/fixtures/rules-v1.json | Восемь ручных before/action/after сценариев модели |
| docs/design/references/ | Визуальные схемы GDD; только внутренние референсы |
| docs/tasks/INDEX.md | Очередь Magnet Sort: 22 задания; рендер остаётся на PixiJS |
| docs/tasks/PREPARATION_REPORT.md | Фактические проверки подготовки и ограничения среды |

Рабочая директория всех команд — корень шаблона. `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm check:full`, `pnpm context -- "тема"`.

Порядок: ввод → fixed update → render(alpha). При добавлении движения храни previous/current и интерполируй только графику. Обновляй карту при изменении владельцев подсистем; не записывай каждый внутренний helper.
