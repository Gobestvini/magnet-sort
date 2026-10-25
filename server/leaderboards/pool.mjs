import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ApiError, LIMITS } from './config.mjs';

export function createReplayPool({ size = LIMITS.workers, maxQueue = LIMITS.queue, activeMs = LIMITS.replayMs,
  operationMs = LIMITS.operationMs, workerUrl = new URL('./replay-worker.mjs', import.meta.url) } = {}) {
  let closed = false, startupComplete = false;
  const queue = [], slots = new Set(), terminations = new Set();
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  void ready.catch(() => {});
  function finish(job, error, value) {
    if (job.done) return;
    job.done = true; clearTimeout(job.deadlineTimer); clearTimeout(job.activeTimer);
    job.signal?.removeEventListener('abort', job.abort);
    if (error) job.reject(error); else job.resolve(value);
  }
  function terminate(slot) {
    if (slot.removed) return;
    slot.removed = true; slots.delete(slot); clearTimeout(slot.startTimer);
    const promise = slot.worker.terminate().catch(() => {}).finally(() => terminations.delete(promise)); terminations.add(promise);
  }
  function fail(slot, error) {
    if (slot.removed) return;
    if (slot.job) finish(slot.job, error);
    terminate(slot);
    if (!closed) {
      if (slot.failures >= 3) {
        rejectReady(Error('Replay worker failed to initialize'));
        if (!slots.size) for (const job of queue.splice(0)) finish(job, new ApiError(503, 'WORKER_UNAVAILABLE', true, 1));
      } else spawn(slot.online ? 0 : slot.failures + 1);
      pump();
    }
  }
  function dispatch(slot, job) {
    slot.job = job; job.slot = slot;
    job.activeTimer = setTimeout(() => fail(slot, new ApiError(504, 'REPLAY_TIMEOUT', true)), activeMs);
    slot.worker.postMessage({ id: job.id, payload: job.payload });
  }
  function pump() {
    if (closed) return;
    for (const slot of slots) {
      if (!slot.online || slot.job) continue;
      let job; do { job = queue.shift(); } while (job?.done);
      if (!job) break;
      if (performance.now() >= job.deadline) { finish(job, new ApiError(504, 'OPERATION_TIMEOUT', true)); continue; }
      dispatch(slot, job);
    }
  }
  function spawn(failures = 0) {
    if (closed) return;
    // The host test runtime can expand non-worker flags into execArgv. Workers
    // need no CLI flags and must not inherit a test runner/debug entry point.
    const slot = { worker: new Worker(workerUrl, { execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } }), online: false, job: null, removed: false, failures };
    slots.add(slot);
    slot.startTimer = setTimeout(() => fail(slot, new ApiError(503, 'WORKER_UNAVAILABLE', true, 1)), 5000);
    slot.worker.on('message', message => {
      if (slot.removed || closed) return;
      if (message.ready === true) {
        slot.online = true; clearTimeout(slot.startTimer);
        if (!startupComplete && slots.size === size && [...slots].every(item => item.online)) { startupComplete = true; resolveReady(); }
        pump(); return;
      }
      const job = slot.job;
      if (!job || message.id !== job.id) return;
      slot.job = null; slot.failures = 0;
      if (message.error) finish(job, new ApiError(message.error.status, message.error.code)); else finish(job, null, message.result);
      pump();
    });
    slot.worker.on('error', () => fail(slot, new ApiError(503, 'WORKER_UNAVAILABLE', true, 1)));
    slot.worker.on('exit', () => fail(slot, new ApiError(503, 'WORKER_UNAVAILABLE', true, 1)));
  }
  for (let i = 0; i < size; i++) spawn();
  return {
    ready,
    get healthy() { return !closed && slots.size === size && [...slots].every(slot => slot.online && !slot.removed); },
    get stats() { return { active: [...slots].filter(slot => slot.job).length, queued: queue.filter(job => !job.done).length, workers: slots.size }; },
    run(payload, { signal } = {}) {
      if (closed) return Promise.reject(new ApiError(503, 'SERVICE_CLOSING', true, 1));
      if (signal?.aborted) return Promise.reject(new ApiError(499, 'REQUEST_ABORTED'));
      if (queue.filter(job => !job.done).length >= maxQueue && ![...slots].some(slot => slot.online && !slot.job)) return Promise.reject(new ApiError(503, 'REPLAY_QUEUE_FULL', true, 1));
      return new Promise((resolve, reject) => {
        const job = { id: randomUUID(), payload, resolve, reject, done: false, deadline: performance.now() + operationMs, signal };
        job.abort = () => {
          if (job.done) return;
          if (job.slot?.job === job) fail(job.slot, new ApiError(499, 'REQUEST_ABORTED'));
          else { const index = queue.indexOf(job); if (index !== -1) queue.splice(index, 1); finish(job, new ApiError(499, 'REQUEST_ABORTED')); }
        };
        signal?.addEventListener('abort', job.abort, { once: true });
        job.deadlineTimer = setTimeout(() => {
          if (job.done) return;
          if (job.slot && job.slot.job === job) fail(job.slot, new ApiError(504, 'OPERATION_TIMEOUT', true));
          else { const at = queue.indexOf(job); if (at !== -1) queue.splice(at, 1); finish(job, new ApiError(504, 'OPERATION_TIMEOUT', true)); }
        }, operationMs);
        queue.push(job); pump();
      });
    },
    async close() {
      if (!closed) {
        closed = true; rejectReady(Error('Replay pool closed'));
        for (const job of queue.splice(0)) finish(job, new ApiError(503, 'SERVICE_CLOSING', true, 1));
        for (const slot of [...slots]) { if (slot.job) finish(slot.job, new ApiError(503, 'SERVICE_CLOSING', true, 1)); terminate(slot); }
      }
      await Promise.all([...terminations]);
    }
  };
}
