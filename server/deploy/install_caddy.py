"""Validate/CAS/install one route, preserving the live regular-file bind inode."""
import argparse
import fcntl
import hashlib
import os
import pathlib
import subprocess
import time
from configure_caddy import patch

SNAPSHOT_DIRECTORY = pathlib.Path('/srv/magnet-sort/leaderboards/caddy-snapshots')


def caddy(container, command, raw):
    # /dev/stdin supplies exactly the candidate bytes; container env owns {$API_DOMAIN}.
    result = subprocess.run(["docker", "exec", "-i", container, "caddy", command,
                             "--config", "/dev/stdin", "--adapter", "caddyfile"],
                            input=raw, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=30)
    if result.returncode:
        # Do not emit rendered config or environment from Caddy diagnostics.
        raise RuntimeError("Caddy " + command + " failed; protected operator diagnostics required")


def install(path, container, expected, remove=False, maintenance=False):
    if os.geteuid() != 0 or path.is_symlink() or not path.is_file():
        raise ValueError("Root and the actual regular mounted Caddyfile are required")
    snapshot_dir = SNAPSHOT_DIRECTORY
    snapshot_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with path.open("r+b") as target:
        fcntl.flock(target, fcntl.LOCK_EX)
        original = target.read()
        if hashlib.sha256(original).hexdigest() != expected:
            raise ValueError("Caddy changed since preflight; stop and reread")
        candidate = patch(original.decode("utf-8"), remove, maintenance).encode("utf-8")
        if candidate == original:
            print("Caddy route already matches")
            return
        caddy(container, "validate", candidate)
        target.seek(0)
        if target.read() != original or path.stat().st_ino != os.fstat(target.fileno()).st_ino:
            raise ValueError("Concurrent Caddy change detected; no write performed")
        snap = snapshot_dir / (str(time.time_ns()) + ".Caddyfile")
        with snap.open("xb") as backup:
            os.chmod(snap, 0o600)
            backup.write(original)
        try:
            target.seek(0)
            target.write(candidate)
            target.truncate()
            target.flush()
            os.fsync(target.fileno())
            caddy(container, "reload", candidate)
        except BaseException as failure:
            # A different publisher can replace or edit the shared file while
            # reload is running. Never restore our snapshot over its changes.
            current = path.lstat()
            opened = os.fstat(target.fileno())
            target.seek(0)
            if path.is_symlink() or (current.st_dev, current.st_ino) != (opened.st_dev, opened.st_ino) or target.read() != candidate:
                raise RuntimeError('Concurrent Caddy change during reload; rollback skipped') from failure
            target.seek(0)
            target.write(original)
            target.truncate()
            target.flush()
            os.fsync(target.fileno())
            caddy(container, "reload", original)
            raise
    print("Scoped Caddy route installed; other routes preserved")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("path", type=pathlib.Path)
    p.add_argument("container")
    p.add_argument("expected_sha256")
    p.add_argument("--remove", action="store_true")
    p.add_argument("--maintenance", action="store_true")
    a = p.parse_args()
    install(a.path, a.container, a.expected_sha256, a.remove, a.maintenance)
