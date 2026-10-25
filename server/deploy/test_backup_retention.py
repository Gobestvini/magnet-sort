import pathlib
import tempfile
import unittest
import sys
import os
import shutil
import subprocess

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from prune_backups import prune


class BackupRetentionTest(unittest.TestCase):
    def test_interrupted_snapshot_temporary_files_are_removed_only_in_own_namespace(self):
        with tempfile.TemporaryDirectory(prefix='magnet-backup-partial-') as directory:
            root = pathlib.Path(directory)
            partial = 'leaderboards-20260101T000000Z.sqlite.12345678-abcd-1234-abcd-123456789012.tmp'
            for suffix in ['', '-wal', '-shm', '-journal']:
                (root / (partial + suffix)).write_bytes(b'partial')
            for name in ['predeploy-operator.sqlite.tmp', 'leaderboards-operator.sqlite.tmp', 'leaderboards-20260101T000000Z.sqlite']:
                (root / name).write_bytes(b'preserve')
            prune(root)
            self.assertFalse(list(root.glob('*.tmp-*')))
            self.assertFalse((root / partial).exists())
            self.assertEqual(len(list(root.iterdir())), 3)

    @unittest.skipIf(os.name == 'nt', 'Exercises the Linux service shell on the native deployment host')
    def test_real_shell_exit_trap_prunes_after_failed_restic(self):
        with tempfile.TemporaryDirectory(prefix='magnet-backup-service-') as directory:
            root = pathlib.Path(directory)
            service = root / 'service'
            backups = root / 'owned' / 'backups'
            service.mkdir()
            backups.mkdir(parents=True)
            for number in range(1, 12):
                (backups / f'leaderboards-202601{number:02}T000000Z.sqlite').write_bytes(b'old')
            success = backups / 'last-success.json'
            success.write_text('{"completedAt":1}')
            scripts = pathlib.Path(__file__).parent
            for name in ['backup.sh', 'prune_backups.py']:
                shutil.copyfile(scripts / name, service / name)
            backup_script = service / 'backup.sh'
            backup_script.write_text(backup_script.read_text().replace('/run/lock/magnet-sort-leaderboards-backup.lock', str(root / 'test.lock')))
            (service / 'common.sh').write_text('''ROOT=$MOCK_OWN_ROOT
require_root() { :; }
load_backup() { :; }
current_release() { printf '%s' "$MOCK_OWN_ROOT"; }
compose() {
  case "$*" in
    *backup.mjs*) destination="${@: -1}"; printf verified > "$ROOT/backups/${destination##*/}";;
  esac
}
''')
            binary = root / 'bin'
            binary.mkdir()
            for name, code in [('docker', 0), ('restic', 1)]:
                program = binary / name
                program.write_text(f'#!/bin/sh\nexit {code}\n')
                program.chmod(0o755)
            env = dict(os.environ, MOCK_OWN_ROOT=str(root / 'owned'), PATH=str(binary) + ':' + os.environ['PATH'])
            result = subprocess.run(['bash', str(service / 'backup.sh'), '--bounded'], env=env, capture_output=True, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(len(list(backups.glob('leaderboards-*.sqlite'))), 8)
            self.assertEqual(success.read_text(), '{"completedAt":1}')

    def test_repeated_failed_uploads_stay_bounded_and_do_not_mark_success(self):
        with tempfile.TemporaryDirectory(prefix='magnet-backup-retention-') as directory:
            root = pathlib.Path(directory)
            success = root / 'last-success.json'
            success.write_text('{"completedAt":1}')
            original = root / 'predeploy-operator.sqlite'
            original.write_bytes(b'preserve')
            for number in range(1, 21):
                (root / f'leaderboards-202601{number:02}T000000Z.sqlite').write_bytes(b'verified')
                # EXIT cleanup also runs when restic upload/prune returned failure.
                prune(root)
                self.assertLessEqual(len(list(root.glob('leaderboards-*.sqlite'))), 8)
            self.assertEqual(len(list(root.glob('leaderboards-*.sqlite'))), 8)
            self.assertEqual(success.read_text(), '{"completedAt":1}')
            self.assertEqual(original.read_bytes(), b'preserve')
            self.assertTrue((root / 'leaderboards-20260120T000000Z.sqlite').exists())


if __name__ == '__main__':
    unittest.main()
