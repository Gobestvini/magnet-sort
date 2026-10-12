# MOVES reward preview

Built-in image_gen, 2026-10-12. Source `source.png` (transparent RGBA), reference `public/art/mockup/victory-star-v2.png`. Runtime `public/art/mockup/moves-star.png`, 128×128, proportionally reduced for 20–30 CSS px. Dim state uses the same silhouette with CSS grayscale/brightness/opacity. Live label: Potential stars: N of 3. Shared potentialStars helper also supplies earnedStars when won; live/lost awards remain zero.

Уточнение пользователя: не двигать логотип/HUD/остальные элементы ради звёзд; использовать уже свободное место над MOVES. Компактная дуга: звёзды расположены тесно, средняя на 2px выше боковых. Ряд абсолютный, не добавляет высоты HUD и не меняет исходную высоту MOVES/цели.

## Prompt

Production game UI asset, one isolated compact five-point golden reward star on a genuinely transparent background. Match the supplied reference's playful glossy gold yellow 3D bevel, warm orange edge, smooth chunky rounded corners, subtle upper-left highlight. Straight upright star, centered, tight useful silhouette with small transparent padding. Designed to remain readable at 24 CSS pixels above a cream MOVES counter in a purple-blue mobile casual game. Single star only, no text, no digits, no framing, no platform, no particles, no large outer glow, no cast shadow beyond silhouette, no rectangular background. High polish.
