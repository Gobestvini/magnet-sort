# Magnet Sort leaderboard service

Implementation contract: `docs/design/LEADERBOARDS_SERVER.md` from the repository root. The service uses the existing MagnetSortPuzzleBot public ID **8820798959**, Telegram's production Ed25519 key, and no bot token. It does not send messages, change Telegram bot settings, or access another game's database.

## Runtime and isolated dependency package

Production runtime is the pinned Node24.22.1 ARM64 Docker image in `server/Dockerfile`; this package pins better-sqlite3 13.0.3 (SQLite3.53.4). The root frontend package never imports this dependency. From the repository root:

```powershell
npm --prefix server ci
npm --prefix server test
```

The same tests must pass in the actual ARM image, not just on Windows. The suite uses local generated Ed25519 keys through in-process constructors; production main has no test-key environment switch. Startup creates/migrates the own database, starts two replay workers, checks the frozen daily manifest and all30 real winning witnesses before readiness.

The pure model import graph is rooted at `src/prototype/model-v4.js`, `levels-v4.js`, `daily-catalog-v1.js` and `daily-rules.js`. The image also requires `tools/fixtures/daily-v4-witnesses.json`. No DOM/session/storage owner or browser assets are used by the server. Shared-rule changes require new content/profile versions and matching witnesses before release.

## Starting and schema

Set explicit `MAGNET_SORT_BOT_ID=8820798959`, `LEADERBOARDS_DB` to the own writable file, and optionally `PORT` (8080) and `ALLOWED_ORIGINS` (comma-separated subset of the fixed production origins). A missing or different bot ID fails closed. Do not configure a bot token. Production origins are `https://play.plusvibegames.com` and `https://gobestvini.github.io`; localhost is only available through the in-process dev factory, not a production wildcard.

```powershell
$env:MAGNET_SORT_BOT_ID='8820798959'
$env:LEADERBOARDS_DB='C:/absolute/own-data/leaderboards.sqlite'
npm --prefix server run migrate
npm --prefix server start
```

Equivalent container entry from the repository root: `node server/leaderboards/main.mjs`. The persistent directory must belong to UID/GID1000 and be private. Production main sets umask077. WAL, foreign keys, synchronous FULL and busy_timeout2000ms are enabled; one HTTP owner writes, replay workers have no SQLite handles. Schema version1 is the first schema, fresh creation is transactional, and unknown/future schemas fail closed. Never run the migration CLI concurrently with an old production writer. Later upgrades must stop/drain only this service and take a verified snapshot before migration.

`createApp` in `server/leaderboards/http.mjs` exports an in-process factory returning `{server,ready,store,pool,close}`. Await ready before listening. Factory clock/key/origin/pool injection is for controlled test/development code; main reads none of those test overrides from the environment.

## HTTP response shapes

All paths start `/v1` inside the container. Shared Caddy strips only `/magnet-sort` from public `https://api.plusvibegames.com/magnet-sort/v1`.

- Auth: `{token,expiresAt,player:{playerId,displayName},serverTime}`; times are Unix milliseconds. Token is32 random bytes/base64url; only SHA256 is stored. Identity comes solely from the signed launch.
- Register: POST `/runs` receives `{clientAttemptId,mode,descriptor,publishConsent:true}`, returns `{runId,descriptor,expiresAt,serverTime}`. IDs are UUIDv4. The same account/clientAttemptId/descriptor returns the same run. Network retry uses the old ID; a new gameplay attempt uses a new ID.
- Result: POST `/runs/:id/result` receives exactly `{actions,assisted}`, returns `{receipt:{runId,digest,acceptedAt},metrics:{moves,stars,cleared},personalBest,serverTime}`. Do not send client totals. Receipt retry is checked before active-run expiry and remains available90days after acceptance with a fresh bearer. Assistance is allowed and does not form a separate ranking category.
- Campaign read returns `{boardKey,rows,ownRow,rules,serverTime}`; rows have `playerId,displayName,rank,completedLevels,stars`. Default profile is rules4/content `sub-ten-2026-10-20.1`/preset `campaign-a-v1`. Optional query selectors must match the supported profile.
- Daily read requires `?date=YYYY-MM-DD`; optional rules/content/preset/catalog selectors must match. Rows have `playerId,displayName,rank,moves`, with top-level date. Frozen catalog is `daily-30-2026-10-25.1`, preset `short-b-2026-10-25.1`. Register descriptors include rulesVersion4 plus the existing getDaily fields; optional index is checked and removed from the canonical response.
- Reads are Top50 plus ownRow (null without a verified result/optional bearer), using one SQLite read snapshot. Ties use competition ranking1,1,3, stable opaque-player ordering. Campaign compares unique completed levels then best-star sum; moves on different campaign seeds are not compared.
- DELETE `/me` requires bearer and `{confirm:"delete-leaderboards"}`; deletes only that player's live service data/session/results. Local game save is untouched. Encrypted snapshots expire under the separate retention policy.
- Error: `{error:{code,requestId,retryable},serverTime}`; 429/503 include Retry-After. No raw auth/replay/private Telegram ID is logged or returned publicly.

