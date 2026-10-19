# Telegram publication

Mini App URL: **https://play.plusvibegames.com/magnet-sort/telegram/**

Backup: https://gobestvini.github.io/magnet-sort/telegram/ . Opening this Telegram
artifact in an ordinary browser shows launch guidance.

On 2026-10-19 the owner confirmed the Magnet Sort game bot does not exist yet.
There is no verified t.me launch link. Use a separate game bot; White Tower's bot
and this repository's private developer-agent bot are not player bots for this game.

1. Open official [BotFather](https://t.me/BotFather), send `/newbot`.
2. Name: `Magnet Sort`. Suggested username: `MagnetSortPuzzleBot`; availability
   is confirmed by BotFather. Choose another if occupied.
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

After bot creation, acceptance needs Telegram Desktop and a physical touch phone:
profile/menu launches, loading, move/win/next/retry, pause, minimize during a move,
resume, portrait/landscape, reopening. Record device/OS/Telegram version. Current
v4 has no durable campaign saves; no save support is implied by this integration.

Official references checked 2026-10-19:
[Mini App launch, viewport/activity API](https://core.telegram.org/bots/webapps),
[menu button API](https://core.telegram.org/bots/api#setchatmenubutton).
