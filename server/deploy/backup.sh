#!/usr/bin/env bash
set -euo pipefail
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
source "$BASE/common.sh"
require_root
if [ "${1:-}" != '--bounded' ]; then
  exec timeout --signal=TERM --kill-after=10s 3240 bash "$0" --bounded
fi
load_backup
exec 9>/run/lock/magnet-sort-leaderboards-backup.lock
flock -n 9 || { echo 'Own backup already running' >&2; exit 1; }
RELEASE=$(current_release)
[ ! -e "$ROOT/deployment-incomplete" ] || { echo 'Own deployment incomplete; operator recovery required' >&2; exit 1; }
JOB=magnet-sort-leaderboards-backup-job
cleanup() {
  local outcome=$?
  trap - EXIT
  docker rm -f "$JOB" >/dev/null 2>&1 || true
  # The local disk bound holds even after a failed SFTP upload or restic prune.
  python3 "$BASE/prune_backups.py" "$ROOT/backups" || outcome=1
  exit "$outcome"
}
trap cleanup EXIT
# Recover bounded leftovers from an interrupted/killed previous own job too.
docker rm -f "$JOB" >/dev/null 2>&1 || true
python3 "$BASE/prune_backups.py" "$ROOT/backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
SNAPSHOT="leaderboards-$STAMP.sqlite"
compose --profile maintenance run --rm --no-deps --name "$JOB" maintenance \
  node server/leaderboards/backup.mjs "/backup/$SNAPSHOT"
compose --profile maintenance run --rm --no-deps --name "$JOB" maintenance \
  node server/leaderboards/restore-check.mjs "/backup/$SNAPSHOT"
restic backup --quiet --host magnet-sort-leaderboards --tag magnet-sort-leaderboards "$ROOT/backups/$SNAPSHOT"
restic forget --quiet --prune --host magnet-sort-leaderboards --tag magnet-sort-leaderboards \
  --group-by host,tags --keep-daily 7 --keep-weekly 4 --keep-monthly 3
python3 - "$ROOT/backups" "$SNAPSHOT" <<'PY'
import json, pathlib, sys, time, os
root = pathlib.Path(sys.argv[1])
target = root / "last-success.json"
temp = root / "last-success.json.tmp"
temp.write_text(json.dumps({"completedAt":int(time.time()),"snapshot":sys.argv[2]}) + "\n")
os.chmod(temp, 0o600)
temp.replace(target)
PY
echo 'Own verified SQLite snapshot uploaded; dedicated retention applied'
