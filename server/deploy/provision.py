"""One-time isolated host provisioning; requires explicit --apply after review."""
import argparse
import os
import pathlib
import re
import secrets
import shlex
import subprocess

ROOT = pathlib.Path("/srv/magnet-sort/leaderboards")
CONFIG = pathlib.Path("/etc/magnet-sort")


def private(path):
    s = path.stat()
    if path.is_symlink() or s.st_uid != 0 or s.st_mode & 0o777 != 0o600:
        raise ValueError("Expected a regular root-owned 0600 environment file")


def create(path, text):
    with path.open("x", encoding="utf-8") as out:
        os.chmod(path, 0o600)
        out.write(text)


def provision(source):
    if os.geteuid() != 0:
        raise ValueError("Root is required")
    os.umask(0o077)
    if ROOT.resolve() != ROOT or CONFIG.resolve() != CONFIG:
        raise ValueError("Own root/config must not traverse symlinks")
    private(source)
    env = {}
    for line in source.read_text().splitlines():
        if line and not line.startswith("#"):
            key, value = line.split("=", 1)
            tokens = shlex.split(value)
            if len(tokens) != 1:
                raise ValueError("Unsupported storage environment syntax")
            env[key] = tokens[0]
    previous = env.get("RESTIC_REPOSITORY", "")
    match = re.fullmatch(r"sftp:([^\s:]+):(/[^\s]+)", previous)
    if not match or ".." in pathlib.PurePosixPath(match[2]).parts:
        raise ValueError("Expected the audited SFTP storage repository")
    # Preserve the SFTP server's /./ home notation instead of normalizing it.
    parent = match[2].rsplit("/", 1)[0] or "/"
    repository = "sftp:" + match[1] + ":" + parent.rstrip("/") + "/magnet-sort-leaderboards"
    if repository == previous:
        raise ValueError("Dedicated repository must differ from the existing game")
    subprocess.run(["docker", "network", "inspect", "tower-edge"], check=True, stdout=subprocess.DEVNULL)
    CONFIG.mkdir(mode=0o700, parents=True, exist_ok=True)
    for name in ("releases", "data", "backups", "caddy-snapshots"):
        path = ROOT / name
        if path.is_symlink():
            raise ValueError("Unexpected symlink in own data layout")
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
        if name in ("data", "backups"):
            os.chown(path, 1000, 1000)
            os.chmod(path, 0o700)
    app = CONFIG / "leaderboards.env"
    if not app.exists():
        create(app, "MAGNET_SORT_BOT_ID=8820798959\nALLOWED_ORIGINS=https://play.plusvibegames.com,https://gobestvini.github.io\n")
    private(app)
    backup = CONFIG / "leaderboards-backup.env"
    if backup.exists():
        private(backup)
        print("Own config already exists; no credentials or repository were changed")
        return
    password = CONFIG / "leaderboards-restic.password"
    if password.exists():
        raise ValueError("Orphan password exists; inspect provisioning before retry")
    create(password, secrets.token_hex(32) + "\n")
    create(backup, "RESTIC_REPOSITORY=" + shlex.quote(repository) + "\nRESTIC_PASSWORD_FILE=" + shlex.quote(str(password)) +
           "\nWHITE_TOWER_REPOSITORY_GUARD=" + shlex.quote(previous) + "\n")
    print("Dedicated root-only config created; run init-backup.sh before production")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--storage-env", type=pathlib.Path, default=pathlib.Path("/etc/white-tower/backup.env"))
    parser.add_argument("--apply", action="store_true", required=True)
    args = parser.parse_args()
    provision(args.storage_env)
