"""Bound only scheduled snapshots, including when offsite upload fails."""
import argparse
import pathlib
import re

NAME = re.compile(r'leaderboards-\d{8}T\d{6}Z\.sqlite\Z')
PARTIAL = re.compile(r'leaderboards-\d{8}T\d{6}Z\.sqlite\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp(?:-(?:wal|shm|journal))?\Z')
SIDECAR = re.compile(r'leaderboards-\d{8}T\d{6}Z\.sqlite-(?:wal|shm|journal)\Z')


def prune(directory, keep=8):
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('A real own backup directory is required')
    # Caller holds the own backup lock and has stopped its maintenance job.
    # These files cannot be a live source DB; only interrupted snapshot output.
    for item in directory.iterdir():
        if (PARTIAL.fullmatch(item.name) or SIDECAR.fullmatch(item.name)) and not item.is_symlink() and item.is_file():
            item.unlink()
    snapshots = sorted((p for p in directory.iterdir()
                        if NAME.fullmatch(p.name) and not p.is_symlink() and p.is_file()),
                       key=lambda p: (p.stat().st_mtime_ns, p.name), reverse=True)
    for snapshot in snapshots[keep:]:
        snapshot.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=pathlib.Path)
    args = parser.parse_args()
    prune(args.directory)
