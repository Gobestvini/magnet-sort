# Gameplay: counted hex artwork

2026-10-11. TASK-0025, отдельный дизайн и motion-preview; production entry и правила не изменены.

## Результат

- [Рабочий экран Figma, 941 × 1672](https://www.figma.com/design/Nntj95XfGJSGVy0FwadZMN?node-id=11-165): `02 Gameplay — counted thin hexes` → `Gameplay v4 — thin chips inside borders`.
- [Экспорт Figma](prototypes/gameplay-counted-hex/figma-gameplay.png).
- Preview: `/docs/design/prototypes/gameplay-counted-hex/index.html` на Vite dev server.
- [Запись цепочки](prototypes/gameplay-counted-hex/chain-motion.webm).

После просмотра v2 пользователь попросил повторить оформление исходного концепта. Поэтому ориентация изменена на **point-up**, расположение клеток — 3–4–5–4–3. Это прямое уточнение пользователя к первоначальной авторской рекомендации flat-top. Предыдущий векторный вариант сохранён слева, промежуточная текстурная сборка — справа. Исходные 12 экранов на отдельной странице сохранены.

## Ассеты и компоненты

`prototypes/gameplay-counted-hex/assets/` содержит отдельные alpha PNG: кремовую клетку, violet/blue/coral фишки, вырезанный blocker, 24 исходных semantic UI-crop и подложку. Клетка и три фишки подготовлены built-in imagegen по `mockups/2026-10-10-gameplay-counted-hex/03-playing-concept-v1.png`; оригиналы генераций сохранены с суффиксом `-generated`. Blue/coral получены редактированием violet с запросом сохранить форму. Обрезка и удаление изолированных alpha-точек воспроизводятся `tools/prepare-counted-hex-assets.py` (Pillow + NumPy). Blocker вырезан из исходного casual mockup, без перерисовки X.

В Figma каждая клетка — отдельный image layer, каждый unit — отдельная группа редактируемых vector facets внутри `Stack-rNcN`, счётчики — native Nunito Black 48 px с белой заливкой и тёмной обводкой 3 px. Masters предыдущего v3 сохранены в его фрейме слева. В v4 units — именованные группы, счётчики — native text; полной библиотеки вариантов с переменными пока нет. HUD, логотип и магниты сохранены отдельными растровыми слоями, а не цельным скриншотом.

UI-crops сохраняют исходную нарисованную типографику. Они привязаны к этому размеру композиции; nine-slice для произвольных новых текстов/размеров из них не заявляется.

## Геометрия и данные

`geometry.js` задаёт odd-r lattice: `x = √3 × (col + rowParity/2 − 3.5)`, `z = 1.5 × (row − 3)`. Контур начинается с угла π/6. IDs/соседство модели сохраняются. Камера orthographic, x ±4.5, y ±(4.5 × 720/881), position (0,11,7), lookAt (0,.2,0). Поле в макете: x30/y400/w881/h720.

Радиус клетки .995, внутреннего углубления примерно .78, фишки .68; фактическая толщина и шаг .066 world units, пол .12. Центр углубления измерен по исходному PNG: y234/512, а не центр внешней боковины. Консервативный внутренний контур (235,53), (420,155), (420,310), (235,415), (50,310), (50,155) в изображении 471×512 используется в тесте посадки. Верх одиночной фишки проходит внутри него; footprint стопки такой же. Поднятые верхние слои могут проецироваться выше бортика, как у физической стопки.

После замечания о толщине и свете painted chip planes заменены настоящими thin bodies. `chip.js` задаёт общие вершины, фаску .008 и тёмный нижний шов .014, одинаковые спокойные цвета граней для SVG/Figma и Three.js (vertex colors, без белого запечённого блика). Клетки сохраняют рисованный PNG. `assets/chip-{violet,blue,coral}-thin.svg` — отдельные векторные ассеты; старые chip PNG сохранены как отклонённые варианты и больше не рендерятся. На 320px шаг составляет больше 1 CSS px; это технический минимум, а не обещание комфортного ручного подсчёта 20 тонких слоёв. Цифра остаётся основным способом чтения большого количества.

`units` упорядочены снизу вверх; цифра — длина непрерывной группы сверху. Главный fixture содержит violet6, blue6, violet3+coral3: всего 18 units, цифры 6/6/3. Источник уменьшается при взлёте, приёмник растёт при посадке. Flying/clearing не входят в resting. Все ходы получены через существующие `applyMagnet` и `makeTransferTimeline`.

Normal: initial .16 s, flight .19 s, stagger .055 s, clear .22 s; arc .7 world units, smoothstep, flip 2π, settle .018 на .09 s. Reduced: initial .06 s, flight .09 s, stagger .045 s, clear .08 s, без дуги/flip/settle. Цепочка: 4 ID, 8 соседних hop events. Один ID не совершает два перелёта одновременно.

## Воспроизведение

1. `pnpm dev --port 5174`, открыть указанный preview path.
2. `node --test tests/gameplay-counted-hex.test.js`.
3. `node tools/gameplay-counted-hex-check.cjs` (при другом порте задать `GAME_BASE_URL`).
4. `node tools/build-gameplay-counted-hex.mjs` создаёт SVG в artifacts из сохранённых отдельных ассетов. Исходный `artifacts/figma-exact/manifest.json` используется при наличии; иначе достаточно tracked `ui-layers.json`.

Сценарии: основной экран, 1, mixed, chain, clear6, tall20, twelve12; normal/reduced, Play/Pause, Replay, scrub в обе стороны. Один RAF; hidden вызывает pause; dispose снимает listeners и освобождает shared textures/materials/geometries.

## Граница соответствия

Материалы и раскладка значительно приближены к исходному концепту, но **пиксельное совпадение не подтверждено**: новые PNG повторяют стиль, а не исходные пиксели каждой нарисованной клетки; фаски/тени отличаются. Высоты согласованы с реальными списками вместо ошибочного числа слоёв в генерации. Проверка чисел/ID не считается проверкой художественной идентичности. TASK-0025 оставлена в review, а не done; production миграция в её область не входит.
