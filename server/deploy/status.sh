#!/usr/bin/env bash
set -euo pipefail
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
source "$BASE/common.sh"
require_root
python3 - "$ROOT/backups/last-success.json" <<'PY'
import json, pathlib, sys, time
try:
    completed=json.loads(pathlib.Path(sys.argv[1]).read_text())["completedAt"]
    age=int(time.time())-completed
    if not 0<=age<=21600: raise ValueError("stale")
except (OSError,ValueError,TypeError,KeyError):
    print("ERROR: Magnet Sort offsite backup stale/missing; RPO target is not met",file=sys.stderr)
    raise SystemExit(1)
print("Magnet Sort offsite backup freshness OK; ageSeconds="+str(age))
PY
