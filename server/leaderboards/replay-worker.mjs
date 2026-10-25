import { parentPort } from 'node:worker_threads';
import { replay } from './profiles.mjs';
parentPort.on('message', ({ id, payload }) => {
  try { parentPort.postMessage({ id, result: replay(payload) }); }
  catch (error) { parentPort.postMessage({ id, error: { status: error.status ?? 422, code: error.code ?? 'REPLAY_REJECTED' } }); }
});
parentPort.postMessage({ ready: true });
