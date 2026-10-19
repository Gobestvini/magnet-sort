import { startGame } from '../bootstrap.js';
import { createEmbedPlatform } from './adapter.js';
const app = startGame(createEmbedPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
