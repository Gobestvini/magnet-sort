"""Atomically install a verified routing-only hotfix in the active VPS worker."""
import hashlib
import json
import os
import pathlib
import re
import sys

staged = pathlib.Path(sys.argv[1])
expected = sys.argv[2]
base = pathlib.Path('/srv/tower/checkout/server/deploy/static/white-tower')
target = (base / 'current/sw.js').resolve(strict=True)
if not target.is_relative_to((base / 'releases').resolve(strict=True)):
    raise SystemExit('Active worker escaped its release directory')
old, new = target.read_text(), staged.read_text()
identity = lambda source: re.search(r'^const CACHE_NAME = .+;$', source, re.M).group(0)
if '// Shared-origin worker scope hotfix v1' not in new or identity(old) != identity(new):
    raise SystemExit('Hotfix must preserve the deployed cache identity')
if old == new:
    print('Worker scope hotfix is already installed')
    raise SystemExit(0)
digest = hashlib.sha256(old.rstrip().encode()).hexdigest()
if digest != expected:
    raise SystemExit('Live worker changed since verification; no files replaced')
backup = pathlib.Path('/srv/tower/magnet-sort-deploy') / f'worker-before-scope-{digest}.js'
if not backup.exists():
    backup.write_bytes(target.read_bytes())
temporary = target.parent / f'.sw-scopefix-{digest}'
temporary.write_text(new)
temporary.chmod(target.stat().st_mode & 0o777)
os.replace(temporary, target)
print(json.dumps({'workerScopeFixed': True, 'cachePreserved': identity(new), 'backupSaved': True}))
