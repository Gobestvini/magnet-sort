import { startGame } from '../bootstrap.js';
import { createGamepixPlatform } from './adapter.js';
const app = startGame(createGamepixPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
