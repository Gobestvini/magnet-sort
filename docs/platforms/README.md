# Platform builds — Magnet Sort

2026-10-19. Adapted from White Tower's platform-builds ADR, Telegram adapter,
resource worker and portal release tools. One Three.js/Preact game graph serves
every target. White Tower content, saves, account services and credentials were
not copied.

| Command | Output | Purpose |
| --- | --- | --- |
| `pnpm build` | `dist/` | Default web build; clears explicit outputs |
| `pnpm build:web` | `dist/web/` | Browser |
| `pnpm build:embed` | `dist/embed/` | Relative HTML5 / iframe |
| `pnpm build:telegram` | `dist/telegram/` | Telegram Mini App |
| `pnpm build:platforms` | All three | Each clears only its own directory |
| `pnpm package:embed [NEW_DIRECTORY]` | `artifacts/magnet-sort-embed/` | Reproducible ZIP + file/hash manifest |

Explicit commands accept `--base PATH`; publication uses `./`. Unknown targets
fail. Rollup's actual module graph must contain exactly the selected adapter.
Only Telegram requests its official async SDK. The common bootstrap owns
init, first playable reveal, ready and disposal. User/platform pause combine OR.

Every build includes source revision/target/base in `build-info.json`, adapter
graph in `platform-modules.json`, full Three.js/Preact/Nunito runtime licenses in
`third-party-notices.html`, and SHA-256/size of final written asset bytes in
`resource-cache.json`. PixiJS remains legacy and does not ship in the active graph;
Vite/sharp/fflate are build tools. Artwork provenance stays in existing art docs.

The common loader installs an optional scope-specific `resource-sw.js` after
reveal. It warms two requests at a time, serves only listed hashed assets,
checks cached bytes, repairs corruption and retains two previous resource caches.
It never serves HTML navigation, SDK, API or another game's files. Storage/worker
denial leaves ordinary HTTP loading. This is resource caching, not full offline
play or PWA installation.

ZIP paths are sorted and timestamps fixed, with index.html at the root. Outputs
are immutable. Packaging/staging rejects unexpected files, hidden credentials,
symlinks, wrong profiles, mixed revisions and modified asset bytes. Build releases
from a clean committed checkout; a SHA label alone cannot verify a dirty build.
Portal SDKs, cloud saves, ads, moderation and uploads remain separate integrations.
No native Android/iOS package is claimed.

Combined publication stages web at root plus `telegram/`. Pages publishes one
tree and retains the embed ZIP as an Actions artifact. VPS uses the same tree,
atomic current switch and retained hashed assets for both directories.
See [deployment](../../deploy/README.md), [Telegram setup](telegram.md).

Checks: `pnpm check:full`, explicit builds, `pnpm test:platforms`, plus existing
loading/Pages/tutorial tools. `PUBLICATION_ROOT` selects the artifact root;
`PLATFORM_BASE_URL` selects deployed HTTPS; `PUBLICATION_LAYOUT=combined` selects
web at that root. Mock bridge / viewport checks are not native Telegram or phone
acceptance. The active v4 game has no durable campaign saves.
