# Magnet Sort growth service

This service is independent of server/leaderboards and its Dockerfile/deploy
tools. Never replace the leaderboard image, configuration or database with it.
Entry: server/main.mjs. Databases: telemetry.sqlite and commerce.sqlite.

Build from a reviewed committed release:

    docker compose -p magnet-sort-growth -f server/growth/deploy/compose.yaml up -d --build

Permanent paths: /srv/magnet-sort/growth/{releases,current,data,backups}.
Data/backups are writable by UID1000, mode0700. Configuration is
/etc/magnet-sort/growth.env, root-owned0600, using the adjacent example.
Keep tokens/admin credentials outside Git, archives and public VITE variables.

The service joins tower-edge as magnet-sort-growth:8080, with no host port.
Only /magnet-sort-growth/* is added to the API host by
deploy/configure-growth-caddy.mjs. Preserve the current mounted Caddyfile inode,
save its backup, validate in the existing Caddy container and reload only after
validation succeeds. Other routes and the leaderboard /magnet-sort/* stay intact.

Before registering the existing game bot webhook, check that its current
webhook is empty or already points to this service. Target:
https://api.plusvibegames.com/magnet-sort-growth/v1/telegram/webhook .
Use the protected secret header and retain pending updates. Do not create a bot
or overwrite an unrelated handler. The catalog is empty while bot configuration
is absent; mock callbacks never grant a paid right.

Health/config/catalog are public; /v1/admin serves a key-entry form. Summary,
reconciliation and refunds require the admin Bearer. The key is not stored in the
browser. No credentials or player records should be placed in support logs.

The timer runs server/growth/deploy/backup.sh every15minutes. Verified online
copies are uploaded to the existing encrypted backup destination with a distinct
tag. Local pruning runs only after successful offsite backup, touches verified
owned directories only, retains two recovery points, and enforces count/age/size.
Review timer failures and disk usage. Restic forget only selects this game's tag;
remote block reclamation still requires normal restic prune/check maintenance.

On deployment failure, keep the databases and payment receipts. Roll back only
the service code/image to a compatible reviewed release, restore the prior Caddy
file if its validation fails, and reconcile incoming receipts before any database
restore. Never reset paid state to make a health check pass.

Full behavior, evidence and limits:
[Growth rollout](../../docs/reports/GROWTH_ROLLOUT.md).
