# Platform adapter contract

The app runtime may connect to a platform adapter without importing a vendor SDK into the deterministic game model. This is the boundary for a future Instant Games host integration; it is not a claim that this app/account is approved or that any remote service is enabled.

```ts
type PlatformResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'unsupported' | 'unavailable' | 'cancelled' | 'error'; reason?: string };

interface GamePlatform {
  initialize(onLoadingProgress?: (percent: number) => void): Promise<PlatformResult<{ sdkVersion?: string }>>;
  start(): Promise<PlatformResult<void>>;
  getEntry(): Promise<PlatformResult<{ kind: 'challenge' | 'daily'; data: unknown } | null>>;
  shareResult(input: { text: string; image?: string; data: unknown }): Promise<PlatformResult<void>>;
  getLeaderboard(input: { boardId: string; context: 'global' | 'friends'; limit: number }): Promise<PlatformResult<LeaderboardRow[]>>;
  rewarded(input: { placementId: string }): Promise<PlatformResult<{ completed: boolean }>>;
  interstitial(input: { placementId: string }): Promise<PlatformResult<void>>;
  onPause(callback: (paused: boolean) => void): () => void;
  dispose(): void;
}

interface LeaderboardRow {
  score: number;
  rank?: number;
  playerLabel?: string; // platform-approved display label only
  currentPlayer: boolean;
  verified: boolean; // false for any client-only/replay result
}
```

## Contract rules

- The standalone adapter resolves `unsupported` for platform-only operations. Existing local challenge links, local daily rotation, local best score and standalone test grant remain separate behavior.
- All platform calls are async, capability-checked after initialization, bounded by a timeout at the integration edge, and caught into `PlatformResult`; they never block the simulator loop or erase local progress.
- `initialize` is idempotent. `start` follows successful app resource initialization and only calls the platform readiness API once. SDK loading progress reflects actual app loading.
- `getEntry` returns parsed data, not executable state. Validate a challenge through the existing versioned challenge parser; accept a daily ID only through the existing versioned UTC rotation. Unknown, malformed and oversized data fall back to the normal Home screen.
- `shareResult` is invoked only by the user's action. A resolved platform share dialog means the operation returned, not that delivery/open is verified. Existing URL/copy fallback remains available.
- `getLeaderboard` is unavailable until the named board/context is configured and the app's supported API list confirms the operation. Never synthesize friend names, ranks or scores. Client-only rows must say `verified: false` and must not be used for trusted competitions.
- `rewarded` reports `completed: true` only when the SDK's documented completion result confirms it. Only then may the host grant the requested one-time booster and call analytics `rewardedViewed` with the provider completion confirmation. Cancel, no-fill, unsupported, failure, stale run ID or duplicate callback grant nothing.
- `interstitial` is unavailable unless there is a configured placement and a separate approved ad policy. It can only be called from an allowed post-result state, never from an action, chain, loading state or every retry.
- The host may apply a rewarded Extra Move only after an explicit provider completion, for the same run ID that opened the ad, and only once. A stale completion cannot affect a retry or another level.
- `onPause` returns an unsubscribe function. Pause/hidden callbacks suspend audio and pointer input, clear timing and stop the app-owned RAF as appropriate; resume reinitializes frame timing. `dispose` unsubscribes callbacks and releases SDK-owned handles without destroying shared host resources.
- Do not store app IDs, access tokens, player identifiers, signed payloads, friend lists, or ad credentials in source control or analytics. Backend secrets belong on a separately operated server.

## Current implementation boundary

The standalone site remains the active product host. TASK-0020 adds feature-detected Meta Instant Games initialization/start, validated challenge/daily entry data, explicit-action challenge share, pause lifecycle, and an isolated adapter. TASK-0021 adds a run-bound rewarded controller and a disabled-by-default interstitial policy. Adapter/controller paths have mock coverage only. App/account approval and capabilities, real Instant Games context, app-specific trusted leaderboard, ad placement/completion behavior, and publication remain unverified. Friend rankings and ads stay unavailable until app configuration and test evidence exist. The current GDD and existing web experience remain the source of truth for fallback.
