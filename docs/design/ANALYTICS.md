# Analytics events and privacy

Schema version 1. Analytics is an adapter around already completed game/session transitions. It never changes game state, stores progress, or blocks input.

## Collection and delivery

- The development collector is in memory only, retains the newest 250 events by default, and is exposed only through the development `gameDebug.snapshot()` surface.
- The production collector is disabled in `src/main.js`. `createAnalytics({ sink })` accepts an injected production sink for a future platform integration. Sink calls are fire-and-forget; thrown/rejected requests are ignored by gameplay.
- The app does not persist analytics, use cookies, send requests, or invent an analytics account/player identifier. `runId` and `flowId` are random, ephemeral correlation IDs for a run and FTUE flow. They do not survive a page visit.
- Event names and payload properties use strict allowlists. Challenge URL/payload, friend names, contact details, ad payloads, tokens, and arbitrary SDK response data are discarded.
- `rewarded_viewed` requires an explicit `verifiedCompletion: true` and a non-test provider. The standalone test grant has no completion-confirmation hook and emits no ad event.

## Event semantics

Every event includes `schemaVersion` and, when known, `runId`, `puzzleId`, `contentVersion`, `rulesVersion`, `mode`, and the current `assisted` flag. FTUE events also include `flowId`. Optional safe result fields are `outcome`, `score`, `movesUsed`, and `eligibleForChallenge`; a verified rewarded event may include provider name. No full URL is included.

| Event | Moment | Dedupe / notes |
| --- | --- | --- |
| `ftue_start` | A playable FTUE flow is entered (including resuming an unfinished lesson) | Once per in-memory flow; skips do not count as completion |
| `ftue_complete` | Fifth authored FTUE lesson wins | Once per run, linked to the FTUE `flowId` |
| `level_start` | A playable FTUE, campaign, daily, or challenge level starts/restarts | Once per run ID |
| `level_complete` | A run reaches a terminal win or loss after available booster continuation is resolved | Once per run ID; `outcome` disambiguates wins and losses |
| `retry` | Player explicitly resets or replays a level | One per restart action; terminal outcome is included when there was one |
| `challenge_created` | A valid share URL is successfully constructed | At most once per result run; no URL or challenger score payload |
| `share_clicked` | Player requests the native share/clipboard action | One per click, even if the platform later cancels or fails |
| `challenge_opened` | A valid challenge payload is parsed and the frozen puzzle loads | Once per opened page attempt; malformed/unsupported links do not count |
| `challenge_started` | Player starts that opened challenge | Once per attempt; reuses the open attempt's run ID |
| `challenge_completed` | A challenge reaches a terminal win or loss | Once per attempt; includes outcome and safe score fields |
| `rewarded_viewed` | A real ad provider explicitly confirms completed reward playback | Requires verified provider completion; never inferred from request, impression, fake/test grant, or callback error |

## Hypotheses and denominators

GDD v0.1's percentages remain research hypotheses, not product guarantees, acceptance checks, or current results. With a future approved, enabled analytics sink and a declared observation window:

- FTUE completion: distinct `flowId` values with `ftue_complete` / distinct `flowId` values with `ftue_start`; target >80%.
- First-session level completion: distinct eligible `level_start` run IDs for the selected first-session cohort with `level_complete outcome=win` / eligible starts; target >60%. No stable person identity currently exists, so this is a run cohort, not unique players.
- Retry after loss: distinct `retry` run IDs with `outcome=loss` / distinct `level_complete` run IDs with `outcome=loss`; target >35%.
- Challenge creation: distinct eligible successful result run IDs with `challenge_created` / distinct successful eligible result run IDs; target >10%.
- Challenge open-to-play: distinct `challenge_started` attempt IDs / distinct valid `challenge_opened` attempt IDs; target >35%.

These rates are unmeasured while the production sink is disabled. Any future collection requires choosing a provider and separately reviewing platform consent, retention, age/audience, and privacy requirements.
