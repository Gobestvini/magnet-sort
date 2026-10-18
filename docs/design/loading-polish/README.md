# Loading contrast and progress bar — 2026-10-18

Owner correction: make the studio caption light on the dark background and fix
the bar's edge artifacts / stretched appearance on wide screens.

`studio-light-source.png`: built-in imagegen edit of `public/art/loading/studio.webp`
from the previous commit. Output `exec-e4afa958-d805-4139-a159-74e9e9e01144.png`.
Transparent alpha preserved; runtime is encoded to width480 with sharp 0.35.5,
WebP quality90, alphaQuality100, effort6. Prompt:

> Use case: precise-object-edit. Edit the supplied transparent Plus Vibe studio logo for a game loading screen. Change ONLY the small top caption 'a game by' from dark navy to bright warm ivory-white (#fff9ed), with a subtle narrow navy edge/shadow so it stays crisp on a dark blue-purple game background. Keep the exact text 'a game by', same font, weight, size, location and baseline. Preserve the large '+vibe' logo, yellow plus, orange dot, white 3D letters, navy outlines, shadows, composition, proportions and all other details exactly. No redesign, no additional objects, no new text, no translation. Preserve a genuinely transparent background and the same overall wide image framing, with minimal existing transparent padding. Output a clean production-ready transparent PNG.

The old track and fill were full raster capsules with mismatched aspect ratios,
each with a border. Stretching and clipping them produced doubled/warped edges.
They are removed from the startup/preload allowlist. The bar uses the existing
game's CSS surface colors: cream/gold frame, dark trough and purple gradient.
It stays 30px tall and at most 360px wide; a rounded inner window contains the
fill at every fraction, including a fully empty and fully completed bar.

Browser verification: 360×800, 390×844, 844×390, 1440×900, 1920×1080,
2560×1080; snapshots at 0/8/50/100%, plus reduced motion and loading/Retry.
Evidence lives under ignored `artifacts/loading-browser/`; no physical phone claim.
