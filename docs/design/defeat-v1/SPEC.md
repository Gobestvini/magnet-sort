# Defeat screen layers

Built-in image_gen, 2026-10-12. Reference mockup `reference.png` is a target only. Separate generated decorative PNG layers: `illustration-source.png` and `panel-source.png`; runtime reduced to `public/art/mockup/defeat-illustration.png` (512×342) and `defeat-panel.png` (420×560). RGBA, transparent outer corners. Actual text/stats/retry button remain Preact DOM. Victory assets/markup are retained. Modal waits for terminal=lost and end of resolution, no stars or confetti on loss.

## Prompts

### Mockup

ui-mockup for Magnet Sort mobile casual puzzle, portrait composition 390x844 ratio. Match referenced current game screenshot style: rich cobalt/violet embossed hex background, cream beveled hex tiles, colorful layered chip stacks, glossy purple horseshoe magnets and cream UI panels with gold trim. Show a full occupied board dimmed behind a centered cream rounded card with warm gold bevel. New DEFEAT screen: heading exact 'BOARD FULL', subheading 'No empty tiles left'. A large glossy violet horseshoe magnet reclining on its side beside three small colorful hex chips, subdued gentle mood, readable rounded cream card. Below illustration two live-style stat blocks '12'/'MOVES' and '18 / 50'/'COLLECTED'. One wide purple gradient pill button at bottom 'Try again'. No stars, no confetti, no victory celebration, no second action or paid continue. Keep card compact and tasteful, match existing UI, make retry inviting. Polished production-quality target mockup only; this image will be split into separate decorative artwork and live DOM text/stats/buttons.

### Illustration

Production transparent PNG game decorative illustration, match supplied defeat UI mockup style and its central illustration only. One glossy violet-purple horseshoe magnet reclining on its side on an invisible ground, facing viewer in gentle pseudo-3D isometric perspective, polished violet bevel and ivory metal ends. Beside its ends, three small hex chips: cyan blue, warm coral red and golden yellow, each 2-3 thin layers, pleasant chunky bevels. Exactly this small arrangement as a single standalone decorative illustration for BOARD FULL result card. No text, no digits, no UI, no card panel, no buttons, no stars, no confetti, no victory effects. True transparent background with small soft contact shadows only under objects. Wide 3:2 arrangement centered, tight useful bounding box, matching playful glossy casual mobile game rendering, no sadness face or characters.

### Panel

One standalone production UI panel asset for a casual puzzle defeat modal, transparent background. Tall rounded rectangle cream ivory card, warm pale buttery gold raised beveled border, fine white inner edge, gentle subtle warm ivory vertical gradient with a hint of peach near bottom. Match supplied Magnet Sort defeat mockup card. Perfectly clean EMPTY interior, no heading, no text, no stars, no magnet, no illustrations, no buttons, no inset stat boxes, no divisions. Portrait 3:4 proportions, subtly rounded 8% corner radius, symmetric even border, crisp continuous contour. Small soft contact shadow outside perimeter, true transparent alpha everywhere outside. A usable layer behind live DOM text and other assets.
