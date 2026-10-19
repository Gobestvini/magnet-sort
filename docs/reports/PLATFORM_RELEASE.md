# Platform transfer and Telegram release

2026-10-19. Source reference: sibling White Tower platform-builds ADR,
Telegram adapter/publication review, resource-cache worker, portal packaging
and Telegram setup tools. Official Telegram API docs rechecked on this date.

Transferred and adapted: explicit web/embed/Telegram build profiles, common
startup owner, per-target graph isolation, ready-after-reveal, stable viewport
and union safe areas, OR-composed activity/user pause, cleanup, bounded bridge
failure, final-byte resource manifest, scope-specific asset cache with checksum
repair, runtime license notices, reproducible embed ZIP, strict combined staging,
and game bot menu setup with username verification/read-back/redacted errors.
No White Tower services, bot credentials or saves were copied.

Browser review found landscape content overflowing the Telegram safe frame;
target-specific compact layout now keeps board/HUD/controls/tutorial inside it.
The existing non-Telegram layout is unchanged. Current v4 still has no durable
campaign saves, native packages, payments, cloud identity or portal-specific SDK.

Local checks on an isolated checkout excluding unrelated board/glow changes:

- 214/214 unit tests and production build; final full check logged separately.
- Explicit web/embed/Telegram builds and actual Rollup adapter isolation.
- Production web and Telegram mock-bridge seeded victory (7 moves), next/retry,
  stars, selection and pause on desktop/mobile viewport.
- SDK-free iframe launch and pause/resume; ordinary-browser Telegram launch gate.
- Ready once, safe geometry, activity pause, preservation of user pause,
  active web worker → Telegram, resource-only cache, corrupted-asset repair/reload.
- Loading: 6 viewports through 2560px, staged resource decode, visible minimum,
  reduced motion, five dependency failures and Retry.
- Tutorial: 5 viewports, endpoints, selection/resize/scroll, pointer cancel,
  pause, reduced motion and touch drop. Pages seeded smoke also passed.

Logs/screenshots are in the isolated checkout's ignored logs/artifacts. An early
loader run overlapped an unfinished build and failed; rerunning after all output
was written passed. Do not start artifact checks before their build completes.
The first full receipt was invalidated by a CSS edit during verification;
the final full command must run after code edits stop.

Publication results are verified separately after committing. HTTPS targets:
https://play.plusvibegames.com/magnet-sort/ and its `telegram/` subdirectory;
GitHub Pages publishes the same combined tree and retains the embed ZIP.

Remaining external prerequisite: owner confirmed no game bot exists yet.
[BotFather setup](../platforms/telegram.md) includes exact URL and suggested
name/username. No live t.me link, actual Telegram-client launch or physical-phone
acceptance is claimed by the automated bridge tests.
