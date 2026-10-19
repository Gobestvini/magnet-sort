# Telegram publication

Mini App URL: **https://play.plusvibegames.com/magnet-sort/telegram/**

Backup: https://gobestvini.github.io/magnet-sort/telegram/ . Opening this Telegram
artifact in an ordinary browser shows launch guidance.

Game bot: **[@MagnetSortPuzzleBot](https://t.me/MagnetSortPuzzleBot)**, display name
**Magnet Sort**. Main Mini App: **https://t.me/MagnetSortPuzzleBot?startapp**.
The owner created this separate game bot on 2026-10-19. BotFather accepted the
Mini App URL above; getMe reports has_main_web_app=true and the profile shows
OPEN APP. The default Play menu, description and About were applied and read
back through Bot API. No bot credential was written to disk, repository or client.

Real Telegram Web acceptance, 2026-10-19: authorized account, official live bridge
(weba 9.6), profile OPEN APP → published game → legal first placement → MOVES 1,
Pause dialog → Resume. No bridge mock or injected launch data was used. The
owner confirmed acceptance of Telegram Mini Apps terms before the first launch.
This is browser Telegram evidence, not native Desktop or a physical phone. Local
proof: ignored `artifacts/bot-setup/telegram-web-play.png` and verified-status.json;
neither includes a token. Phone/native acceptance below remains outstanding.

Setup/recovery instructions are retained below. White Tower's bot and this
repository's private developer-agent bot must not be used for players of this game.

1. Open official [BotFather](https://t.me/BotFather), send `/newbot`.
2. Existing name: `Magnet Sort`, username: `MagnetSortPuzzleBot`. Do not create
   another bot for the existing release; select it in `/mybots` for changes.
3. Keep the token locally; do not send it to chat or embed it in the game.
4. `/mybots` → select the bot → Bot Settings → Configure Mini App / Main Mini App
   → enable and enter the Mini App URL above.
5. `/setmenubutton` → same bot → same URL → text `Play`.
6. Suggested description: `Place magnets, pull matching colors and collect the
   goal. A colorful puzzle by Plus Vibe.` About: `Magnet Sort — a colorful magnet
   puzzle by Plus Vibe.` New artwork is optional for initial launch.
7. Open the profile's app button and Play menu. Once Main Mini App is enabled,
   its main link is `https://t.me/YOUR_REGISTERED_BOT?startapp`.

Optional API helper: copy `telegram.env.example` to ignored `.env.telegram-game`
in the project root and enter the **game bot** token locally. Substitute its
actual username:

```powershell
node --env-file=.env.telegram-game tools/platforms/telegram-setup.mjs --username YOUR_REGISTERED_BOT --url https://play.plusvibegames.com/magnet-sort/telegram/ --mode check
node --env-file=.env.telegram-game tools/platforms/telegram-setup.mjs --username YOUR_REGISTERED_BOT --url https://play.plusvibegames.com/magnet-sort/telegram/ --mode apply
```

Check is read-only. Apply verifies getMe username, changes only the default menu,
reads back the result and does nothing on repeated matching calls. Errors redact
tokens/API URLs. It cannot enable Main Mini App. No polling/webhook/server or
player messaging is introduced.

The adapter bounds bridge waiting to 10 seconds, expands, waits for the playable
reveal and sends ready once. Version 8+ activity events preserve user pause;
older versions retain document visibility/blur handling. Stable viewport and the
union of device/content/browser safe margins protect HUD and popups. Listeners,
pending wait and CSS changes have cleanup. initData is only an opaque launch UX
gate: no parsing, persistence, forwarding or account authentication.

Further acceptance needs Telegram Desktop and a physical touch phone:
profile/menu launches, loading, move/win/next/retry, pause, minimize during a move,
resume, portrait/landscape, reopening. Record device/OS/Telegram version. Current
v4 has no durable campaign saves; no save support is implied by this integration.

Official references checked 2026-10-19:
[Mini App launch, viewport/activity API](https://core.telegram.org/bots/webapps),
[menu button API](https://core.telegram.org/bots/api#setchatmenubutton).
