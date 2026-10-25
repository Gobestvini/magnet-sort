import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from provision import derive_repository


class RepositoryIsolationTest(unittest.TestCase):
    def test_relative_path_keeps_its_parent_and_home_semantics(self):
        self.assertEqual(derive_repository('sftp:fixture-storage:restic/white-tower'), 'sftp:fixture-storage:restic/magnet-sort-leaderboards')
        self.assertEqual(derive_repository('sftp:user@fixture.invalid:white-tower'), 'sftp:user@fixture.invalid:magnet-sort-leaderboards')

    def test_absolute_and_explicit_home_paths_are_preserved(self):
        for before, after in [('/backups/white-tower', '/backups/magnet-sort-leaderboards'),
                              ('/./backups/white-tower', '/./backups/magnet-sort-leaderboards'),
                              ('/white-tower', '/magnet-sort-leaderboards'),
                              ('./backups/white-tower', './backups/magnet-sort-leaderboards')]:
            self.assertEqual(derive_repository('sftp:fixture:' + before), 'sftp:fixture:' + after)

    def test_existing_repository_is_never_reused_or_escaped(self):
        for value in ['sftp:fixture:restic/magnet-sort-leaderboards', 'sftp:fixture:../white-tower',
                      'sftp:fixture:restic/../white-tower', 'sftp:fixture:restic/white-tower/',
                      'sftp:fixture:~/white-tower', 'sftp://fixture:22/white-tower',
                      's3:fixture:restic/white-tower', 'sftp:fixture:restic/white tower',
                      'sftp:fixture:.', 'sftp:fixture:/.']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                derive_repository(value)


if __name__ == '__main__':
    unittest.main()
