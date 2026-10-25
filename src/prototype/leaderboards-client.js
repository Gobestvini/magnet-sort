import { V4_CONTENT_VERSION } from './progress-v4.js';
import { DAILY_CATALOG_VERSION, DAILY_PRESET_ID } from './daily-rules.js';

const clone = value => structuredClone(value);
const tokenKey = base => 'magnet-sort.leaderboards.session.v1:' + base;
const attemptsKey = base => 'magnet-sort.leaderboards.attempts.v1:' + base;
const uuid = () => globalThis.crypto.randomUUID();
function safeStorage(name) { try { return globalThis[name]; } catch { return null; } }
function read(storage, key, limit = 32768) { try { const raw = storage?.getItem(key); return raw && raw.length <= limit ? JSON.parse(raw) : null; } catch { return null; } }
function write(storage, key, value) { try { if (!storage) return false; if (value === null) storage.removeItem(key); else storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; /* Storage failure never changes gameplay. */ } }

export function rankingDescriptor(snapshot) {
  if (!eligibleSnapshot(snapshot)) return null;
  const attempt = snapshot.attempt;
  if (!attempt || !snapshot.state) return null;
  return snapshot.mode === 'daily' ? {
    rulesVersion: 4, date: snapshot.daily?.entry?.date, catalogVersion: snapshot.daily?.entry?.catalogVersion,
    contentVersion: snapshot.daily?.entry?.contentVersion, presetId: snapshot.daily?.entry?.presetId,
    levelId: attempt.levelId, seed: attempt.seed
  } : { rulesVersion: 4, contentVersion: V4_CONTENT_VERSION, presetId: 'campaign-a-v1', levelId: attempt.levelId, seed: attempt.seed };
}
function eligibleSnapshot(snapshot) { return ['campaign', 'daily'].includes(snapshot.mode) && !snapshot.challenge?.preview; }

