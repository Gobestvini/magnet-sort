# Magnet Sort static publication

Production: https://play.plusvibegames.com/magnet-sort/ . GitHub Pages remains
https://gobestvini.github.io/magnet-sort/ . Both use the same relative-base build.

`pnpm check:full` builds minified JS/CSS and content-hashed WebP assets. Original
PNG pixels stay in `public/`; unused files, source maps and local configuration
are excluded. `dist/resource-sizes.json` records conversion sizes/options;
`dist/build-info.json` identifies the source commit. Build from the committed
revision in a clean checkout so unrelated working changes are never published.

After checks and `node tools/loading-browser-check.cjs` plus
`node tools/pages-browser-check.cjs` and `node tools/tutorial-browser-check.cjs`, archive the dist **contents** and upload to
a new `/srv/tower/incoming/magnet-sort-RELEASE` directory over the existing
verified SSH connection. Do not upload env files, keys or repository credentials.
Copy `publish-static.sh` to `/srv/tower/magnet-sort-deploy/`, then:

```sh
bash /srv/tower/magnet-sort-deploy/publish-static.sh /srv/tower/incoming/magnet-sort-RELEASE RELEASE
```

Publisher validates the game, revision, base and file allowlist, retains old
content-hashed assets, and atomically switches only Magnet Sort's `current` link.
It shares the existing Caddy static bind mount; no new container, DNS or API is
needed. For the first install, save a backup of the live Caddyfile and run
`python3 configure-caddy.py /srv/tower/checkout/server/deploy/Caddyfile`.
From the existing Compose directory validate with
`docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
then reload with `docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
Restore the backup on validation failure. Other games, bot URLs, APIs and account
services are outside this deployment.

Verify HTTPS `build-info.json` matches the commit, immutable assets have cache
headers, missing files return 404 and `GAME_BASE_URL=https://play.plusvibegames.com/magnet-sort/ node tools/pages-browser-check.cjs`
passes. For rollback create a temporary symlink to `releases/PREVIOUS` inside
`static/magnet-sort` and atomically replace `current` with `mv -Tf`. Keep shared
assets and old releases while older clients can still use them.

## Root worker shared with White Tower

The offline White Tower worker at `/sw.js` used to return its cached HTML for
every navigation on this origin. A browser that had visited the tower could
therefore show it at `/magnet-sort/`, even while Caddy served the correct game.
The upstream source fix is White Tower commit `3efd77c`: only the scope root and
`index.html` are owned navigation entries; foreign projects/APIs are delegated
and foreign tabs cannot block safe worker updates.

For the already deployed older White Tower release, the routing-only backport
preserves its compiled cache/build identity and keeps saved data and offline
assets. Fetch the live `/sw.js` as a source snapshot, then run locally:

```sh
node deploy/backport-worker-scope.mjs DEPLOYED_SW STAGED_SW
```

Upload the staged worker and `install-worker-scope.py` to the existing deploy
tools directory. Run the installer with the staged path and SHA-256 of the
snapshot's UTF-8 text after CRLF→LF and trailing-whitespace removal. It verifies
the active release path, unchanged live source and identical cache identity,
saves a backup, then atomically replaces only `sw.js`. For an installed matching
cache, the hotfix activates without re-downloading or deleting it; first-time
visitors still get normal complete offline preparation. Future White Tower
content builds use their regular safe-state update flow.

`node tools/shared-origin-browser-check.cjs --seed` stores a real browser profile
reproducing the old bug. After the hotfix, run without `--seed` against that same
profile: it must open Magnet Sort, preserve the storage marker and still open
White Tower at `/` offline. Use a test profile, never clear a player's storage.
Unit fixture provenance: `tests/fixtures/white-tower-root-sw.js` is the public
deployed worker from White Tower release `2a3b8ef`, cache `ef2bd248cabedc52`.
