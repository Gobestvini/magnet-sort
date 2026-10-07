# Facebook Instant Games capability review

Reviewed 2026-10-07. This is a capability review, not an account probe, app creation, SDK install, upload, or publication.

## Evidence boundary

Meta's current `facebook/meta-instant-games-unity-plugin` repository says its wrapper targets Instant Games SDK 8.0 and documents async initialize/start/loading, supported-API and entry-point access, share/invite/context updates, session score, tournaments, rewarded-video and interstitial ad instances, and pause callback. This is current Meta-owned SDK-adjacent evidence, but method names in the wrapper are C# and do not prove that the corresponding direct JavaScript methods are enabled for this game's app/account. See the [Meta API reference](https://github.com/facebook/meta-instant-games-unity-plugin/blob/main/documentation/API_REFERENCE.md) and [plugin overview](https://github.com/facebook/meta-instant-games-unity-plugin).

The direct [Meta Instant Games developer documentation](https://developers.facebook.com/docs/games/build/instant-games/) could not be fetched in this review environment. I did not infer account access, current dashboard steps, contract eligibility, markets or permissions from old tutorials. The official [Facebook Instant Games sample repository](https://github.com/fbsamples/fbinstant-samples) is archived; it is useful only as historical testing evidence: local mock mode, embedded player against production SDK, and upload requiring an App ID and Web Hosting access token. Do not copy its credentials or treat its upload instructions as current policy.

## Capability matrix

| Capability | Evidence / adapter decision | Status for Magnet Sort |
| --- | --- | --- |
| App/account availability, approval, supported markets | Requires the specific Meta developer app dashboard/account; no app ID or dashboard credentials were available. | **Unknown** |
| SDK bootstrap, loader and readiness | Meta wrapper reference documents initialize, loading progress, start-game and supported-API methods; direct JS API/version and current app availability need a runtime probe. | **Documented; app probe unknown** |
| Entry point and inbound data | Wrapper documents entry-point name and data access. Accept only bounded, schema-validated challenge/daily payloads; keep existing web URL parsing as fallback. | **Documented; app probe unknown** |
| Share / invite / updates / context | Wrapper documents share, invite, update, context create/switch/choose and context player access. Calls require explicit player action and may be unavailable/rejected. A fulfilled share dialog does not prove a friend received/opened it. | **Documented; app permissions/real context unknown** |
| Leaderboard / ranking | Wrapper documents session scores, tournaments and posting tournament scores; its current reference does not establish a per-friend ranking configuration for this app. The archived samples have global/context leaderboard examples, but are not current access evidence. | **Partially documented; app leaderboard configuration unknown** |
| Trusted scores | Signed player/session info is exposed by the current wrapper, and the old sample repo contains a secure-backend example. Client replay/local result alone is not a trusted score. Platform's exact current trust rules need developer docs/account review; competitive ranking should remain disabled without verification. | **Backend trust contract unknown** |
| Rewarded video | Wrapper lists rewarded-video and rewarded-interstitial instances with load/show methods. Placement ID, account eligibility, test placement, completion semantics and geography require an app/dashboard and real test context. | **API surface documented; availability unknown** |
| Interstitial | Wrapper lists interstitial instances with load/show methods. Frequency, age/audience, policy, placement and account eligibility were not verified. | **API surface documented; availability unknown** |
| Pause / lifecycle | Wrapper documents pause callback and SDK initialization/readiness. App-owned audio, pointer, RAF and renderer still need to suspend/resume/dispose safely around host lifecycle callbacks. | **Documented; integration untested** |
| Standalone web | Existing web challenge URL, daily board, local progress and test booster can run without the platform SDK. | **Available and verified in browser** |

## Minimum evidence before a real capability claim

1. A developer app configured for Instant Games, its App ID, and a person assigned the required developer/tester role in that app.
2. Current dashboard evidence for SDK/API permissions, leaderboard configuration, ad placements and test-account/market eligibility. Store identifiers and access tokens outside the repository.
3. A local mock test for absence/rejection and fallback. A mock does not prove platform behavior.
4. A non-public platform test build in the currently supported app test flow, HTTPS/host requirements, and a real test account/context. Do not use production publication as a substitute.
5. For any trusted leaderboard, a server-side validation design and confirmation of the platform's current signed-data contract. Never call local replay “server verified”.

This environment had no app ID, developer-role account, placement IDs, or real test context. Consequently, account-specific status is **unknown**; no capability has been claimed as enabled for Gobestvini's app.

## MVP adapter boundary

See [PLATFORM_CONTRACT.md](PLATFORM_CONTRACT.md). In the standalone web build, keep the current local challenge/daily behavior and return explicit `unsupported` for platform-only operations. In an Instant Games host, initialize only after feature detection; resolve entry data through a small allowlisted parser; request share/update only on player action; never fabricate leaderboard values or reward completion. If any call rejects or times out, retain local progress and make standalone actions available.
