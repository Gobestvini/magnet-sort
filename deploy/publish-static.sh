#!/usr/bin/env bash
set -euo pipefail
SOURCE=$(realpath -- "${1:?Usage: publish-static.sh STAGED_DIRECTORY RELEASE_ID}")
RELEASE=${2:?Choose a unique commit-based release ID}
[[ "$RELEASE" =~ ^[a-zA-Z0-9_-]{7,80}$ ]] || { echo 'Invalid release ID' >&2; exit 1; }
ROOT=/srv/tower/checkout/server/deploy/static/magnet-sort
mkdir -p "$ROOT/releases" "$ROOT/shared/assets"
exec 9>"$ROOT/.publish.lock"
flock -n 9 || { echo 'Another Magnet Sort release is publishing' >&2; exit 1; }
[[ "$SOURCE" != "$ROOT" && "$SOURCE" != "$ROOT/"* ]] || { echo 'Source overlaps deployed static' >&2; exit 1; }
python3 - "$SOURCE" <<'PY'
import json, pathlib, re, sys
root = pathlib.Path(sys.argv[1])
info = json.loads((root / 'build-info.json').read_text())
if info['game'] != 'magnet-sort' or info['base'] != './' or not info['minified'] or not re.fullmatch('[a-f0-9]{40}', info['revision']):
    raise SystemExit('Wrong game, base or revision')
if not (root / 'index.html').is_file() or not (root / 'assets').is_dir():
    raise SystemExit('Incomplete static release')
for p in root.rglob('*'):
    if p.is_symlink() or p.name.startswith('.') or (p.is_file() and p.suffix.lower() not in {'.html', '.js', '.css', '.json', '.webp', '.svg', '.ttf', '.woff', '.woff2'}):
        raise SystemExit('Unexpected file in static release')
for asset in info['assets']:
    if not asset.startswith('assets/') or '..' in asset or not (root / asset).is_file():
        raise SystemExit('Missing or unsafe build asset')
PY
[[ ! -e "$ROOT/releases/$RELEASE" ]] || { echo 'Release already exists' >&2; exit 1; }
cp -R -- "$SOURCE" "$ROOT/releases/$RELEASE"
chmod -R a+rX "$ROOT/releases/$RELEASE"
# Old content-hashed URLs must remain usable by clients already running the game.
cp -Rn -- "$SOURCE/assets/." "$ROOT/shared/assets/"
ln -s "releases/$RELEASE" "$ROOT/.current-$RELEASE"
mv -Tf -- "$ROOT/.current-$RELEASE" "$ROOT/current"
echo "Magnet Sort release switched to $RELEASE"
