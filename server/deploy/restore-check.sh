#!/usr/bin/env bash
set -euo pipefail
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
source "$BASE/common.sh"
require_root
load_backup
RELEASE=$(current_release)
exec 9>/run/lock/magnet-sort-leaderboards-backup.lock
flock -n 9 || { echo 'Own backup/restore already running' >&2; exit 1; }
META=$(mktemp "$ROOT/backups/restore-metadata.XXXXXX")
RESTORE="restore-check-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite"
JOB=magnet-sort-leaderboards-restore-job
trap 'rm -f -- "$META" "$ROOT/backups/$RESTORE"; docker rm -f "$JOB" >/dev/null 2>&1 || true' EXIT
restic snapshots --json --host magnet-sort-leaderboards --tag magnet-sort-leaderboards >"$META"
readarray -t SELECTED < <(python3 - "$META" <<'PY'
import json,re,sys
entries=json.load(open(sys.argv[1]))
if not entries: raise SystemExit("No own offsite snapshot")
e=max(entries,key=lambda e:e["time"])
if not re.fullmatch(r"[0-9a-f]{64}",e["id"]) or len(e["paths"])!=1: raise SystemExit("Unexpected snapshot metadata")
p=e["paths"][0]
if not re.fullmatch(r"/srv/magnet-sort/leaderboards/backups/leaderboards-[0-9TZ]+\.sqlite",p): raise SystemExit("Unexpected snapshot path")
print(e["id"]);print(p)
PY
)
[ "${#SELECTED[@]}" = 2 ] || { echo 'Cannot resolve own snapshot' >&2; exit 1; }
restic dump "${SELECTED[0]}" "${SELECTED[1]}" >"$ROOT/backups/$RESTORE"
chown 1000:1000 "$ROOT/backups/$RESTORE"
compose --profile maintenance run --rm --no-deps --name "$JOB" maintenance \
  node server/leaderboards/restore-check.mjs "/backup/$RESTORE"
echo 'Offsite restore integrity/schema/record consistency passed in a separate temporary DB'
