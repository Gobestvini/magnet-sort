"""Add only the Magnet Sort route to the existing shared Caddy config."""
import pathlib
import sys

target = pathlib.Path(sys.argv[1])
source = target.read_text()
marker = '# Magnet Sort static game'
route = '''
    # Magnet Sort static game
    redir /magnet-sort /magnet-sort/ 308
    handle_path /magnet-sort/* {
        root * /srv/static/magnet-sort/current
        header Cache-Control "no-cache"
        @magnet_assets path /assets/*
        root @magnet_assets /srv/static/magnet-sort/shared
        header @magnet_assets Cache-Control "public, max-age=31536000, immutable"
        file_server
    }
'''
if marker in source:
    print('Magnet Sort route already configured')
else:
    anchor = '{$GAME_DOMAIN} {\n'
    if source.count(anchor) != 1:
        raise SystemExit('Expected exactly one existing game domain block')
    target.write_text(source.replace(anchor, anchor + route, 1))
    print('Magnet Sort route added; validate and reload Caddy before serving')
