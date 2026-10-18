# ImageGen: варианты магнитов C и исходные экраны

2026-10-18. Использован встроенный image_gen, без CLI/API-ключа. Три отдельных генерации экранов и две отдельные генерации прозрачных sprites; затем точечная очистка альфа-силуэта встроенным image_gen. Пользователь выбрал C — мини-карта радиуса.

## Общий промпт экранов

Use case: ui-mockup. Create ONE complete polished portrait mobile game screen, 1024x1536. The attached screenshot is a reference for this existing Magnet Sort game, not an image to reproduce pixel-for-pixel. Retain recognizable glossy casual pseudo-3D hexagonal tiles and stacked wafers, purple/blue hex embossed background, Magnet Sort logo, cream HUD showing LEVEL 1, COLLECTED 0 / 50 and MOVES 0, 5x5 staggered hex board and bottom cream tray with three large magnets. Remove tutorial arrow and tutorial instruction card; use their space for a calm compact legend if needed. Main design task: redesign the magnets and their range communication. All three tray magnets should be clearly beautiful tactile premium toy-like glossy 3D objects; show radius one and radius two types together, same color may have either type. Existing small white SVG pill with concentric circular rings and a number is REJECTED, DO NOT use it. Range must be clear at a glance with a design integrated into the magnet housing or its tile base, never a tiny round radar badge. Include two matching source stacks with soft translucent colored light emerging over the WHOLE hexagonal tile footprint, surrounding the stack, visible behind AND as a soft front skirt; preserve readable chip count. No floating particles, no sparkles, no fireworks. Keep scene clean and compatible with existing game palette and perspective. No phone frame, no watermarks.

Reference: source-screen.png (снимок самой игры; не внешний арт). Полные экранные варианты — самостоятельные дизайн-предложения, не запись фактической игровой модели. Цветные зоны в них не используются как источник логики preview.

## Добавка A

Direction A — HEX PEDestals: preserve the friendly U-shaped horseshoe magnet, mount it on an elegant small hexagonal pedestal matching the cream tiles. One-range pedestal has ONE bold concentric HEX contour inset around its perimeter, two-range has TWO clearly spaced HEX contours. Clearly emboss a large numeral 1 or 2 on the front wall of each pedestal as part of the actual 3D object, not a separate badge. Tray: violet type1, blue type2, coral type1. Subtle colored enamel, chrome poles, warm cream pedestal, confident readable design. Small footer label: A — HEX BASE.

## Добавка B

Direction B — POWER BANDS: create charming chunky U magnets with rubberized glossy colored shells and silver poles, as premium casual game powerups. Integrate ONE broad luminous ivory chevron stripe across the outer curved shell for radius1, TWO parallel luminous ivory chevron stripes for radius2. Emboss large numerals 1 and 2 directly on the bottom curved body with bevel, no separate plaques or circles. Distinguish the body silhouette slightly: compact single-band magnet and broader double-band magnet. Tray violet1, blue2, coral2. Small footer label: B — POWER BANDS.

## Добавка C — выбран

Direction C — MINI HEX MAP: use gorgeous glossy familiar U magnets. Beside the lower right of EACH magnet, integrated in its cream tray card, show a tiny but bold hexagonal footprint diagram: a central filled hex plus a complete first hex ring for radius1, central hex plus TWO complete hex rings for radius2. The diagrams are tactile raised mini hex tile clusters, cream/colored tinted to match magnet, far larger and more readable than old white pill. No circular radar symbols, no number pills. Put 1 RING and 2 RINGS as clean short labels below card illustrations. Tray violet1, blue2, coral1. Small footer label: C — HEX MAP.

## Перенос

Из выбранного C подготовлены public/art/range-map-1.png и range-map-2.png: полные кластеры7/19, RGBA, оригинальный авторский арт проекта. Подписи остаются DOM-текстом. Hue rotation подкрашивает нейтральные голубые tiles в семь цветов магнитов. Промпты sprites сохранены в ASSET_PROMPTS.json. Сгенерированные экраны сохранены без редактирования, варианты A/B не применяются в runtime.
