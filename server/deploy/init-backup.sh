#!/usr/bin/env bash
set -euo pipefail
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
source "$BASE/common.sh"
require_root
[ "${1:-}" = '--apply' ] || { echo 'Requires --apply after deployment review' >&2; exit 1; }
load_backup
if [ -f "$CONFIG/leaderboards-restic.initialized" ]; then
  restic cat config >/dev/null
else
  # Only a newly provisioned dedicated repo/password may be initialized.
  # Failure (including an existing inaccessible repo) stops; no reset/rekey.
  restic init >/dev/null
  install -m 600 /dev/null "$CONFIG/leaderboards-restic.initialized"
fi
echo 'Dedicated offsite repository ready'
