import { startGame } from '../bootstrap.js';
import { createYandexPlatform } from './adapter.js';
const app = startGame(createYandexPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
