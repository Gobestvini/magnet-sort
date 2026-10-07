# Advertising policy

## Current release state

Advertising is **disabled**. This project has no verified Meta app/account, test placement IDs, age/audience policy evidence, or real Instant Games context. `VITE_META_REWARDED_PLACEMENT_ID` and `VITE_META_INTERSTITIAL_PLACEMENT_ID` are optional deployment configuration; empty values keep the respective ad unavailable. Never put secrets in these variables. No live monetization is enabled by this task.

The standalone development build may grant one clearly labelled local test Extra Move. It does not display an ad and never emits `rewarded_viewed`. Production standalone has no test grant. The app uses an actual platform reward only when an Instant Games adapter and an explicitly configured rewarded placement are both available.

## Rewarded Extra Move

- The player explicitly presses the Extra Move control. The game and synthesized audio pause while the platform call is open.
- Only an adapter result with `status: ok` and `value.completed === true` may ask the current scene to grant the move. The run ID is captured before opening the ad and compared again before applying the grant. A stale run, cancellation, no-fill, missing/unsupported API, error, timeout, or dispose grants nothing.
- A run can receive one Extra Move. A successful grant marks that run assisted and clears a terminal loss so play can continue. No move is deducted for opening or dismissing an ad.
- `rewarded_viewed` is recorded only after the confirmed completion and successful grant, with the SDK provider. Dev test grants are excluded.
- Completion semantics remain conservative: a fulfilled `showAsync` without an explicit completion flag is not treated as a completed view until direct Meta test evidence confirms the documented JavaScript behavior.

## Interstitial

Interstitial is disabled unless a separately reviewed policy enables it. The controller accepts calls only for a terminal win/loss outside FTUE and with a placement ID. Proposed initial cap if later approved: at most one interstitial per app session and never more often than 120 seconds. No interstitial on action, chain, loading, retry, or daily board. The app currently makes a post-result eligibility call, which returns `interstitial-disabled` under the shipped policy.

Before enabling either format, verify current Meta rules, account and test-placement access, test-user behavior, cancellation/no-fill, completion semantics, supported markets, age/audience constraints, and resume lifecycle in an unpublished real test context. This repository does not claim that evidence exists.
