import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from configure_caddy import patch, BLOCK, MAINTENANCE

SOURCE = '''{$GAME_DOMAIN} {
    handle_path /magnet-sort/* {
        root * /srv/static/magnet-sort/current
        file_server
    }
}
{$API_DOMAIN} {
    handle_path /carwars/* {
        reverse_proxy carwars-multiplayer:2577
    }
    handle_path /test/* {
        reverse_proxy white-tower-help-test:8080
    }
\treverse_proxy white-tower-help:8080
}
'''


class ScopedRouteTest(unittest.TestCase):
    def test_roundtrip_and_idempotence(self):
        result = patch(SOURCE)
        self.assertEqual(patch(result), result)
        self.assertEqual(patch(result, remove=True), SOURCE)
        self.assertEqual(result.replace(BLOCK, ""), SOURCE)
        self.assertLess(result.index(BLOCK), result.index("\treverse_proxy white-tower-help:8080"))

    def test_only_api_route_enters_maintenance_and_returns(self):
        active = patch(SOURCE)
        maintenance = patch(active, maintenance=True)
        self.assertEqual(maintenance.replace(MAINTENANCE, ""), SOURCE)
        self.assertEqual(patch(maintenance), active)
        self.assertEqual(patch(maintenance, remove=True), SOURCE)
        self.assertIn('handle /magnet-sort {', active)

    def test_rejects_domain_fallback_and_managed_route_drift(self):
        for source in (SOURCE.replace("{$API_DOMAIN}", "api.changed.example"),
                       SOURCE.replace("\treverse_proxy white-tower-help:8080\n", ""),
                       SOURCE + SOURCE,
                       patch(SOURCE).replace("magnet-sort-leaderboards:8080", "different:8080"),
                       SOURCE.replace("\treverse_proxy white-tower-help:8080", "    handle /magnet-sort { respond 404 }\n\treverse_proxy white-tower-help:8080")):
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    patch(source)


if __name__ == "__main__":
    unittest.main()
