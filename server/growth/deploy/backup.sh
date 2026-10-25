#!/usr/bin/env bash
set -euo pipefail
root=/srv/magnet-sort/growth/current
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -p magnet-sort-growth -f "$root/server/growth/deploy/compose.yaml" exec -T growth node server/backup.mjs "/backups/$stamp"
# Reuse the existing encrypted backup destination, never copy its secret into a game.
if [ -r /etc/white-tower/backup.env ]; then
  set -a
  source /etc/white-tower/backup.env
  set +a
  restic backup --tag magnet-sort-growth "/srv/magnet-sort/growth/backups/$stamp" /etc/magnet-sort/growth.env
  restic forget --tag magnet-sort-growth --group-by host,tags --keep-hourly 24 --keep-daily 7 --keep-weekly 4 --keep-monthly 6
  docker compose -p magnet-sort-growth -f "$root/server/growth/deploy/compose.yaml" exec -T growth node server/prune-backups.mjs
else
  echo 'Offsite backup configuration unavailable; local snapshots retained for recovery, operator action required.' >&2
  exit 1
fi
