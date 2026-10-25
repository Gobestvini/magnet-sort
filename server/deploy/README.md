# Magnet Sort leaderboard deployment

This directory operates only `/srv/magnet-sort/leaderboards`, its Compose project
`magnet-sort-leaderboards`, and the marked `/magnet-sort` route in the existing API
Caddy site. It never stops/recreates White Tower, its test service, CarWars or Caddy.
Read [the server contract](../../docs/design/LEADERBOARDS_SERVER.md) first.

All commands below run as root on the audited ARM64 VPS. Source releases must come
from the checked committed tree, including the root `.dockerignore`, and are unpacked
without secrets into `/srv/magnet-sort/leaderboards/releases/FULL_SHA`. Do not upload
the whole dirty workspace, node_modules, front-end assets or any populated env file.
The Dockerfile's explicit COPY list imports only the server, pure model graph and
daily witnesses. Its Node base has a fixed multiarch digest; the build checks actual
SQLite3.53.4, and native ARM tests run with no network/production DB/credentials.

## First install

1. Recheck free memory/disk, `tower-edge`, existing `/health`, `/test/health`,
   `/carwars/health`, both static games and the White Tower backup timer. Snapshot
   the **currently mounted** Caddyfile and SHA; local old Caddyfiles are never installed.
2. Run `python3 server/deploy/provision.py --apply` from the approved source release.
   It creates only own config/data directories. It reads the existing root0600
   `/etc/white-tower/backup.env` for SFTP repository metadata, derives a separate
   `magnet-sort-leaderboards` sibling repository, and creates an independent random
   password at `/etc/magnet-sort/leaderboards-restic.password`, mode0600.
   The own app/backup env files are root0600. Existing offsite SSH access remains
   read-only shared access metadata; the existing repository/password/timers are untouched.
   Keep this new restic password in the owner's existing protected recovery process;
   it is deliberately outside the snapshot/repository it decrypts.
3. Run `bash server/deploy/init-backup.sh --apply`. A failed init is an error, never
   an excuse to reset/rekey a repository. After an interrupted successful init,
   verify `restic cat config` with the own protected env before creating the own
   `leaderboards-restic.initialized` marker; do not create that marker blindly.
4. Run `bash server/deploy/publish.sh "$PWD" FULL_SHA --apply` from its exact
   `/srv/magnet-sort/leaderboards/releases/FULL_SHA` directory. The script builds
   the immutable image, runs ARM tests, migrates only the own DB, waits for readiness,
   switches own `current`, performs an actual offsite backup and separate DB restore
   check, installs only its own timers, then adds the public route and runs HTTPS
   auth/CORS/neighbor smoke. Offsite failure stops before first route exposure.
5. Verify source revision in the immutable image label, the API's expected
   content/preset/catalog versions and both campaign/daily capabilities, own backup
   freshness and unchanged neighboring timer/health. Real
   signed Telegram auth and actual two-identity tests are separate acceptance steps;
   unauthenticated smoke does not claim them.

App config contains only the fixed public bot ID and exact allowed origins. No bot
token is needed. The container is UID1000, read-only rootfs, cap-free, no host port,
512MiB/1CPU, PID64, bounded logs; only its own `/data` is writable and `/tmp` is tmpfs.
Only API joins `tower-edge`; maintenance jobs have no network.

## Updates, maintenance and rollback

Publish holds an own deploy lock and a backup lock. It first changes only the owned
route to maintenance503, drains/stops only its writer, makes a verified old-image
snapshot, then migrates with the new image while no HTTP writer runs. Current and
image config become coherent before backup lock release. Old immutable releases,
images and `predeploy-*.sqlite` snapshots remain available; the automated eight-file
retention applies only to scheduled `leaderboards-*.sqlite` files.

An interrupted writer/migration/image switch leaves `deployment-incomplete`; scheduled
backups and another publish fail closed until the operator checks schema, image env
and current, makes them coherent, and removes only that own marker. No failed deploy
automatically restarts an incompatible old writer. Maintenance stays restricted to
the owned route; neighboring applications remain live.

For a **schema-compatible code rollback**, run
`bash server/deploy/rollback.sh PREVIOUS_FULL_SHA --apply`. It validates today's
snapshot with the old image before starting it and does not restore old data over
new wins. A failed compatibility check leaves the own route in maintenance; do not
automatically erase new accepted records. For incompatible schema rollback, restore
an explicitly chosen verified snapshot to a **new separate data directory** under
the own root while the writer is stopped, validate with the chosen image, document
the accepted loss window and update only own bind configuration after explicit review.
There is no destructive down migration or automatic data-loss rollback.

To remove only the API route, run `install_caddy.py` on the actual mounted file with
its fresh expected SHA and `--remove`. Normal installation/maintenance/removal accept
only this tool's exact marker block. It validates the candidate using the running
Caddy binary/environment before writing, compares the original hash/bytes/inode,
writes and fsyncs the same file inode (a regular-file bind must keep seeing it), and
reloads without recreating Caddy. On reload failure it restores/reloads the original
only while the shared file still has its own candidate bytes and inode; a concurrent
edit is preserved and rollback fails closed.
Snapshots are root-only in `caddy-snapshots/`. Any route/config drift fails closed.

## Backup and restore

Own timer starts every5h, randomized delay at most5min. The job and systemd hard
budget are54min (below the55min contract), leaving freshness margin. It uses SQLite's
online backup API, checks integrity/schema/receipt bindings, uploads just the verified
snapshot to its separate restic repo, then applies own tag/host retention daily7,
weekly4, monthly3. Only the latest8 successful local regular snapshots remain.
No live WAL file is copied and no White Tower forget/prune is ever run.

`bash server/deploy/restore-check.sh` downloads the latest **own** encrypted offsite
snapshot into a separate temporary DB, checks it with the current image and deletes
only that temporary copy. It never writes over the live DB. Measure backup and
restore duration before asserting the target RPO≤6h/RTO≤1h. `status.sh` returns nonzero
when the last completed offsite upload is older than6h; the own hourly freshness
timer records this operator error in systemd journal, without chat notifications.
Missing/failed offsite access is a production acceptance failure.

Do not print populated env/Compose config, RESTIC access paths, raw initData,
credentials or Docker env to logs/chat. Use `compose config --quiet` and bounded
status/exit-code diagnostics. App data/session/token/replays are excluded from Caddy
smoke output and source archives; backups carry only the encrypted DB snapshot.

Local checks: `python server/deploy/test_deploy.py`; `bash -n` on all own shell files.
Native Caddy validation, Compose configuration and Docker/ARM execution require the
VPS; record their actual results separately from local syntax tests.
