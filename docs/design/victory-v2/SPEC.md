# Victory v2 — 2026-10-12

Generated visual reference: reference.png; blank RGBA panel: panel.png; generated five-point RGBA star: star.png. All output generated with built-in imagegen; original assets retained. See manifest.json. The reference's illustrative numbers/gameplay are not a recorded victory.

Composition: dark purple viewport overlay rgba(25,5,86,.65), gameplay below inert; cream panel with violet beveled rim above. Panel max width 390 CSS px, 32 px horizontal and 40 px vertical padding; 20 px content gaps. Panel scales to available width and permits scroll for small heights. Landscape <=550 px high uses 22 px vertical padding and 9 px gaps.

HTML heading LEVEL COMPLETE!, three slots for stars, actual earned stars bright and remaining muted, moves and collected/goal in two cream stat tiles. Primary Next level (Play from start at level 12), secondary Play again. No baked text/counts/CTA in production bitmap. Central star slightly raised; panels/buttons follow existing cream and green material system. Layer order: background → board → scrim → panel/DOM → bounded decorative particles without covering controls.

Preview supports 1/2/3 stars, final level and long illustrative numbers. Runtime uses real state only, with result after final collection arrival and deactivation; preserved modal focus trap and reduced-motion entry. No additional approval gate.

Background v2: generated with original background.png as reference; mask derives from dark groove residual in the final bitmap, not a separate grid. Both center/cover; original 11-second sweep unchanged. Prompt records: tools/prepare-followup-art.cjs and docs/reports/FOLLOWUP_IMPLEMENTATION.md.
