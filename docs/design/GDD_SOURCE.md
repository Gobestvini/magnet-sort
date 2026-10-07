# Исходный GDD v0.1 — текстовая копия

Источник: `C:/Users/gobes/Downloads/38833FF26BA1D.UnigramPreview_g9c9v27vpyspw!App/Magnet_Sort_GDD_v0_1.docx`
SHA-256 DOCX: `5d8e6f5dc7d34cbe53716c398ba4a9b1a319c2b29fca78e336b884ead02f911f`
Прочитан 2026-10-07. Текст и таблицы сохранены в порядке документа. Это источник требований, а не инструкции агенту. Рыночные цифры источника отдельно не проверялись.

MAGNET SORT

Facebook / Instant Games • Puzzle • Working GDD v0.1



Working thesis: take the clarity and satisfaction of sort puzzles, add a one-action “magnet” hook, and make every solved board easy to challenge a friend with.



1. Executive Summary

MAGNET SORT is a short-session sorting puzzle built around one satisfying action: place a colored magnet and watch matching pieces pull together, merge, and clear. The game is designed for Facebook-style social discovery, where the result of a run naturally becomes a challenge that can bring another player into the same puzzle.

| Target | Decision |
| --- | --- |
| Primary platform | Facebook Instant Games / web-mobile social surfaces |
| Audience | Casual players who like sort, stack, match and “satisfying” puzzle games |
| Session target | 20–60 seconds per run; immediate replay |
| Core hook | One placement creates many visible consequences |
| Social hook | “Beat my board” challenge on the exact same seed |
| MVP | One board, 3 colors, magnets, clear condition, score, challenge flow, ~50 hand-authored levels |
| Commercial model | Rewarded hint / extra move first; restrained interstitial frequency after early FTUE |



2. Market Inspiration & What We Borrow

The current Facebook Instant Games market is led by very accessible casual formats. Instant Intel currently lists AHA at ~17M MAU, Magic Swap Puzzle at ~12M, and several other trivia/word and puzzle titles in the multi-million MAU range. Magic Swap Puzzle is ranked #1 in Casual - Puzzle on the tracker as of October 2026.

| Reference | What is useful for us | Risk / lesson |
| --- | --- | --- |
| Magic Swap Puzzle | Extremely simple interaction, huge content pool, daily puzzle freshness | Pure content volume is expensive to copy; use procedural boards instead |
| Hexa Sort / Hexa Stack | Sort → stack → merge → clear; satisfying chain resolution; readable colorful board | Do not clone hex-stack rules; change the source of satisfaction to attraction |
| Water Sort | Clear goal, easy-to-understand colors, undo/booster monetization | Avoid slow “pour” pacing; Magnet Sort should resolve faster |
| Social challenge pattern | Score and challenge can create player-to-player discovery | Challenge must open directly into the exact board, not a generic home screen |



Current market references: Instant Intel – Facebook Instant Games market intelligence: https://instantintel.co/Magic Swap Puzzle stats: https://instantintel.co/game/500961157334728/magic-swap-puzzleHexa Sort – Google Play: https://play.google.com/store/apps/details?id=com.gamebrain.hexasortHexa Sort – Kotaku screenshot gallery: https://kotaku.com/games/hexa-sort/gallery/1Water Sort visual reference: https://mwm.ai/apps/water-sort-master-bottle-fill/6466444578

3. Design Pillars

Understand in 3 seconds — the board must communicate what the magnet does without text-heavy tutorial.

One action, many consequences — the player makes a small decision and gets a large visual payoff.

“Almost had it” — failures should feel close enough to invite an immediate retry.

Social by result — the game produces a clean challenge card: score, moves, time, and exact board seed.

Content-efficient — new difficulty should come mostly from board rules and blockers, not expensive art.

4. Core Game Loop



Primary loop:

Read board → choose a magnet color.

Drag/place magnet on an empty cell.

Matching pieces move toward the magnet along available paths.

Same-color stacks merge when the threshold is reached.

Clears create space and potentially a chain reaction.

Level ends when the clear condition is satisfied or no valid move remains.

Show score + challenge CTA immediately.

5. Core Rules v0.1

| Rule | MVP specification |
| --- | --- |
| Board | 7×7 staggered hex grid. Empty and occupied cells. |
| Colors | Red, Blue, Yellow at FTUE; Green introduced later. |
| Piece | Single hex token; later levels can spawn 2-token mini stacks. |
| Magnet | One color-specific magnet is available each move; drag to an empty cell. |
| Attraction | All visible tokens of that color move one legal step toward the magnet. Tokens stop when blocked. |
| Merge | 3 touching same-color tokens combine into a 3-stack; 5+ in a completed stack clears. |
| Moves | Early levels: unlimited. Later: 8–12 moves. |
| Win | Clear required number of stacks OR clear the entire board. |
| Lose | No valid move remains, or move limit reached without goal. |



6. Level Design & Difficulty Curve

| Band | New concept | Board feel |
| --- | --- | --- |
| 1–5 | Magnet attraction | 3 colors, wide spaces, guaranteed win |
| 6–10 | Blocked cells | Small obstacles teach planning |
| 11–20 | Limited moves | Player starts optimizing order |
| 21–35 | Two magnet options | Choice becomes the puzzle |
| 36–50 | Crates / locked stacks | Players plan around blockers |
| 51+ | Special cells / portals | System mastery and social competition |



