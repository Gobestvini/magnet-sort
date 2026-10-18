import { createLoadingShell } from './loading/shell.js';

const shell = createLoadingShell();
let runtime;
async function start() {
  await shell.ready;
  runtime = await import('./prototype/runtime.js');
  if (!await runtime.startRuntime(shell.setProgress)) throw new Error('Game startup failed');
  await shell.finish();
  shell.reveal();
}
void start().catch(() => { runtime?.dispose(); shell.fail(); });
if (import.meta.hot) import.meta.hot.dispose(() => { shell.dispose(); runtime?.dispose(); });
