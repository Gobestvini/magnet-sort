#!/usr/bin/env bash
set -euo pipefail
BASE_URL=https://api.plusvibegames.com/magnet-sort/v1
for path in health/live health/ready capabilities; do
  curl --fail --silent --show-error --max-time 15 "$BASE_URL/$path" >/dev/null
done
HEADERS=$(mktemp)
BODY=$(mktemp)
trap 'rm -f -- "$HEADERS" "$BODY"' EXIT
CODE=$(curl --silent --show-error --max-time 15 -D "$HEADERS" -o "$BODY" -w '%{http_code}' \
  -H 'Origin: https://play.plusvibegames.com' -H 'Content-Type: application/json' \
  --data '{"initData":"invalid"}' "$BASE_URL/auth/telegram")
[ "$CODE" = 401 ] || { echo 'Expected strict public auth rejection' >&2; exit 1; }
grep -iq '^cache-control:.*no-store' "$HEADERS"
grep -iq '^access-control-allow-origin: https://play.plusvibegames.com' "$HEADERS"
[ "$(curl --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' \
  -H 'Origin: https://example.invalid' "$BASE_URL/capabilities")" = 403 ]
# Existing API and static routes must survive the scoped insertion/reload.
for url in https://api.plusvibegames.com/health https://api.plusvibegames.com/test/health \
  https://play.plusvibegames.com/ https://play.plusvibegames.com/magnet-sort/ \
  https://api.plusvibegames.com/carwars/health; do
  curl --fail --silent --show-error --max-time 15 "$url" >/dev/null
done
echo 'HTTPS readiness/CORS/auth and neighboring routes passed'
