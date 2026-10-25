import Database from 'better-sqlite3';
import { mkdir, access, chmod, link, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { checkDatabase } from './store.mjs';

export async function backupDatabase(source, destination) {
  const from = resolve(source), to = resolve(destination);
  if (from === to) throw Error('Backup cannot overwrite the live database');
  try { await access(to); throw Error('Backup destination already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(to), { recursive: true, mode: 0o700 });
  const temporary = `${to}.${randomUUID()}.tmp`;
  const db = new Database(from, { readonly: true, fileMustExist: true });
  try {
    checkDatabase(db);
    await db.backup(temporary);
    const verified = new Database(temporary, { readonly: true, fileMustExist: true });
    let summary; try { summary = checkDatabase(verified); } finally { verified.close(); }
    await chmod(temporary, 0o600);
    // A completed file becomes visible atomically, without replacing a snapshot
    // that another operator/job may have created since the initial access check.
    await link(temporary, to);
    return summary;
  } finally { db.close(); await rm(temporary, { force: true }); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) throw Error('Usage: backup.mjs NEW_DESTINATION.sqlite; LEADERBOARDS_DB sets source');
  console.log(JSON.stringify(await backupDatabase(process.env.LEADERBOARDS_DB ?? '/data/leaderboards.sqlite', process.argv[2])));
}
