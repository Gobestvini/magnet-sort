import { startGame } from './platforms/bootstrap.js';
import { createWebPlatform } from './platforms/web/adapter.js';
const app = startGame(createWebPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