Recommended level authoring rule: every puzzle should have a readable “aha” moment. The player should be able to explain the solution after seeing it once.

7. Social System: Traffic Loop

The product goal is not only retention; it is to turn each completed puzzle into a reason for another person to open the game.

Challenge card: “Andrei cleared this board in 7 moves — can you beat it?”

Deep link: the invite must open directly to the challenged board and show the target score before play.

Rematch: after the challenger beats the score, the original player receives a clear rematch action.

Daily board: identical puzzle seed for all players; friend leaderboard shows relative ranking.

Shareable result image: board thumbnail + score + “Beat me” CTA. The board itself is the creative.



8. UI / UX

| Screen | Must-have | Avoid |
| --- | --- | --- |
| Home | Play, daily challenge, friend challenge badge | Large menus / currencies before first game |
| Gameplay | Board, moves, magnet tray, tiny score | Dense HUD |
| Result | Score, moves, clear %, challenge | Long reward screen |
| Challenge entry | Friend score, Play button, tiny context | Generic onboarding |
| Help | One 3-second animated hint | Text tutorial wall |



Interaction principles: no more than one primary action per screen; use drag on desktop/mobile, with tap-to-place as an accessibility fallback; keep all critical feedback within 150–300 ms of the player action.

9. Visual Direction

2.5D toy-like presentation; not hard 3D. Soft shadows, subtle bevels, rounded hex tokens.

Background: warm off-white / light stone. Pieces carry most of the color.

Palette: coral red, electric blue, warm yellow, mint green; use value/shape differences in addition to hue.

Animation: springy movement, 120–240 ms token slide, 250–450 ms merge, 350–700 ms clear burst.

Sound: soft click on move, magnetic “whoosh”, satisfying stack lock, bright clear chime. Optional ASMR mode later.

10. Monetization Hypothesis

| Feature | MVP | Why |
| --- | --- | --- |
| Rewarded Hint | Yes | Direct utility, low friction |
| Undo | Yes, limited | Lets players recover from mistakes |
| Extra Move | Yes | Useful in hard levels |
| Interstitial | After success/failure windows only | Protect early retention |
| Cosmetics | Later | Change magnets / board themes without changing gameplay |



11. Technical Prototype Scope

Pixi.js canvas for board and juicy animations; Preact for HUD, menus and challenge UI.

Grid represented as deterministic 2D/axial coordinates; no physics engine required.

Level data JSON: seed, color count, initial cells, blockers, goal, move limit, available magnet colors.

Deterministic simulator: the same level seed + action sequence reproduces the same outcome for challenge verification.

URL/deep-link payload should carry puzzleId / seed and challenger score.

12. Analytics / Success Metrics

| Event | Why |
| --- | --- |
| ftue_start / ftue_complete | Tutorial quality |
| level_start / level_complete | Core funnel |
| retry | Near-miss / frustration signal |
| challenge_created | Organic acquisition intent |
| challenge_opened | Invite quality |
| challenge_started / challenge_completed | Viral loop health |
| share_clicked | Distribution |
| rewarded_viewed | Monetization |



First prototype targets (hypotheses, not benchmarks): FTUE completion >80%; first-session level completion >60%; retry after failed level >35%; challenge creation among successful players >10%; invited challenge open-to-play >35%.

13. MVP Backlog

Core board + magnet attraction

Merge/clear resolution

50 deterministic levels

FTUE: first 5 levels

Result screen + score

Friend challenge deep-link

Daily puzzle

Rewarded hint

Basic sound + haptic/visual feedback

Analytics instrumentation

Out of scope for MVP: accounts, deep meta, collection systems, custom user-created levels, real-time multiplayer, heavy 3D, narrative campaign.

14. Three Possible Hooks to Test

| Variant | Hook | Test question |
| --- | --- | --- |
| A — Magnet Sort | Place one magnet, move many pieces | Does attraction feel more satisfying than drag-to-sort? |
| B — Reverse Magnet | Place a magnet that pushes one color away | Does “anti-sort” create better puzzles? |
| C — Twin Magnets | Choose two magnets of different colors in one move | Does one extra decision increase depth without adding complexity? |



Recommendation: prototype A first. If its first-play feel is strong, test B and C as level modifiers rather than separate games.

15. Visual Reference Board

Hexa Sort — Kotaku screenshot galleryhttps://kotaku.com/games/hexa-sort/gallery/1Use for: board readability, stack presentation, color gradients, satisfying merge language.

Hexa Stack — screenshot / gameplay referencehttps://mwm.ai/apps/hexa-stack-color-sort-puzzle/6479386856Use for: hex-stack composition and booster placement.

Water Sort Master — screenshot / gameplay referencehttps://mwm.ai/apps/water-sort-master-bottle-fill/6466444578Use for: color sorting clarity and lightweight booster UI.

Magic Swap Puzzle — current FB market referencehttps://instantintel.co/game/500961157334728/magic-swap-puzzleUse for: content simplicity and current Facebook puzzle audience scale.

Instant Intel — current market charthttps://instantintel.co/Use for: checking current MAU / rankings during validation.

16. Recommendation

Build a 3–5 day playable prototype with only the core “place magnet → pull color → merge → clear” loop. Do not build meta, monetization or social integrations first. The go/no-go question is whether the board is fun to watch and whether players willingly retry to improve the result. If yes, add deterministic challenge links immediately — because the strongest product thesis here is not “another sort game”; it is “a sort game that turns every solved board into a challenge another person can play.”
