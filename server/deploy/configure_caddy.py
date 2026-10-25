"""Pure, scoped Magnet Sort API route patch. Never installs a local old Caddyfile."""
import argparse
import hashlib
import pathlib

BEGIN = "    # BEGIN magnet-sort-leaderboards v1\n"
END = "    # END magnet-sort-leaderboards v1\n"
PREFIX = (BEGIN + "    handle /magnet-sort {\n"
          "        header Cache-Control \"no-store\"\n"
          "        respond 404\n"
          "    }\n" + "    handle_path /magnet-sort/* {\n"
         "        header Cache-Control \"no-store\"\n"
          )
BLOCK = PREFIX + "        reverse_proxy magnet-sort-leaderboards:8080\n    }\n" + END
MAINTENANCE = PREFIX + '        respond "Magnet Sort maintenance" 503\n    }\n' + END
API = "{$API_DOMAIN} {\n"
FALLBACK = "\treverse_proxy white-tower-help:8080\n"


def patch(source, remove=False, maintenance=False):
    # Recognize the existing host's exact API scope, failing closed on drift.
    if source.count(API) != 1:
        raise ValueError("Expected exactly one API domain scope")
    start = source.index(API) + len(API)
    # Top-level site closing line, not nested handle blocks or {$ENV} braces.
    end = source.find("\n}\n", start)
    if end < 0:
        raise ValueError("Unclosed API domain scope")
    scope = source[start:end + 1]
    if scope.count(FALLBACK) != 1:
        raise ValueError("Expected existing White Tower fallback")
    if BEGIN.strip() in source or END.strip() in source:
        owned = next((b for b in (BLOCK, MAINTENANCE) if scope.count(b) == 1), None)
        if not owned or source.count(BEGIN) != 1 or source.count(END) != 1:
            raise ValueError("Existing managed route differs; manual review required")
        scope = scope.replace(owned, "")
    if not remove:
        if "/magnet-sort" in scope:
            raise ValueError("Unmanaged Magnet Sort route already exists in API scope")
        scope = scope.replace(FALLBACK, (MAINTENANCE if maintenance else BLOCK) + FALLBACK)
    return source[:start] + scope + source[end + 1:]


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("source", type=pathlib.Path)
    p.add_argument("destination", type=pathlib.Path)
    p.add_argument("--expected-sha256", required=True)
    p.add_argument("--remove", action="store_true")
    p.add_argument("--maintenance", action="store_true")
    a = p.parse_args()
    raw = a.source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != a.expected_sha256:
        raise SystemExit("Caddy snapshot changed; reread the current remote config")
    result = patch(raw.decode("utf-8"), a.remove, a.maintenance).encode("utf-8")
    if a.destination.exists():
        raise SystemExit("Destination already exists; will not overwrite it")
    a.destination.write_bytes(result)
