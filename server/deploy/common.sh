#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/srv/magnet-sort/leaderboards
CONFIG=/etc/magnet-sort
PROJECT=magnet-sort-leaderboards
RELEASE_ENV=$CONFIG/leaderboards-release.env
BACKUP_ENV=$CONFIG/leaderboards-backup.env
require_root() { [ "$(id -u)" = 0 ] || { echo 'Root is required' >&2; exit 1; }; }
release_path() {
  local candidate
  candidate=$(realpath -e -- "$1")
  [[ "$candidate" =~ ^/srv/magnet-sort/leaderboards/releases/[0-9a-f]{40}$ ]] || {
    echo 'Expected an immutable Magnet Sort release path' >&2; return 1;
  }
  printf '%s\n' "$candidate"
}
current_release() { release_path "$ROOT/current"; }
compose() {
  docker compose --project-name "$PROJECT" --env-file "$RELEASE_ENV" \
    -f "${RELEASE:?}/server/deploy/compose.yaml" "$@"
}
require_private() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(stat -c '%a:%u' "$1")" = '600:0' ] || {
    echo 'Expected a root-owned 0600 credential file' >&2; return 1;
  }
}
load_backup() {
  require_private "$BACKUP_ENV"
  set -a
  # Created by provision.py, owned by root; never source an uploaded/client file.
  source "$BACKUP_ENV"
  set +a
  require_private "$RESTIC_PASSWORD_FILE"
  [[ "$RESTIC_REPOSITORY" == sftp:*/magnet-sort-leaderboards || "$RESTIC_REPOSITORY" == sftp:*:magnet-sort-leaderboards ]] || {
    echo 'Refusing a non-dedicated restic repository' >&2; return 1;
  }
  [ "$RESTIC_REPOSITORY" != "${WHITE_TOWER_REPOSITORY_GUARD:?}" ] || return 1
}
route() {
  local config=/srv/tower/checkout/server/deploy/Caddyfile cid expected
  cid=$(docker ps -q --filter label=com.docker.compose.service=caddy)
  [[ "$cid" =~ ^[a-f0-9]+$ ]] || { echo 'Expected one running Caddy' >&2; return 1; }
  [ "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "$cid")" = "$config" ] || {
    echo 'Caddy mounted source changed; audit again' >&2; return 1;
  }
  expected=$(sha256sum "$config" | cut -d' ' -f1)
  python3 "$RELEASE/server/deploy/install_caddy.py" "$config" "$cid" "$expected" "$@"
}
