import './viewport.css';
import { startGame } from '../bootstrap.js';
import { createTelegramPlatform } from './adapter.js';
const app = startGame(createTelegramPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
