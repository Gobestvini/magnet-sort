# Magnet Sort URL opening White Tower — 2026-10-18

The reported failure was reproduced. Direct HTTP requests to
`https://play.plusvibegames.com/magnet-sort/` returned Magnet Sort, including its
correct build-info. In a browser with a previously installed White Tower root
worker, the same navigation returned cached White Tower HTML instead.
Earlier production checks used fresh browser contexts, so they missed it.

The root worker now owns only White Tower's exact scope root/index entry and its
asset/content URLs. It passes other project navigations and APIs through to the
network. Other game tabs no longer block the tower's safe-update consensus.
The source fix is committed in the White Tower project; its separate working
changes and staged deletions were preserved with an isolated index.

For the existing VPS release, a narrowly verified backport preserves the exact
compiled cache name, existing game assets and saved progress. It skips redundant
recaching on an installed matching cache and activates the routing fix. The
installer checks the previously verified worker hash, saves the original and
replaces only the active worker atomically. Future content updates keep the
normal safe-state flow; the installer refuses unknown/changed worker source.

Evidence: `tests/fixtures/white-tower-root-sw.js` reproduces the original behavior;
the backport unit tests cover root/subpath delegation, retained offline shell,
cache identity and idempotence. White Tower's 272 tests/typecheck/build/release
bundle pass in a clean checkout. The real-host browser regression retains the
same persistent profile across before/after and checks a storage marker plus
White Tower offline navigation. Logs/screenshots stay in ignored artifacts.

Commands and deployment boundaries: `deploy/README.md`. These are browser
surrogate checks; no physical-device claim.
