# Архитектура прототипа Magnet Sort

## Активная архитектура v0.3 / rulesVersion 3 — 2026-10-09

`src/main.js` → `src/prototype/runtime.js` → чистые model/levels/motion, Three board и Preact App. Владельцы и lifecycle описаны в [THREE_RENDERING](THREE_RENDERING.md); правила — [GDD v0.3](GDD_V0.3.md).

Input → controller phase/placement gate → immutable applyMagnet → final state + ordered unit events → timeline → Three meshes. Runtime владеет единственным RAF, fixed step и DOM listeners; renderer не вызывает setAnimationLoop. Idle рендерится по событиям, animation — по RAF. Pause/blur/hidden замораживают время; reset/смена поля отменяют timeline. Shared geometry/material и shadow targets принадлежат board и явно освобождаются при dispose.

Старый единый token.mass заменён массивом units снизу вверх. Сохранения и frozen puzzles v1–2 остаются отдельными; текущий прототип не использует прежние daily/challenge/ads/progress. Three.js 0.186.1 закреплён lockfile, PixiJS остаётся для legacy-кода и тестов.

## Историческая архитектура MVP v0.2

Следующие разделы относятся к сохранённым `src/legacy-main.js`, `src/scene.js`, `src/render/*` и модели v1–2. Они не ограничивают активный 3D-прототип.

Версия контракта: `rulesVersion: 1`, `schemaVersion: 1`. Этот документ задаёт владельцев и потоки данных. Реализация и целевая архитектура: PixiJS 8.22.0 + Preact 11.0.0.

## Слои и владельцы

| Слой | Владелец | Ответственность |
| --- | --- | --- |
| Модель (`src/game/*`, чистый JS) | simulator | Level validation, odd-r geometry, `applyAction`, immutable state/events, score inputs. Без DOM, RAF, wall clock, сети и RNG. |
| Сессия (`src/session/*`, будущая) | session controller | Загрузка уровня, ready/playing/resolving/paused/result, input gate, action dispatch, active-time clock, reset/dispose. Единственное место, которое вызывает simulator. |
| Поле (`src/render/*`, PixiJS 8) | board view | 2D scene graph, псевдо‑2.5D слои/спрайты, отображение state/events и координат; не принимает игровые решения. |
| DOM-интерфейс (Preact 11.x) | UI | HUD, выбор магнита, pause/help/result/challenge. Получает snapshot/callbacks от session; не копирует правила. |
| Runtime/lifecycle (`src/main.js`) | app runtime | Единственный владелец RAF/visibility/resize/pause/reset/dispose. Pixi ticker не запускается отдельно; render/update вызываются этим runtime. |
| Платформа/аналитика (будущие adapters) | adapter | Опциональные deep link/share/ads/events. Ошибка adapter не изменяет симуляцию и не блокирует локальную игру. |

Поток: пользовательский input → session валидирует phase → чистый `applyAction` → новое state и упорядоченные events → session фиксирует результат → Preact получает HUD snapshot, PixiJS отображает snapshot/events. Layout mapping преобразует pointer в координату/action-кандидат и не реализует правила. Ни view, ни adapter не вызывают симулятор повторно.

## Lifecycle и время

- Сохраняются pause/reset/hidden/focus/dispose и dev-only диагностика существующего runtime во время миграции renderer.
- Один app-owned RAF вызывает fixed-step session update и render; никакого второго loop. Симуляция хода синхронна и детерминирована; эффекты могут анимироваться по fixed update с alpha для render.
- Pause/hidden останавливают active-time, ввод и игровое обновление, но не меняют уже рассчитанный state. Возврат сбрасывает накопитель elapsed согласно существующему loop contract.
- Reset/dispose принадлежат runtime/session. У каждого listener, RAF, Pixi renderer, GraphicsContext/Texture и Preact root один владелец и явный cleanup. Reset не должен дублировать владельцев или накапливать ресурсы.

## Текущее состояние и целевой renderer

- Runtime использует PixiJS 8.22.0 и Preact 11.0.0; GDD target — PixiJS pseudo‑2.5D, без миграции на Three.js.
- [PixiJS 8 docs](https://pixijs.com/8.x/guides), `knowledge/pixijs-practices.md` и `design/PIXI_RENDERING.md` — точки сверки API и практик. DPR, filters, texture sizes и визуальную детализацию выбирать замерами на целевом устройстве.

## Устройства, проверка и бюджеты

- Предлагаемая baseline-платформа: Android 13+, Chrome stable на реальном Pixel 6a (6 GB RAM), portrait, touch; desktop Chromium — разработка/регрессии, а не замена телефона. Это целевой сценарий для будущей проверки, не подтверждение доступности устройства.
- В текущем проекте физический телефон не указан и не проверен. Перед TASK-0011 подтвердить фактическое устройство; если Pixel 6a недоступен, зафиксировать точную модель/OS/browser, не приписывая ему измерения другого устройства.
- Профиль до фактического замера: portrait 60 Hz target, p95 frame <16.7 ms, action-to-first-feedback 150–300 ms по GDD, отсутствие ухудшения после 20 reset/replay. Это целевые бюджеты и план измерения, не результаты.
- Замер: тот же prototype level, те же 20 действий и прогрев; Chrome Performance/remote debugging, 60 секунд повторов, отдельно p95 frame, simulator CPU, render CPU, cold load transfer, heap до/после 20 повторов. Записать browser/OS/device, build, throttle (выключен), и сценарий. Не называть CPU render GPU time.
- Проверки: unit для geometry/validation/simulator deterministic replay; build для интеграции; браузерный сценарий desktop и mobile viewport для UI; ручной touch/play feel и физическое устройство для tactile/performance критериев. Emulation не закрывает физический телефон.

## Сериализация и диагностика

- Версионированные LevelDefinition, GameState, events и RunResult определены в `RULES.md`. Challenge key включает puzzleId + seed + contentVersion + rulesVersion + mode.
- Dev snapshots содержат краткий state/turn/phase и не включают renderer instances, личные данные, seed-derived secrets или сетевые tokens. Продакшен не публикует dev hooks.
- UI читает state; платформенные adapters не являются источником истины для игрового результата. Replay можно сверить локально, но anti-cheat требует отдельной серверной/platform trust модели.