export class LeaderboardsError extends Error {
  constructor(code, retryable = false) { super(code); this.name = 'LeaderboardsError'; this.code = code; this.retryable = retryable; }
}
export function leaderboardMessage(code) {
  if (['AUTH_REQUIRED', 'AUTH_EXPIRED', 'AUTH_INVALID', 'INVALID_AUTH', 'EXPIRED_AUTH', 'UNAUTHORIZED', 'REOPEN_TELEGRAM'].includes(code)) return 'Open the game again from Telegram to refresh your sign-in. Your game is saved.';
  if (code === 'AUTH_UNSUPPORTED') return 'Update Telegram and open the game from the Magnet Sort bot to participate.';
  if (code === 'OFFLINE') return 'You are offline. Your game is safe; retry when connected.';
  if (code === 'TIMEOUT') return 'The server took too long. Your game is safe; please retry.';
  if (code === 'DAILY_DATE_CHANGED' || code === 'DAILY_DESCRIPTOR_MISMATCH') return 'This daily attempt does not match today’s shared board. Keep playing locally, or return to campaign and open today’s board.';
  if (['VERSION_MISMATCH', 'UNSUPPORTED_VERSION', 'VERSION_CONFLICT', 'DAILY_NOT_READY'].includes(code)) return 'This board version is not available for ranking. Update the game and try again.';
  if (['RUN_CONFLICT', 'ATTEMPT_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'RESULT_CONFLICT', 'CONFLICT'].includes(code)) return 'A different result was already recorded for this attempt. Start a new attempt to improve it.';
  if (['RATE_LIMITED', 'RATE_LIMIT', 'OPEN_RUN_LIMIT', 'LIMITER_FULL', 'REPLAY_QUEUE_FULL', 'WORKER_UNAVAILABLE', 'DATABASE_BUSY', 'QUEUE_FULL', 'BUSY'].includes(code)) return 'The server is busy. Please wait a moment, then retry.';
  if (code === 'SAVE_CONFLICT') return 'This game changed in another tab. Reload your saved game before submitting.';
  if (code === 'RANKING_CONFLICT') return 'Leaderboard records changed in another tab. Reload this tab before submitting. Your game is safe.';
  if (['RUN_EXPIRED', 'RECEIPT_EXPIRED', 'EXPIRED_RUN'].includes(code)) return 'This ranked attempt expired. Your local game is unchanged; start a new attempt to rank again.';
  if (code === 'UNAVAILABLE') return 'Leaderboards are unavailable right now. You can keep playing.';
  return 'The request could not be completed. Your game is safe; please retry.';
}

// HTTP and identity live outside the simulator. No launch data is persisted.
export function createLeaderboardsClient({ baseUrl, authenticate, fetch: fetcher = globalThis.fetch, sessionStorage = safeStorage('sessionStorage'), now = Date.now } = {}) {
  const base = typeof baseUrl === 'string' ? baseUrl.replace(/\/+$/, '') : '';
  let credentials = read(sessionStorage, tokenKey(base)), authPromise = null, disposed = false;
  let serverOffset = Number.isFinite(credentials?.serverOffset) ? credentials.serverOffset : 0;
  const pending = new Set();
  function forget() { credentials = null; write(sessionStorage, tokenKey(base), null); }
  function validToken() { return typeof credentials?.token === 'string' && credentials.token.length <= 256 && Number.isFinite(credentials.expiresAt) && credentials.expiresAt > now() + serverOffset; }
  async function request(path, { method = 'GET', body, signal, auth = false } = {}) {
    if (!base || disposed) throw new LeaderboardsError('UNAVAILABLE');
    if (auth && !validToken()) throw new LeaderboardsError('REOPEN_TELEGRAM');
    const abort = new AbortController(); pending.add(abort);
    const cancel = () => abort.abort(); signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) abort.abort();
    let timeout = false;
    const timer = setTimeout(() => { timeout = true; abort.abort(); }, 10000);
    try {
      const response = await fetcher(base + path, { method, credentials: 'omit', signal: abort.signal,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(validToken() ? { Authorization: 'Bearer ' + credentials.token } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      let data;
      try { data = await response.json(); } catch { throw new LeaderboardsError('INVALID_RESPONSE', true); }
      if (Number.isFinite(data?.serverTime)) serverOffset = data.serverTime - now();
      if (!response.ok) {
        if (response.status === 401) forget();
        throw new LeaderboardsError(data?.error?.code ?? (response.status === 401 ? 'AUTH_EXPIRED' : 'REQUEST_FAILED'), Boolean(data?.error?.retryable));
      }
      return data;
    } catch (error) {
      if (error instanceof LeaderboardsError) throw error;
      if (error?.name === 'AbortError' || abort.signal.aborted) { if (timeout) throw new LeaderboardsError('TIMEOUT', true); throw new LeaderboardsError('ABORTED'); }
      throw new LeaderboardsError('OFFLINE', true);
    } finally { clearTimeout(timer); pending.delete(abort); signal?.removeEventListener('abort', cancel); }
  }
  return {
    get available() { return Boolean(base); }, get canParticipate() { return typeof authenticate === 'function'; },
    get signedIn() { return validToken(); }, get player() { return validToken() ? credentials.player : null; },
    async bootstrap() {
      if (disposed || !base || !authenticate || validToken()) return;
      if (!authPromise) authPromise = (async () => {
        let initData = await authenticate();
        if (typeof initData !== 'string' || !initData || initData.length > 8192) throw new LeaderboardsError('AUTH_UNSUPPORTED');
        let data;
        try { data = await request('/auth/telegram', { method: 'POST', body: { initData } }); }
        finally { initData = null; }
        if (typeof data?.token !== 'string' || !Number.isFinite(data.expiresAt) || data.expiresAt <= now() + serverOffset) throw new LeaderboardsError('INVALID_RESPONSE');
        if (disposed) return;
        credentials = { token: data.token, expiresAt: data.expiresAt, player: data.player, serverOffset };
        write(sessionStorage, tokenKey(base), credentials);
      })().finally(() => { authPromise = null; });
      return authPromise;
    },
    async register(mode, descriptor, clientAttemptId) { await this.bootstrap(); return request('/runs', { method: 'POST', body: { mode, descriptor, clientAttemptId, publishConsent: true }, auth: true }); },
    async submit(runId, attempt) { await this.bootstrap(); return request('/runs/' + encodeURIComponent(runId) + '/result', { method: 'POST', body: { actions: attempt.actions, assisted: attempt.assisted }, auth: true }); },
    async list(mode, date, signal) {
      const query = mode === 'daily' ? new URLSearchParams({ date, contentVersion: V4_CONTENT_VERSION, presetId: DAILY_PRESET_ID, catalogVersion: DAILY_CATALOG_VERSION }) : new URLSearchParams({ contentVersion: V4_CONTENT_VERSION, presetId: 'campaign-a-v1' });
      return request('/leaderboards/' + mode + '?' + query, { signal });
    },
    async remove() { const result = await request('/me', { method: 'DELETE', body: { confirm: 'delete-leaderboards' }, auth: true }); forget(); return result; },
    dispose() { disposed = true; for (const abort of pending) abort.abort(); pending.clear(); },
    debug() { return { pendingRequests: pending.size, signedIn: validToken() }; }
  };
}

export function createLeaderboardsController({ capability, getSnapshot, onChange = () => {}, storage = safeStorage('localStorage'), sessionStorage, fetch, now = Date.now, newId = uuid } = {}) {
  const base = capability?.apiUrl ?? '';
  const client = createLeaderboardsClient({ baseUrl: base, authenticate: capability?.authenticate, sessionStorage, fetch, now });
  const key = attemptsKey(base);
  let expectedRaw = null;
  try { expectedRaw = storage?.getItem(key) ?? null; } catch { /* Memory-only recovery is reported below. */ }
  let saved = null;
  try { if (expectedRaw && expectedRaw.length <= 512 * 1024) saved = JSON.parse(expectedRaw); } catch { /* Invalid ranking metadata never grants participation. */ }
  let metadata = saved?.version === 1 && typeof saved.consent === 'boolean' && saved.attempts && typeof saved.attempts === 'object' ? saved : { version: 1, consent: false, attempts: {} };
  // Only two bounded slots; unknown/corrupt storage is never interpreted as consent.
  metadata = { version: 1, consent: metadata.consent, attempts: Object.fromEntries(['campaign', 'daily'].filter(mode => metadata.attempts[mode]?.descriptor && typeof metadata.attempts[mode]?.clientAttemptId === 'string').map(mode => [mode, metadata.attempts[mode]])),
    pending: Object.fromEntries(['campaign','daily'].filter(mode => saved?.pending?.[mode]?.descriptor && typeof saved.pending[mode].clientAttemptId === 'string' && saved.pending[mode].snapshot?.state?.terminal === 'won' && Array.isArray(saved.pending[mode].snapshot?.attempt?.actions) && saved.pending[mode].snapshot.attempt.actions.length <= 2048).map(mode => [mode, saved.pending[mode]])) };
  let state = { open: false, tab: 'campaign', date: new Date(now()).toISOString().slice(0, 10), status: 'idle', rows: [], ownRow: null, error: null, authError: null, publication: 'idle', publicationError: null, savedResultMode:null, deleting: false };
  let disposed = false, readAbort = null, readGeneration = 0;
  const operations = new Map();
  const emit = () => { if (!disposed) onChange(); };
  let rankingSaveFailed = false, metadataConflict = false;
  const persist = () => {
    if (metadataConflict) return false;
    try {
      if (!storage) throw Error('Storage unavailable');
      // Optimistic comparison detects sequential tab interleavings. LocalStorage
      // has no compare-and-swap; this deliberately does not promise full CAS.
      if (storage.getItem(key) !== expectedRaw) { metadataConflict = true; rankingSaveFailed = true; return false; }
      const raw = JSON.stringify(metadata);
      if (raw.length > 512 * 1024) throw Error('Ranking metadata too large');
      storage.setItem(key, raw); expectedRaw = raw; rankingSaveFailed = false; return true;
    } catch { rankingSaveFailed = true; return false; }
  };
  function view() {
    const snapshot = getSnapshot(), mode = snapshot.mode ?? 'campaign', active = metadata.attempts[mode], pendingMode = metadata.pending[mode] ? mode : Object.keys(metadata.pending)[0], pending = metadata.pending[pendingMode], current = pending ?? active;
    const matches = current && JSON.stringify(current.descriptor) === JSON.stringify(rankingDescriptor(snapshot));
    const publication = metadataConflict ? 'error' : pending ? operations.has(pending.clientAttemptId) ? 'sending' : pending.failed ? 'error' : 'pending' : !matches ? 'idle' : current.submitted ? 'sent' : operations.has(current.clientAttemptId) ? 'sending' : current.failed ? 'error' : current.runId ? 'registered' : state.publicationError === 'SAVE_CONFLICT' ? 'error' : 'idle';
    return { ...clone(state), publication, publicationError: metadataConflict ? 'RANKING_CONFLICT' : current?.errorCode ?? state.publicationError, authError:metadataConflict?'RANKING_CONFLICT':state.authError, pendingMode, pendingCount:Object.keys(metadata.pending).length, rankingSaveFailed,
      consent: metadata.consent, eligible:eligibleSnapshot(snapshot), canParticipate: client.canParticipate, signedIn: client.signedIn, available: client.available, player: client.player };
  }
  function entry(snapshot) {
    const mode = snapshot.mode ?? 'campaign', descriptor = rankingDescriptor(snapshot);
    if (!descriptor) return null;
    let current = metadata.attempts[mode];
    if (!current || JSON.stringify(current.descriptor) !== JSON.stringify(descriptor)) {
      current = { clientAttemptId: newId(), descriptor, runId: null, submitted: false };
      metadata.attempts[mode] = current; persist();
    }
    return current;
  }
  function queueWinner(snapshot, current) {
    const mode = snapshot.mode ?? 'campaign';
    const previous = metadata.pending[mode];
    if (previous) return previous; // One unsent winning journal per mode; never overwrite it with a new attempt.
    if (!current || current.submitted || current.skipPublication) return current;
    const pending = { ...clone(current), snapshot: { mode, daily: clone(snapshot.daily),
      attempt: clone(snapshot.attempt), state: { terminal:'won' }, saveStatus: clone(snapshot.saveStatus) } };
    metadata.pending[mode] = pending; persist(); // Before the first winning HTTP request.
    return pending;
  }
  function publication(snapshot) {
    const current = entry(snapshot);
    const record = snapshot.state.terminal === 'won' ? queueWinner(snapshot, current) : current;
    return { current:record, snapshot:record?.snapshot ?? snapshot };
  }
  async function publish(snapshot, current, automatic = false) {
    if (!eligibleSnapshot(snapshot) || !eligibleSnapshot(getSnapshot())) return;
    if (disposed || !metadata.consent || !client.canParticipate || !client.available || !current) return;
    if (metadataConflict) { emit(); return; }
    if (['conflict', 'invalid-data', 'unsupported-version'].includes(snapshot.saveStatus?.reason)) { current.failed = true; current.errorCode = 'SAVE_CONFLICT'; persist(); state.publication = 'error'; state.publicationError = 'SAVE_CONFLICT'; emit(); return; }
    if (current.skipPublication) return;
    if (current.submitted || operations.has(current.clientAttemptId)) return operations.get(current.clientAttemptId);
    if (current.runId && snapshot.state.terminal !== 'won') return;
    if (automatic && current.failed) return; // Explicit retry is required after failure.
    const isCurrent = () => !disposed && metadata.attempts[snapshot.mode ?? 'campaign']?.clientAttemptId === current.clientAttemptId &&
      (getSnapshot().mode ?? 'campaign') === (snapshot.mode ?? 'campaign') && JSON.stringify(rankingDescriptor(getSnapshot())) === JSON.stringify(current.descriptor);
    const operation = (async () => {
      state.publication = 'sending'; state.publicationError = null; state.savedResultMode = null; emit();
      try {
        if (!current.runId) {
          const registered = await client.register(snapshot.mode ?? 'campaign', current.descriptor, current.clientAttemptId);
          if (typeof registered?.runId !== 'string' || registered.runId.length > 128) throw new LeaderboardsError('INVALID_RESPONSE');
          current.runId = registered.runId; persist();
          const active = metadata.attempts[snapshot.mode ?? 'campaign'];
          if (active?.clientAttemptId === current.clientAttemptId) { active.runId = current.runId; persist(); }
        }
        if (disposed || !metadata.consent || !eligibleSnapshot(getSnapshot())) return;
        if (snapshot.state.terminal === 'won') {
          await client.submit(current.runId, snapshot.attempt);
          if (disposed) return;
          current.submitted = true; persist(); if (isCurrent()) state.publication = 'sent';
          state.savedResultMode = snapshot.mode ?? 'campaign';
          const mode = snapshot.mode ?? 'campaign', active = metadata.attempts[mode];
          if (active?.clientAttemptId === current.clientAttemptId) { active.submitted = true; active.failed = false; delete active.errorCode; }
          if (metadata.pending[mode]?.clientAttemptId === current.clientAttemptId) delete metadata.pending[mode];
          if (state.open) void load();
        } else if (isCurrent()) state.publication = 'registered';
        current.failed = false; delete current.errorCode; persist();
      } catch (error) {
        if (!disposed && error.code !== 'ABORTED') {
          current.failed = true; current.errorCode = error.code ?? 'REQUEST_FAILED';
          for (const candidate of [metadata.attempts[snapshot.mode ?? 'campaign'], metadata.pending[snapshot.mode ?? 'campaign']]) if (candidate?.clientAttemptId === current.clientAttemptId) { candidate.failed = true; candidate.errorCode = current.errorCode; }
          if (isCurrent()) { state.publication = 'error'; state.publicationError = current.errorCode; } persist();
        }
      } finally { operations.delete(current.clientAttemptId); emit(); }
    })();
    operations.set(current.clientAttemptId, operation);
    emit();
    return operation;
  }
  async function load() {
    readAbort?.abort(); readAbort = new AbortController();
    const generation = ++readGeneration;
    state.status = 'loading'; state.error = null; state.rows = []; state.ownRow = null; emit();
    try {
      const data = await client.list(state.tab, state.date, readAbort.signal);
      if (disposed || generation !== readGeneration || !state.open) return;
      const validRow = row => row && typeof row.playerId === 'string' && row.playerId.length <= 128 && typeof row.displayName === 'string' && [...row.displayName].length <= 64 && Number.isSafeInteger(row.rank) && row.rank >= 1 &&
        (state.tab === 'daily' ? Number.isSafeInteger(row.moves) && row.moves >= 1 : Number.isSafeInteger(row.completedLevels) && row.completedLevels >= 1 && Number.isSafeInteger(row.stars) && row.stars >= 1);
      if (!Array.isArray(data?.rows) || data.rows.length > 50 || !data.rows.every(validRow) || (data.ownRow != null && !validRow(data.ownRow))) throw new LeaderboardsError('INVALID_RESPONSE');
      state.rows = data.rows; state.ownRow = data.ownRow ?? null; state.status = data.rows.length ? 'ready' : 'empty';
    } catch (error) {
      if (disposed || generation !== readGeneration || error.code === 'ABORTED') return;
      state.status = 'error'; state.error = error.code ?? 'REQUEST_FAILED';
    }
    emit();
  }
  const controller = {
    get view() { return view(); },
    async bootstrap() { try { await client.bootstrap(); state.authError = null; } catch (error) { if (error.code !== 'ABORTED') state.authError = error.code ?? 'REQUEST_FAILED'; } if(disposed)return; emit(); if (metadata.consent) this.observe(); },
    open() { state.open = true; const snapshot = getSnapshot(); state.tab = snapshot.mode === 'daily' ? 'daily' : 'campaign'; state.date = snapshot.daily?.entry?.date ?? snapshot.daily?.today ?? new Date(now()).toISOString().slice(0, 10); emit(); void load(); },
    close() { state.open = false; readAbort?.abort(); ++readGeneration; emit(); },
    tab(mode) { if (!['campaign', 'daily'].includes(mode)) return; state.tab = mode; void load(); },
    retry() { void load(); },
    async join() { const snapshot = clone(getSnapshot()); if(!eligibleSnapshot(snapshot))return; metadata.consent = true; persist(); const item = metadata.pending[snapshot.mode ?? 'campaign']; const selected = item ? {snapshot:item.snapshot,current:item} : publication(snapshot); await publish(selected.snapshot, selected.current); emit(); },
    leave() { metadata.consent = false; persist(); emit(); },
    observe() { if(disposed)return; const snapshot = clone(getSnapshot()); if(!eligibleSnapshot(snapshot))return; const active = entry(snapshot); if (!metadata.consent) return; const selected = publication(snapshot), current = selected.current; void publish(selected.snapshot, current, true).then(() => {
      // A win may commit while early registration was in flight. Re-read the
      // owner's journal instead of publishing that earlier nonterminal snapshot.
      if (disposed || !metadata.consent) return;
      const latest = clone(getSnapshot()), latestEntry = entry(latest);
      if (eligibleSnapshot(latest) && latestEntry === active && latest.state.terminal === 'won' && !latestEntry.submitted && !current?.failed && !operations.has(current.clientAttemptId)) {
        const winner = publication(latest); if (!winner.current.submitted) void publish(winner.snapshot, winner.current, true);
      }
    }); },
    renew(mode) { if(!['campaign','daily'].includes(mode))return; delete metadata.attempts[mode]; persist(); state.publication = 'idle'; state.publicationError = null; state.savedResultMode = null; },
    async retryPublication(mode) { const snapshot = clone(getSnapshot()); if(!eligibleSnapshot(snapshot))return; const pending = metadata.pending[mode ?? snapshot.mode ?? 'campaign'] ?? Object.values(metadata.pending)[0]; const item = pending ? {snapshot:pending.snapshot,current:pending} : publication(snapshot); await publish(item.snapshot, item.current); if (!disposed && metadata.consent && !item.current?.failed) this.observe(); },
    discardPending() { const mode = view().pendingMode; if (!mode) return; const previous = metadata.pending[mode], active = metadata.attempts[mode]; if (active?.clientAttemptId === previous.clientAttemptId) active.skipPublication = true; delete metadata.pending[mode]; persist(); state.publicationError = null; emit(); },
    async remove() { state.deleting = true; emit(); try { await client.remove(); metadata = { version: 1, consent: false, attempts: {}, pending:{} }; persist(); state.publication = 'idle'; state.authError = 'REOPEN_TELEGRAM'; await load(); } catch (error) { state.authError = error.code ?? 'REQUEST_FAILED'; } finally { state.deleting = false; emit(); } },
    debug() { return { ...client.debug(), pendingPublications: operations.size, readGeneration }; },
    dispose() { disposed = true; ++readGeneration; readAbort?.abort(); client.dispose(); operations.clear(); }
  };
  return controller;
}
