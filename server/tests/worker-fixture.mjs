import { parentPort } from 'node:worker_threads';
parentPort.on('message', ({ id, payload }) => {
  if (payload.hang) return;
  setTimeout(() => parentPort.postMessage({ id, result: { fixture: payload.value } }), payload.delay ?? 0);
});
parentPort.postMessage({ ready: true });
