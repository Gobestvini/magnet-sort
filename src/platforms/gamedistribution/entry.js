import { startGame } from '../bootstrap.js';
import { createGamedistributionPlatform } from './adapter.js';
const app = startGame(createGamedistributionPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
