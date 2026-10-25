# Weekly quests and magnet collection

Implemented 2026-10-25 in the monetization rollout worktree. Status: pure-model
implementation and unit checks complete; the separate UI component is implemented
and syntax-checked. Runtime integration, build/browser checks and independent
acceptance belong to the lead's final pass. No build, browser or physical-device
PASS is claimed by this report.

## Contract

`src/meta/progress.js` exports `createMetaProgress({storage, getStorage, now})`,
`utcWeek`, `EMBLEMS`, `FRAMES`, `WEEKLY_QUESTS` and storage/capacity constants.
The owner supplies committed terminal results; it must not call this for a hover,
preview or partially animated nonterminal board. The module does not change game
rules, RNG, campaign/daily saves, paid inventory or server leaderboards.

Owner methods:

- `snapshot()` returns `weekId`, `weekStartsAt`/`weekEndsAt` (UTC date strings),
  `quests`, `stamps`, `uniqueWins`, `emblems`, `selectedEmblem`, `frames`,
  `selectedFrame`, `status:{saved,reason,clockRollback}`. Snapshots never write
  localStorage or expose mutable persistent objects.
- `recordResult({mode,levelId,seed,date?,outcome,cleared,moves,assisted,attemptId?})`
  accepts campaign/daily, won/lost and a known level/uint32 seed. `attemptId` is
  optional and deliberately not the deduplication key. `daily` also validates its
  frozen catalog level/seed and only a won attempt pinned to today's UTC date.
- `claimQuest(id)` returns `{accepted,reward,questId,changed}` for an earned claim.
- `selectEmblem(id)` and `selectFrame(id)` select an unlocked local cosmetic.
- `grantBonusStamp({claimId})` grants one cosmetic stamp only for a recorded won
  board. Claim IDs are exactly `victory-stamp:<weekId>:campaign:<levelId>:<seed>`
  or `victory-stamp:<weekId>:daily:<date>`. The advertising owner must verify SDK
  completion before invoking this method; this local module is not ad verification.
  A completion just after week rollover can still reward the retained prior-week
  board. Claims remain globally deduplicated even when that weekly history expires.
- `canClaimBonusStamp({claimId})` is a read-only eligibility check for hiding
  rewarded buttons once consumed, without storage, or after a stale-tab conflict.
- `reload()` explicitly reloads the current record after a stale-tab conflict;
  `dispose()` disables mutations. Mutation failures return `{accepted:false,reason}`.

## Player-visible rules

UTC ISO weeks start Monday. The three quests give one cosmetic stamp each:
win three **different campaign levels**, collect 100 campaign chips, complete
today's Daily. Campaign collection counts the best-cleared value for each board
fingerprint that week, including terminal losses; improving that value contributes
only the difference. Different seeds of the same level do not fake three levels.
The same board can contribute once again in a later week, keeping weekly tasks
available after completing the finite campaign. Repeating it in the same week
does not farm progress. Help is allowed for these noncompetitive cosmetics.

The all-time magnet collection counts each campaign `levelId+seed` victory once;
Daily never inflates that count. Six existing magnet colors unlock at **1, 2, 3,
6, 9, 12 wins**. These replace the initial suggested 1/3/6/10/15/21 thresholds:
the actual v4 campaign has only 12 authored levels and Retry preserves the seed,
so the final two original thresholds were unreachable in ordinary campaign play.

Stamps are never spent or sold. Three unlock the Golden frame; six unlock the
Star frame. Both are obtainable from weekly quests without watching ads. A
rewarded ad may add one bonus stamp per week/board, through its stable claim ID.
These frames and stamps are separate from paid supporter cosmetics/entitlements.

## Persistence and limits

Only `magnet-sort.meta.v1` is written. Schema/version, numeric bounds, duplicate
keys, locked selections and inconsistent claims are validated. Eight weekly
records are retained; each has up to 256 board fingerprints. All-time collection
and bonus claims each retain up to 4096 fingerprints **without eviction**; new
entries at capacity are rejected rather than making an old board farmable again.
The save has a 512 KiB character limit.

When a mutation has seen a later UTC day, moving the device clock backward cannot
reopen an earlier week or award results/quest claims. Existing cosmetics remain
selectable. This is local clock-rollback protection, not server time or cheat
resistance. A jump far into the future requires correcting/resetting the local
cosmetic record; no automatic destructive recovery is performed.

Exact raw-value comparison detects ordinary stale-tab changes before writes.
localStorage has no compare-and-swap: simultaneous writers can still race. This
limitation is acceptable only because these are nonvaluable local cosmetics.
Storage denial, write failure, malformed/unsupported data and conflicts are
visible in status, preserve the existing record and do not crash gameplay.
On failed persistence the candidate state is not published as an earned reward.
The UI should offer explicit reload for `conflict`; it must not silently replace
corrupted data. This record is not proof of authentic gameplay or ownership.

## Verification

`node --test tests/meta-progress.test.js`: **19 tests passed** on 2026-10-25.
Tests cover UTC/ISO boundaries, no writes during snapshots, replay/reload dedupe,
weekly replay eligibility, lost/improved results, distinct levels, exactly-once
claims, existing save isolation, Daily date/catalog isolation, invalid events,
clock rollback, bounded history/capacities, stale tabs, denied/corrupt storage,
detached snapshots/disposal, ad-claim dedupe and cosmetic frame selection.

## UI component

`src/growth/GrowthPanel.js` exports `GrowthPanel({view,data,onClose,onConsent,
onClaimQuest,onSelectEmblem,onSelectFrame,onReloadMeta,onPurchase,onRestore})`
and imports its own `growth.css`. It does not import `App.js`, mutate shared UI
files or own the game state. `data` is the growth controller snapshot. Supported
views and exact accessible dialog names are `progress` / “Progress and rewards”,
`privacy` / “Privacy”, and `shop` / “Shop”.

The component has a fixed header/44px close button and independently scrolling
content, keyboard Tab containment, Escape close, and focus restoration. External
provider UI may take focus while a commerce operation is busy. Quests show progress
and once-only claim buttons; collection and frame choices expose locked, unlocked
and equipped states. Local-storage/conflict/clock status is visible, with an
explicit reload control for stale tabs.

Privacy explains optional gameplay events/random ID, 35-day retention, excluded
Telegram-profile/URL fields, revocation/deletion, and the separation from saves
and purchases. Unconfigured or disallowed analytics cannot be enabled from this
view. The shop shows supplied XTR product data, owned/pending/loading/unavailable
states, restore, and payment support. Titles/descriptions are Preact text children,
not inserted HTML. The component does not invent a purchasable product or price.

Existing cream/violet/gold identity and magnet art are reused. Buttons retain
44px minimum touch height; content reflows for narrow and short viewports. The
stylesheet applies `data-growth-frame=gold|stars` and `data-growth-aurora=true` to
the surrounding logo/emblem identity without changing puzzle colors. The lead
owns mounting the equipped emblem and root attributes.

`node --check src/growth/GrowthPanel.js` and `git diff --check` passed 2026-10-25.
UI layout, actual input paths and screenshots are awaiting the consolidated
browser pass, rather than being inferred from CSS or syntax checks.
