#!/usr/bin/env bash
set -euo pipefail
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
source "$BASE/common.sh"
require_root
[ "${3:-}" = '--apply' ] || { echo 'Usage: publish.sh RELEASE_ROOT SHA --apply [--rollback-compatible]' >&2; exit 1; }
RELEASE=$(release_path "$1")
SHA=$2
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] && [ "$RELEASE" = "$ROOT/releases/$SHA" ] || exit 1
[ "$(realpath -e "$ROOT")" = "$ROOT" ] || { echo 'Own root traverses a symlink' >&2; exit 1; }
require_private "$CONFIG/leaderboards.env"
require_private "$BACKUP_ENV"
[ -f "$CONFIG/leaderboards-restic.initialized" ] || { echo 'Initialize own offsite repo first' >&2; exit 1; }
exec 8>/run/lock/magnet-sort-leaderboards-deploy.lock
flock -n 8 || { echo 'Own deployment already running' >&2; exit 1; }
exec 9>/run/lock/magnet-sort-leaderboards-backup.lock
flock -w 3300 9 || { echo 'Own backup did not finish in budget' >&2; exit 1; }
[ ! -e "$ROOT/deployment-incomplete" ] || { echo 'Previous own deploy incomplete; inspect schema/config/current before retry' >&2; exit 1; }
IMAGE="magnet-sort-leaderboards:$SHA"
ROLLBACK=${4:-}
if [ -z "$ROLLBACK" ]; then
  docker build --platform linux/arm64 --build-arg "SOURCE_REVISION=$SHA" \
    --tag "$IMAGE" --file "$RELEASE/server/Dockerfile" "$RELEASE"
elif [ "$ROLLBACK" != '--rollback-compatible' ]; then
  echo 'Unsupported deploy mode' >&2; exit 1
fi
[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE")" = "$SHA" ] || {
  echo 'Immutable image source revision mismatch' >&2; exit 1;
}
# Native ARM tests and actual bundled SQLite. No network, credentials or production DB.
docker run --rm --network none --read-only --tmpfs /tmp:size=64m --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 512m --cpus 1 \
  -e NODE_ENV=test -e MAGNET_SORT_BOT_ID=8820798959 -e LEADERBOARDS_DB=/tmp/test.sqlite \
  "$IMAGE" npm --prefix server test
docker run --rm --network none --read-only "$IMAGE" node -e \
  'const D=require("./server/node_modules/better-sqlite3");const d=new D(":memory:");if(d.prepare("select sqlite_version() v").get().v!=="3.53.4")process.exit(1);d.close()'
printf '%s\n' "$SHA" >"$ROOT/deployment-incomplete"
PREVIOUS=
if [ -L "$ROOT/current" ]; then
  PREVIOUS=$(current_release)
  OLD_RELEASE=$RELEASE
  RELEASE=$PREVIOUS
  # Maintenance affects only the owned marker, and precedes stopping its writer.
  route --maintenance
  compose stop api
  SNAPSHOT="predeploy-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite"
  compose --profile maintenance run --rm --no-deps maintenance \
    node server/leaderboards/backup.mjs "/backup/$SNAPSHOT"
  compose --profile maintenance run --rm --no-deps maintenance \
    node server/leaderboards/restore-check.mjs "/backup/$SNAPSHOT"
  RELEASE=$OLD_RELEASE
fi
TEMP_ENV=$(mktemp "$CONFIG/leaderboards-release.env.XXXXXX")
printf 'MAGNET_SORT_IMAGE=%s\nSOURCE_REVISION=%s\n' "$IMAGE" "$SHA" >"$TEMP_ENV"
chmod 600 "$TEMP_ENV"
mv -f -- "$TEMP_ENV" "$RELEASE_ENV"
compose config --quiet
if [ -n "$ROLLBACK" ] && [ -n "${SNAPSHOT:-}" ]; then
  # Old code must understand today's schema/data. Never restore an old DB over new wins.
  compose --profile maintenance run --rm --no-deps maintenance \
    node server/leaderboards/restore-check.mjs "/backup/$SNAPSHOT"
elif [ -z "$ROLLBACK" ]; then
  compose --profile maintenance run --rm --no-deps maintenance node server/leaderboards/migrate.mjs
fi
compose up -d --no-deps --wait --wait-timeout 90 api
CURRENT_TMP="$ROOT/.current-$$"
ln -s -- "$RELEASE" "$CURRENT_TMP"
mv -Tf -- "$CURRENT_TMP" "$ROOT/current"
rm -f -- "$ROOT/deployment-incomplete"
# Backups share one lock with deploy; release it only after image/current is coherent.
flock -u 9
bash "$RELEASE/server/deploy/backup.sh"
bash "$RELEASE/server/deploy/restore-check.sh"
bash "$RELEASE/server/deploy/status.sh"
for unit in magnet-sort-leaderboards-backup.service magnet-sort-leaderboards-backup.timer \
  magnet-sort-leaderboards-freshness.service magnet-sort-leaderboards-freshness.timer; do
  install -m 644 "$RELEASE/server/deploy/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now magnet-sort-leaderboards-backup.timer magnet-sort-leaderboards-freshness.timer
# Only after native tests, own readiness and actual offsite restore, expose this API.
route
bash "$RELEASE/server/deploy/smoke.sh"
printf 'Magnet Sort API release ready: %s\n' "$SHA"
