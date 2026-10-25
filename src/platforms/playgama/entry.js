import { startGame } from '../bootstrap.js';
import { createPlaygamaPlatform } from './adapter.js';
const app = startGame(createPlaygamaPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
