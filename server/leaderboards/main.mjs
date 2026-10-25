import { createApp } from './http.mjs';
import { productionConfig } from './config.mjs';

const config = productionConfig();
process.umask(0o077);
const app = createApp({ ...config, logger: entry => console.log(JSON.stringify(entry)) });
try {
  await app.ready;
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(config.port, '0.0.0.0', () => { app.server.removeListener('error', reject); resolve(); });
  });
  console.log(JSON.stringify({ event: 'listening', port: config.port }));
} catch {
  await app.close(); console.error('Leaderboards startup validation failed'); process.exitCode = 1;
}
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await app.close(); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
