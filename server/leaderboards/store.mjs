import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiError, DAY, LIMITS, uuid } from './config.mjs';
import { canonicalDescriptor, boardKey, dateMillis, today, CONTENT_VERSION, CAMPAIGN_PRESET, DAILY_CATALOG_VERSION, DAILY_CONTENT_VERSION, DAILY_PRESET_ID, resolveDaily } from './profiles.mjs';

export const SCHEMA_VERSION = 1;
export function migrateDatabase(db) {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2000;');
  const hasMigrations = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  if (!hasMigrations && db.prepare("SELECT count(*) AS total FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().total) throw Error('Unknown database schema');
  if (hasMigrations) {
    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
    if (versions.length !== 1 || versions[0].version !== SCHEMA_VERSION) throw Error('Unsupported database schema');
    return;
  }
  db.transaction(() => db.exec(`
    CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY);
    INSERT INTO schema_migrations VALUES(1);
    CREATE TABLE players(id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, last_active_at INTEGER NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX sessions_owner ON sessions(player_id,created_at);
    CREATE INDEX sessions_expiry ON sessions(expires_at);
    CREATE TABLE runs(id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, client_attempt_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('campaign','daily')), descriptor_json TEXT NOT NULL, board_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','accepted')), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      accepted_at INTEGER, accepted_digest TEXT, receipt_json TEXT, UNIQUE(player_id,client_attempt_id));
    CREATE INDEX runs_owner ON runs(player_id,status,expires_at);
    CREATE INDEX runs_retention ON runs(status,expires_at,accepted_at);
    CREATE TABLE submissions(run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE, metrics_json TEXT NOT NULL, actions_json TEXT, created_at INTEGER NOT NULL);
    CREATE INDEX submissions_retention ON submissions(created_at);
    CREATE TABLE campaign_bests(player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, board_key TEXT NOT NULL, level_id TEXT NOT NULL,
      best_stars INTEGER NOT NULL CHECK(best_stars BETWEEN 1 AND 3), run_id TEXT REFERENCES runs(id) ON DELETE SET NULL, PRIMARY KEY(player_id,board_key,level_id));
    CREATE INDEX campaign_board ON campaign_bests(board_key,player_id);
    CREATE TABLE daily_bests(player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, board_key TEXT NOT NULL, date TEXT NOT NULL,
      moves INTEGER NOT NULL CHECK(moves>0), run_id TEXT REFERENCES runs(id) ON DELETE SET NULL, PRIMARY KEY(player_id,board_key));
    CREATE INDEX daily_board ON daily_bests(board_key,moves,player_id);
    CREATE INDEX daily_retention ON daily_bests(date);
  `)).immediate();
}
export function checkDatabase(db) {
  const version = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
  if (version.length !== 1 || version[0].version !== SCHEMA_VERSION) throw Error('Unsupported database schema');
  if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw Error('Database integrity check failed');
  for (const table of ['players', 'sessions', 'runs', 'submissions', 'campaign_bests', 'daily_bests']) db.prepare(`SELECT count(*) AS total FROM ${table}`).get();
  return { schemaVersion: SCHEMA_VERSION, sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get().version };
}
export function createStore(path = ':memory:', { clock = Date.now } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  try { migrateDatabase(db); db.pragma('journal_mode = WAL'); db.pragma('synchronous = FULL'); }
  catch (error) { db.close(); throw error; }
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const playerShape = row => ({ playerId: row.id, displayName: row.display_name });
  function ownRun(playerId, id) {
    const row = get('SELECT * FROM runs WHERE id=? AND player_id=?', id, playerId);
    if (!row) throw new ApiError(404, 'RUN_NOT_FOUND');
    return row;
  }
  function inspect(playerId, id, digest) {
    const row = ownRun(playerId, id), now = clock();
    if (row.status === 'accepted') {
      if (now - row.accepted_at >= 90 * DAY || !row.receipt_json) throw new ApiError(410, 'RECEIPT_EXPIRED');
      if (row.accepted_digest !== digest) throw new ApiError(409, 'RESULT_CONFLICT');
      return { row, accepted: JSON.parse(row.receipt_json) };
    }
    if (row.expires_at <= now) throw new ApiError(410, 'RUN_EXPIRED');
    return { row };
  }
  function best(playerId, row) {
    if (row.mode === 'campaign') {
      const value = get('SELECT count(*) AS completedLevels, coalesce(sum(best_stars),0) AS stars FROM campaign_bests WHERE player_id=? AND board_key=?', playerId, row.board_key);
      return { completedLevels: value.completedLevels, stars: value.stars };
    }
    const value = get('SELECT moves FROM daily_bests WHERE player_id=? AND board_key=?', playerId, row.board_key);
    return value ? { moves: value.moves } : null;
  }
  return {
    db, path,
    issueSession(identity) {
      const now = clock(), token = randomBytes(32).toString('base64url'), tokenHash = createHash('sha256').update(token).digest('hex');
      return db.transaction(() => {
        let player = get('SELECT * FROM players WHERE telegram_id=?', identity.telegramId);
        if (!player) {
          player = { id: randomUUID(), display_name: identity.displayName };
          run('INSERT INTO players VALUES(?,?,?,?)', player.id, identity.telegramId, identity.displayName, now);
        } else run('UPDATE players SET display_name=?,last_active_at=? WHERE id=?', identity.displayName, now, player.id);
        player.display_name = identity.displayName;
        run('DELETE FROM sessions WHERE player_id=? AND expires_at<=?', player.id, now);
        run('INSERT INTO sessions VALUES(?,?,?,?)', tokenHash, player.id, now, now + LIMITS.tokenMs);
        run('DELETE FROM sessions WHERE player_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE player_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?)', player.id, player.id, LIMITS.sessions);
        return { token, expiresAt: now + LIMITS.tokenMs, player: playerShape(player) };
      }).immediate();
    },
    session(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'AUTH_INVALID');
      const hash = createHash('sha256').update(token).digest('hex');
      const player = get('SELECT p.* FROM sessions s JOIN players p ON p.id=s.player_id WHERE s.token_hash=? AND s.expires_at>?', hash, clock());
      if (!player) throw new ApiError(401, 'AUTH_EXPIRED');
      return playerShape(player);
    },
    register(playerId, clientAttemptId, mode, rawDescriptor) {
      if (!uuid(clientAttemptId)) throw new ApiError(400, 'INVALID_ATTEMPT_ID');
      const descriptor = canonicalDescriptor(mode, rawDescriptor, { registration: false }), encoded = JSON.stringify(descriptor), now = clock();
      return db.transaction(() => {
        const old = get('SELECT * FROM runs WHERE player_id=? AND client_attempt_id=?', playerId, clientAttemptId);
        if (old) {
          if (old.mode !== mode || old.descriptor_json !== encoded) throw new ApiError(409, 'ATTEMPT_CONFLICT');
          return { runId: old.id, descriptor, expiresAt: old.expires_at };
        }
        canonicalDescriptor(mode, descriptor, { now, registration: true });
        if (get("SELECT count(*) AS total FROM runs WHERE player_id=? AND status='open' AND expires_at>?", playerId, now).total >= LIMITS.openRuns) throw new ApiError(429, 'OPEN_RUN_LIMIT', true, 60);
        const expiresAt = mode === 'daily' ? dateMillis(descriptor.date) + 2 * DAY : now + 2 * DAY, id = randomUUID();
        run("INSERT INTO runs(id,player_id,client_attempt_id,mode,descriptor_json,board_key,status,created_at,expires_at) VALUES(?,?,?,?,?,?,'open',?,?)", id, playerId, clientAttemptId, mode, encoded, boardKey(mode, descriptor), now, expiresAt);
        return { runId: id, descriptor, expiresAt };
      }).immediate();
    },
    ownRun, inspect,
    commit(playerId, id, digest, metrics, actions, assisted) {
      return db.transaction(() => {
        const result = inspect(playerId, id, digest);
        if (result.accepted) return result.accepted;
        const row = result.row, descriptor = JSON.parse(row.descriptor_json), now = clock();
        run('INSERT INTO submissions VALUES(?,?,?,?)', id, JSON.stringify({ ...metrics, assisted }), JSON.stringify(actions), now);
        if (row.mode === 'campaign') {
          run(`INSERT INTO campaign_bests VALUES(?,?,?,?,?) ON CONFLICT(player_id,board_key,level_id) DO UPDATE SET best_stars=excluded.best_stars,run_id=excluded.run_id WHERE excluded.best_stars>campaign_bests.best_stars`, playerId, row.board_key, descriptor.levelId, metrics.stars, id);
        } else run(`INSERT INTO daily_bests VALUES(?,?,?,?,?) ON CONFLICT(player_id,board_key) DO UPDATE SET moves=excluded.moves,run_id=excluded.run_id WHERE excluded.moves<daily_bests.moves`, playerId, row.board_key, descriptor.date, metrics.moves, id);
        const response = { receipt: { runId: id, digest, acceptedAt: now }, metrics, personalBest: best(playerId, row) };
        run("UPDATE runs SET status='accepted',accepted_at=?,accepted_digest=?,receipt_json=? WHERE id=?", now, digest, JSON.stringify(response), id);
        run('UPDATE players SET last_active_at=? WHERE id=?', now, playerId);
        return response;
      }).immediate();
    },
    leaderboard(mode, selectors, playerId = null) {
      let descriptor;
      if (selectors.rulesVersion !== undefined && selectors.rulesVersion !== '4') throw new ApiError(409, 'VERSION_MISMATCH');
      if (mode === 'campaign') {
        if ((selectors.contentVersion ?? CONTENT_VERSION) !== CONTENT_VERSION || (selectors.presetId ?? CAMPAIGN_PRESET) !== CAMPAIGN_PRESET || selectors.catalogVersion !== undefined || selectors.date !== undefined) throw new ApiError(409, 'VERSION_MISMATCH');
        descriptor = { contentVersion: CONTENT_VERSION, presetId: CAMPAIGN_PRESET };
      } else {
        descriptor = resolveDaily(selectors.date);
        if ((selectors.contentVersion ?? DAILY_CONTENT_VERSION) !== DAILY_CONTENT_VERSION || (selectors.presetId ?? DAILY_PRESET_ID) !== DAILY_PRESET_ID || (selectors.catalogVersion ?? DAILY_CATALOG_VERSION) !== DAILY_CATALOG_VERSION) throw new ApiError(409, 'VERSION_MISMATCH');
      }
      const key = boardKey(mode, descriptor);
      return db.transaction(() => {
        const cte = mode === 'campaign' ? `WITH aggregate AS (SELECT b.player_id,count(*) AS completedLevels,sum(b.best_stars) AS stars FROM campaign_bests b WHERE b.board_key=? GROUP BY b.player_id), ranked AS (SELECT a.*,p.display_name,rank() OVER(ORDER BY completedLevels DESC,stars DESC) AS rank FROM aggregate a JOIN players p ON p.id=a.player_id)` :
          `WITH ranked AS (SELECT b.player_id,b.moves,p.display_name,rank() OVER(ORDER BY b.moves ASC) AS rank FROM daily_bests b JOIN players p ON p.id=b.player_id WHERE b.board_key=?)`;
        const select = mode === 'campaign' ? 'player_id AS playerId,display_name AS displayName,rank,completedLevels,stars' : 'player_id AS playerId,display_name AS displayName,rank,moves';
        const rows = db.prepare(`${cte} SELECT ${select} FROM ranked ORDER BY rank,player_id LIMIT 50`).all(key);
        const ownRow = playerId ? db.prepare(`${cte} SELECT ${select} FROM ranked WHERE player_id=?`).get(key, playerId) ?? null : null;
        return { boardKey: key, rows, ownRow, rules: { assistanceAllowed: true, ranking: mode === 'campaign' ? ['completedLevels:desc', 'stars:desc'] : ['moves:asc'], ties: 'competition', verified: 'replay', ...(mode === 'daily' ? { date: descriptor.date } : {}) }, ...(mode === 'daily' ? { date: descriptor.date } : {}) };
      }).deferred();
    },
    deletePlayer(playerId) { run('DELETE FROM players WHERE id=?', playerId); return { deleted: true }; },
    cleanup(batch = 1000) {
      const now = clock();
      db.transaction(() => {
        run('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at<=? LIMIT ?)', now, batch);
        run('UPDATE submissions SET actions_json=NULL WHERE run_id IN (SELECT run_id FROM submissions WHERE created_at<? AND actions_json IS NOT NULL LIMIT ?)', now - 30 * DAY, batch);
        run('DELETE FROM daily_bests WHERE rowid IN (SELECT rowid FROM daily_bests WHERE date<? LIMIT ?)', today(now - 89 * DAY), batch);
        // Best rows survive run/receipt pruning via ON DELETE SET NULL.
        run("DELETE FROM runs WHERE id IN (SELECT id FROM runs WHERE (status='open' AND expires_at<?) OR (status='accepted' AND accepted_at<?) LIMIT ?)", now - 7 * DAY, now - 90 * DAY, batch);
        run('DELETE FROM players WHERE id IN (SELECT id FROM players WHERE last_active_at<? LIMIT ?)', now - 365 * DAY, batch);
      }).immediate();
    },
    close() { db.close(); }
  };
}
