#!/usr/bin/env bash
set -euo pipefail
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
source "$BASE/common.sh"
require_root
[[ "${1:-}" =~ ^[0-9a-f]{40}$ ]] && [ "${2:-}" = '--apply' ] || {
  echo 'Usage: rollback.sh PREVIOUS_SHA --apply (only schema-compatible code rollback)' >&2; exit 1;
}
exec bash "$BASE/publish.sh" "$ROOT/releases/$1" "$1" --apply --rollback-compatible
