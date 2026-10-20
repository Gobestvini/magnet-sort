# Magnet Sort — Telegram avatar

2026-10-20. Installed on **@MagnetSortPuzzleBot** through the owner's authorized
Telegram Web session, using BotFather `/setuserpic` → exact bot username → photo
upload. BotFather confirmed **Success! Profile photo updated.** The new image was
then visually checked in the bot's header and profile. No credentials were used
or saved for this operation.

## Files and provenance

- `avatar-source.png`: original built-in ImageGen output, 1254×1254, RGB, opaque.
- `avatar-1024.jpg`: the uploaded 1024×1024 export, JPEG quality 94, 4:4:4 chroma.
  Only size/encoding changed; no creative pixel edits were made after generation.
- `preview.html`: circular CSS previews at 256/128/64 and chat rows at
  32/40/48/64 CSS px. Run through HTTP; not part of the game's runtime assets.
- Local, ignored evidence: `artifacts/bot-avatar/circle-preview.jpg` and
  `artifacts/bot-avatar/telegram-profile.png`. The Telegram proof is cropped to
  the bot's profile and excludes the owner's unrelated chats.

Reference roles: `public/art/mockup/magnet-blue.png` establishes the magnet
silhouette, enamel, bevel and ivory tips; the existing
`artifacts/bot-setup/telegram-web-play.png` establishes the game palette and
materials. The second is only a game screenshot, not a new composition target.
The source file came from the built-in image_gen tool, not the CLI/API fallback.

## Final prompt

Create a polished square 1024x1024 Telegram bot avatar for the casual puzzle game Magnet Sort. Use the supplied images only as style/material/color references, not as a scene to reproduce. Reference 1 is the game's glossy blue horseshoe magnet: preserve that recognizable thick rounded U silhouette, white ivory metal tips and bright candy-blue enamel with sculpted bevels. Reference 2 is the game screen: use its saturated royal-blue/violet palette and glossy friendly pseudo-3D art direction. Compose ONE oversized blue horseshoe magnet, opening upward, subtle 3/4 tilt, taking about 72 percent of the square, perfectly readable as a tiny icon. Two or three chunky small coral and violet hexagonal game pieces float inside its opening, visibly attracted to the tips; these are secondary accents, not stacks or a board. Deep rich violet-to-electric-blue background with a very subtle broad hexagonal hint, strong separation from the blue magnet, warm soft rim light and a soft dimensional contact shadow. Keep the entire magnet and tips comfortably within a central circular safe area, no important content in corners. Premium cheerful mobile puzzle icon, clean silhouette, glossy rounded surfaces, deliberate simple composition. Full-bleed opaque square image, no outer white frame, NO TEXT, NO LETTERS, NO NUMBERS, no UI controls, no phones, no extra magnets, no particles or busy scenery. Deliver a single final avatar, not a mockup or comparison sheet.

## Verification and limits

Visual browser QA: the full U and ivory tips remain inside the circular crop;
the magnet is recognizable in 32/40/48/64px chat rows. Telegram Web profile and
header show the generated artwork after upload. This checks actual installation,
not just the local mockup. Native Telegram Desktop and physical-phone display
were not independently tested. Runtime game artwork and logic were not changed.
