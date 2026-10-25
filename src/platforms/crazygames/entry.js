import { startGame } from '../bootstrap.js';
import { createCrazygamesPlatform } from './adapter.js';
const app = startGame(createCrazygamesPlatform());
if (import.meta.hot) import.meta.hot.dispose(app.dispose);
