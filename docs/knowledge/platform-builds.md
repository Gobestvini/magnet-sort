# Platform artifact integrity

2026-10-19, adapted from White Tower and rechecked in Magnet Sort.

Problem: one generic build cannot demonstrate SDK isolation or safely retain a
Telegram subdirectory during web publication. A source SHA label can also hide
uncommitted files; relative-base output hashes can be wrong before Vite's final
rewriting.

Method: one common runtime/bootstrap with separate adapter entries; validate
actual Rollup modules. Hash final asset bytes in writeBundle. Stage web plus
Telegram only after checking game/target/base/revision, file allowlist and every
resource hash; emit runtime licenses. Package embed with stable ordering and
timestamps. Build from an isolated committed checkout and check artifacts only
after its build finishes. Publish one combined tree, retain old hashed files for
both targets, verify HTTPS metadata and browser behavior after deployment.

Evidence: platform unit tests exercise wrong target, hidden file, corruption,
mixed revisions, stale staging and ZIP repeatability/reader. Production browser
checks exercise real worker scope, corrupted cache repair, web→Telegram,
mock-bridge pause/ready/geometry and iframe. See
[report](../reports/PLATFORM_RELEASE.md) and [commands](../platforms/README.md).

Bot setup follow-up, 2026-10-19: owner-created @MagnetSortPuzzleBot now has a
read-back-verified Play menu and BotFather Main Mini App. getMe flag and profile
OPEN APP independently confirmed the latter; a real authorized Telegram Web
launch, one move and pause/resume passed. A successful setChatMenuButton response
initially preceded the expected getChatMenuButton result; later read-back
matched. Query, JSON-body and form transports were tried, so no single transport
is claimed as the cause or fix. Verify eventual state rather than assuming that
an acknowledged write is already visible. Token remained ephemeral and absent
from files. See the project report for evidence and device limits.

Limits: cache/SDK mocks and actual Telegram Web are different browser evidence;
neither is a physical device or portal approval. Source identity requires a
clean build. Resource caching does not provide offline HTML/game launch.
