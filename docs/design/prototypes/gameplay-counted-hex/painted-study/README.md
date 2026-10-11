# Regenerated satin chip study — 2026-10-11

[Figma v5](https://www.figma.com/design/Nntj95XfGJSGVy0FwadZMN?node-id=12-6): `Gameplay v5 — regenerated satin chips`, x2200/y−836. Previous frames retained. Each of the 18 units is a separate PNG layer, not a painted whole-stack image. Numbers are native text.

Generated with the built-in imagegen tool: violet source `exec-fb2dbc2c-aec4-41d8-a368-958bce2c1798`, blue `exec-07876215-980a-4ec4-b738-32891b429cff`, coral `exec-ec3ae7b5-26c5-4d54-9a6f-5a94642b0e0b`. Full-screen edits were rejected because the generator drew fewer physical layers than the requested six.

The retained PNGs have rounded edges, a thin painted sidewall, soft upper-left satin light, and violet/blue/coral variants. Only transparent padding and disconnected alpha specks were trimmed; colors were not synthesized or recolored in code.

Primary prompt:

> One isolated game asset on genuine transparent background: a SINGLE solid violet hexagonal wafer for premium mobile casual sorting puzzle. No stack. Hex point up and down, identical straight sides, softly rounded corners. Near top-down orthographic view with subtle front side visible, full top face, no perspective converging sides. Very thin physical body: visible purple sidewall only about 2% of overall width, wafer rather than thick token. Rich medium purple satin plastic, gentle soft upper-left broad reflection, darker purple front sidewall, micro bevel, calm polished handmade 3D casual-game rendering, subtle bright lavender highlight only at upper-left edge. No thick white outline, no neon, no strong specular white glare, no metallic finish, no text, no number, no icon, no hole, no cast shadow outside silhouette, no surrounding cell. Centered large with ample transparent padding. Must appear tactile and appealing, NOT a flat SVG polygon. Top and bottom points precise, point-up footprint width to top-face height ratio approx 1.03.

Color edit prompt (blue/coral):

> Precise game sprite recolor. Change ONLY the purple color of this SINGLE thin hexagonal wafer to saturated cyan-blue with deeper blue sidewall / warm coral-red with deeper coral sidewall. Preserve EXACT silhouette, dimensions, point-up orientation, camera projection, soft broad upper-left satin reflection, tiny rounded bevel, extremely thin body, transparent background, no cast shadow. No text or symbols. Keep brightness and material consistent, no additional glare, no enlarged bevel, no extra objects.

Rebuild: `node tools/build-gameplay-counted-hex.mjs`, `python tools/prepare-painted-chip-study.py` (Pillow/NumPy), `node tools/build-painted-chip-study.mjs`. Open `/docs/design/prototypes/gameplay-counted-hex/painted-study/index.html` on Vite. SVG/HTML assemblies are generated and ignored because they duplicate embedded PNGs.

Layout uses existing 19-cell board and original UI. Chip width uses radius .68; image anchor .485. Painted pitch .11 world units differs from volumetric v4 (.066) because PNG contains its own camera-facing wall. This is a static art study, not the new motion implementation. Main screen: 6 violet, 6 blue, 3 violet + 3 coral; stress screen: 20 separate images. All quantities come from existing fixture lists. Small-screen layer readability remains limited for 20; badge remains useful. Raster front walls are unsuitable as universal rotated 3D bodies without texture/mesh adaptation.

Viewed full composition and 20 stack through in-app browser, then inspected Figma. Soft material is better integrated with cream cells/magnets than flat v4 caps; there is still a dense stack silhouette at 20. Screenshot proof: `figma-proof.png`. Production game and animated preview unchanged; TASK-0025 stays review pending visual acceptance.
