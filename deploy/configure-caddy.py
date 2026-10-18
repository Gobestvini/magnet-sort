"""Add only the Magnet Sort route to the existing shared Caddy config."""
import pathlib
import re
import sys

target = pathlib.Path(sys.argv[1])
source = target.read_text()
marker = '# Magnet Sort static game'
route = '''
    # Magnet Sort static game
    redir /magnet-sort /magnet-sort/ 308
    handle_path /magnet-sort/* {
        @magnet_assets path /assets/*
        @magnet_fresh not path /assets/*
        root @magnet_fresh /srv/static/magnet-sort/current
        root @magnet_assets /srv/static/magnet-sort/shared
        header @magnet_fresh Cache-Control "no-cache"
        header @magnet_assets Cache-Control "public, max-age=31536000, immutable"
        file_server
    }
    # End Magnet Sort static game
'''
if marker in source:
    if source.count(marker) != 1:
        raise SystemExit('Expected exactly one existing Magnet Sort route')
    updated, count = re.subn(r'\n    # Magnet Sort static game\n.*?\n    }\n(?:    # End Magnet Sort static game\n)?', route, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit('Existing Magnet Sort route has an unexpected structure')
    target.write_text(updated)
    print('Magnet Sort route updated; validate and reload Caddy')
else:
    anchor = '{$GAME_DOMAIN} {\n'
    if source.count(anchor) != 1:
        raise SystemExit('Expected exactly one existing game domain block')
    target.write_text(source.replace(anchor, anchor + route, 1))
    print('Magnet Sort route added; validate and reload Caddy before serving')
