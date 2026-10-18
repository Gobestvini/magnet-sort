# Clean tutorial glove — 2026-10-18

The old 180×180 cutout had purple fragments around its fingertip and thumb.
Replaced on the owner's request using built-in `imagegen` (precise-object-edit),
with the old `public/art/mockup/tutorial-hand.png` as pose/style reference.
Generated file: `exec-217bf6cd-8c06-4d9d-867f-90d015df9a45.png`.
`source.png` preserves the 1254×1254 RGBA output. Runtime PNG is resized to
256×256 with sharp 0.35.5 Lanczos3, preserving alpha, and displayed at 64px.
Production uses the existing WebP quality85/alphaQuality100 asset pipeline.
No code-generated substitute or manual recoloring was used.

Final prompt:

> Use case: precise-object-edit. Asset type: single transparent PNG tutorial hand cursor for a polished casual mobile puzzle game. Input image 1 is the edit target and pose/style reference. Redraw this damaged small icon cleanly at high resolution, square 1024x1024 canvas. One friendly rounded white cartoon glove, index finger extended diagonally toward the upper left, thumb and other fingers naturally folded, wrist/cuff toward the lower right. Preserve the overall silhouette, diagonal pose, clean soft 3D game-render style, white highlights and subtle lavender shading. The current purple doubled edges, rings, stray fragments and jagged cutout artifacts around the fingertip and thumb are defects: remove them entirely. A clean continuous glove silhouette with no detached pixels, no duplicated contour, no colored halo, no tap rings, no glow, no motion lines. Simple legible smooth shapes that remain crisp when displayed at 64 pixels. Entire hand including cuff visible, roughly centered with small transparent margin; fingertip touch hotspot approximately at 15% of width and 15% of height. Actual transparent background and antialiased alpha edges; no checkerboard drawn into the image, no background, no contact shadow outside the hand, no text or watermark.

Alpha QA: runtime PNG has a single connected region at alpha≥32 (29234 pixels),
with no separate opaque fragments at that threshold. Inspected at 64/128px on
the dark purple game background. This threshold does not prove the absence of
very faint edge pixels; the final decision also requires the in-game preview.

Verified: `pnpm check:full` (206 tests and production build), then
`tutorial-browser-check.cjs` on that build at 320/390/844/1280/1920px.
Inspected the actual hand over the magnet during travel and on the board;
the white glove remains legible on the purple background without the old
purple fragments. Final runtime WebP is 10516 bytes. Browser emulation only.
