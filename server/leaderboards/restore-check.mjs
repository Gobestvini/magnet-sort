import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkDatabase } from './store.mjs';

export function verifySnapshot(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const summary = checkDatabase(db);
    for (const row of db.prepare("SELECT id,accepted_digest,receipt_json FROM runs WHERE status='accepted'").iterate()) {
      const receipt = JSON.parse(row.receipt_json);
      if (receipt.receipt?.runId !== row.id || receipt.receipt?.digest !== row.accepted_digest) throw Error('Snapshot receipt binding mismatch');
    }
    return { ...summary, players: db.prepare('SELECT count(*) AS count FROM players').get().count,
      acceptedRuns: db.prepare("SELECT count(*) AS count FROM runs WHERE status='accepted'").get().count };
  } finally { db.close(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!process.argv[2]) throw Error('Usage: restore-check.mjs SNAPSHOT.sqlite');
  console.log(JSON.stringify(verifySnapshot(process.argv[2])));
}