Health endpoints are `/health/live`, `/health/ready`; `/capabilities` exposes supported profiles. Client should authenticate on a fresh Telegram launch (age≤300s/skew≤30s), store only its short service session in scoped sessionStorage and obtain consent before registering/publishing. An offline/expired launch requires reopening the app; it must not destroy local progress or weaken verification. Token TTL24h does not slide; maximum10 active sessions/account.

Daily run registration uses the server's current UTC day; a client clock cannot register yesterday retroactively. A previously registered run accepts until end of the next UTC day. Midnight does not mutate the descriptor. One real catalog/seed/version per day, same accepted journal/kernel as the client; historical local results alone are not imported as verified leaderboard records.

## Resource/lifecycle controls

Two workers, maximum16 queued, active replay250ms and whole operation5s; timeout kills/replaces that worker. Worker heaps are bounded, requests and queue jobs have cleanup; disconnected clients cancel an uncommitted replay. Database commit is synchronous/short, so loss of response after commit is recovered by idempotent retry. Graceful shutdown stops HTTP intake, waits for bounded active requests and terminates remaining workers before closing SQLite.

JSON bodies use strict duplicate-key/fatal-UTF8 parsing: auth16KiB (initData8KiB), others256KiB, actions2048, descriptor2KiB, read timeout5s, headers16KiB. Global and verified-account token buckets match the ADR; untrusted forwarded IP headers never bypass limits or define identity. Limiter memory is bounded10k entries/1h idle TTL. Cleanup runs in bounded batches every5minutes; journals30days, receipts90days, daily90days, inactive accounts365days. Best rows survive pruning of accepted runs via ON DELETE SET NULL; deleting a player cascades its own data.

## Online snapshot, restore verification and smoke

Use a new destination for every snapshot, never the live DB or an existing file:

```powershell
npm --prefix server run backup -- C:/absolute/own-backups/snapshot.sqlite
npm --prefix server run restore:check -- C:/absolute/own-backups/snapshot.sqlite
```

Direct commands from repository root: `node server/leaderboards/backup.mjs NEW_DEST.sqlite`, `node server/leaderboards/restore-check.mjs SNAPSHOT.sqlite`. Source is `LEADERBOARDS_DB`. Backup uses SQLite's online API with a live WAL writer supported, verifies schema/integrity/foreign keys, publishes the completed file without overwrite and sets mode0600. Restore-check opens read-only and checks schema/integrity and receipt/run bindings. These checks do not restore over the live DB. Operational restore must target a separate new path; stop only the own HTTP writer before a planned switch.

`LEADERBOARDS_API_URL` points to the HTTPS base (or default local `http://127.0.0.1:8080/v1`); `npm --prefix server run smoke` checks liveness/readiness, both public ranking shapes, no-store and unsigned-auth denial. It submits no player result and is not evidence of a real Telegram login.

Container/Compose, scoped Caddy patch, offsite repository,5h backup timer and restore/rollout/rollback are in `server/deploy/`. Offsite backup is a separate restic repository/tag/password, not White Tower's existing repository. Do not run its forget/prune or alter its timer. Native ARM image, actual HTTPS, own snapshot upload/restore and unchanged neighboring routes remain mandatory release checks; the unit suite cannot establish them.
