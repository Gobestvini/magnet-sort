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

Limits: cache/SDK mocks are browser evidence, not a physical device or portal
approval. Source identity requires a clean build. Resource caching does not
provide offline HTML/game launch. BotFather creation remains external.
