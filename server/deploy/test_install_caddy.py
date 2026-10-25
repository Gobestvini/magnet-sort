import hashlib
import pathlib
import sys
import tempfile
import types
import unittest
from unittest import mock

# Windows can run the byte/CAS regression; Linux additionally uses real flock.
try:
    import fcntl
except ImportError:
    sys.modules['fcntl'] = types.SimpleNamespace(LOCK_EX=2, flock=lambda *_: None)

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import install_caddy
from test_deploy import SOURCE


class CaddyRollbackTest(unittest.TestCase):
    def run_install(self, on_reload):
        with tempfile.TemporaryDirectory(prefix='magnet-caddy-cas-') as directory:
            root = pathlib.Path(directory)
            target = root / 'Caddyfile'
            original = SOURCE.encode()
            target.write_bytes(original)
            calls = []

            def caddy(_container, command, raw):
                calls.append((command, raw))
                if command == 'reload':
                    on_reload(target, raw, original)

            with mock.patch.object(install_caddy.os, 'geteuid', return_value=0, create=True), \
                 mock.patch.object(install_caddy, 'SNAPSHOT_DIRECTORY', root / 'snapshots'), \
                 mock.patch.object(install_caddy, 'caddy', side_effect=caddy):
                with self.assertRaises(RuntimeError):
                    install_caddy.install(target, 'owned-caddy', hashlib.sha256(original).hexdigest())
            return target.read_bytes(), calls

    def test_reload_failure_does_not_overwrite_a_concurrent_edit(self):
        external = SOURCE.replace('carwars-multiplayer:2577', 'new-carwars:2577').encode()

        def failing_reload(target, _candidate, _original):
            target.write_bytes(external)
            raise RuntimeError('simulated reload failure')

        final, calls = self.run_install(failing_reload)
        self.assertEqual(final, external)
        self.assertEqual([name for name, _ in calls], ['validate', 'reload'])

    def test_reload_failure_restores_only_the_unchanged_owned_candidate(self):
        def failing_reload(_target, candidate, original):
            if candidate != original:
                raise RuntimeError('simulated reload failure')

        final, calls = self.run_install(failing_reload)
        self.assertEqual(final, SOURCE.encode())
        self.assertEqual([name for name, _ in calls], ['validate', 'reload', 'reload'])


if __name__ == '__main__':
    unittest.main()
