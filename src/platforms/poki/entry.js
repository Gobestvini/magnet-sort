import { startGame } from '../bootstrap.js';
import { createPokiPlatform } from './adapter.js';
const app = startGame(createPokiPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
