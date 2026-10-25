import { createStore, checkDatabase } from './store.mjs';
process.umask(0o077);
const store = createStore(process.env.LEADERBOARDS_DB ?? '/data/leaderboards.sqlite');
try { console.log(JSON.stringify(checkDatabase(store.db))); }
finally { store.close(); }
