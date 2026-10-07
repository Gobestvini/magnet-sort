import clearAll from '../levels/prototype/prototype-01-clear-all.json' with { type: 'json' };
import clearCount from '../levels/prototype/prototype-02-clear-count.json' with { type: 'json' };
import blockerLesson from '../levels/prototype/prototype-03-blocker.json' with { type: 'json' };
import ftue01 from '../levels/ftue/ftue-01-place.json' with { type: 'json' };
import ftue02 from '../levels/ftue/ftue-02-pull.json' with { type: 'json' };
import ftue03 from '../levels/ftue/ftue-03-merge.json' with { type: 'json' };
import ftue04 from '../levels/ftue/ftue-04-color-choice.json' with { type: 'json' };
import ftue05 from '../levels/ftue/ftue-05-chain.json' with { type: 'json' };
import { allCells, cellId, isCell } from './hex.js';

const SUPPORTED_COLORS = new Set(['red', 'blue', 'yellow', 'green']);
const SUPPORTED_MODES = new Set(['campaign', 'challenge', 'daily', 'prototype']);

const PROTOTYPE_LEVELS = new Map([clearAll, clearCount, blockerLesson].map((level) => [level.puzzleId, level]));
const FTUE_LEVELS = new Map([ftue01, ftue02, ftue03, ftue04, ftue05].map((level) => [level.puzzleId, level]));

export function prototypeLevelIds() {
  return [...PROTOTYPE_LEVELS.keys()].sort(compareIds);
}

export function loadPrototypeLevel(puzzleId) {
  const level = PROTOTYPE_LEVELS.get(puzzleId);
  if (!level) throw new TypeError(`LevelDefinition ${String(puzzleId)}.puzzleId: unknown prototype level`);
  return validateLevelDefinition(level);
}

export function ftueLevelIds() {
  return [...FTUE_LEVELS.keys()].sort(compareIds);
}

export function loadFtueLevel(puzzleId) {
  const level = FTUE_LEVELS.get(puzzleId);
  if (!level) throw new TypeError(`LevelDefinition ${String(puzzleId)}.puzzleId: unknown FTUE level`);
  return validateLevelDefinition(level);
}

export function parseLevelDefinition(jsonText) {
  let parsed;
  try {
    if (typeof jsonText !== 'string') throw new TypeError('expected JSON text');
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const puzzleId = typeof jsonText === 'string' ? jsonText.match(/"puzzleId"\s*:\s*"([^"]+)"/)?.[1] ?? '<unknown>' : '<unknown>';
    throw new TypeError(`LevelDefinition ${puzzleId}.JSON: ${error.message}`);
  }
  return validateLevelDefinition(parsed);
}

export function validateLevelDefinition(level) {
  const puzzleId = typeof level?.puzzleId === 'string' && level.puzzleId.length > 0 ? level.puzzleId : '<unknown>';
  const fail = (field, message) => { throw new TypeError(`LevelDefinition ${puzzleId}.${field}: ${message}`); };

  if (!level || typeof level !== 'object' || Array.isArray(level)) fail('root', 'expected an object');
  if (level.schemaVersion !== 1) fail('schemaVersion', 'expected supported version 1');
  if (level.rulesVersion !== 1) fail('rulesVersion', 'expected supported version 1');
  if (typeof level.puzzleId !== 'string' || !level.puzzleId.trim()) fail('puzzleId', 'must be a non-empty string');
  if (typeof level.seed !== 'string' || !level.seed) fail('seed', 'must be a non-empty string');
  if (!Number.isInteger(level.contentVersion) || level.contentVersion < 1) fail('contentVersion', 'must be a positive integer');
  if (level.geometry?.kind !== 'odd-r' || level.geometry?.rows !== 7 || level.geometry?.cols !== 7) {
    fail('geometry', 'expected a 7x7 odd-r board');
  }
  if (!SUPPORTED_MODES.has(level.mode)) fail('mode', 'must be campaign, challenge, daily, or prototype');

  if (!Array.isArray(level.colors) || level.colors.length < 3 || level.colors.length > 4) {
    fail('colors', 'must contain 3 or 4 supported colors');
  }
  if (new Set(level.colors).size !== level.colors.length) fail('colors', 'values must be unique');
  for (const [index, color] of level.colors.entries()) {
    if (!SUPPORTED_COLORS.has(color)) fail(`colors[${index}]`, `unknown color ${String(color)}`);
  }

  if (!Array.isArray(level.blockedCells)) fail('blockedCells', 'expected an array');
  const occupied = new Set();
  for (const [index, cell] of level.blockedCells.entries()) {
    if (!isCell(cell)) fail(`blockedCells[${index}]`, 'coordinate must be inside the 7x7 board');
    const id = cellId(cell);
    if (occupied.has(id)) fail(`blockedCells[${index}]`, `duplicate cell ${id}`);
    occupied.add(id);
  }

  if (!Array.isArray(level.tokens) || level.tokens.length === 0) fail('tokens', 'expected at least one token');
  const tokenIds = new Set();
  for (const [index, token] of level.tokens.entries()) {
    const field = `tokens[${index}]`;
    if (!token || typeof token !== 'object') fail(field, 'expected an object');
    if (typeof token.tokenId !== 'string' || !token.tokenId.trim()) fail(`${field}.tokenId`, 'must be a non-empty string');
    if (tokenIds.has(token.tokenId)) fail(`${field}.tokenId`, `duplicate tokenId ${token.tokenId}`);
    tokenIds.add(token.tokenId);
    if (!level.colors.includes(token.color)) fail(`${field}.color`, `color ${String(token.color)} is not declared`);
    if (!Number.isInteger(token.mass) || token.mass <= 0) fail(`${field}.mass`, 'must be a positive integer');
    if (!isCell(token.cell)) fail(`${field}.cell`, 'coordinate must be inside the 7x7 board');
    const id = cellId(token.cell);
    if (occupied.has(id)) fail(`${field}.cell`, `cell ${id} is blocked or already occupied`);
    occupied.add(id);
  }

  if (!level.goal || !['clearCount', 'clearAll'].includes(level.goal.kind)) fail('goal', 'expected clearCount or clearAll');
  if (level.goal.kind === 'clearCount' && (!Number.isInteger(level.goal.mass) || level.goal.mass <= 0)) {
    fail('goal.mass', 'clearCount requires a positive integer mass');
  }
  if (level.goal.kind === 'clearAll' && Object.hasOwn(level.goal, 'mass')) fail('goal.mass', 'clearAll does not accept a mass threshold');
  if (level.moveLimit !== null && (!Number.isInteger(level.moveLimit) || level.moveLimit <= 0)) {
    fail('moveLimit', 'must be null or a positive integer');
  }
  if (!Array.isArray(level.magnetSchedule) || level.magnetSchedule.length === 0) fail('magnetSchedule', 'expected at least one turn entry');
  for (const [turn, entry] of level.magnetSchedule.entries()) {
    if (!entry || !Array.isArray(entry.options) || entry.options.length === 0) {
      fail(`magnetSchedule[${turn}].options`, 'expected at least one available color');
    }
    if (new Set(entry.options).size !== entry.options.length) fail(`magnetSchedule[${turn}].options`, 'values must be unique');
    for (const color of entry.options) {
      if (!level.colors.includes(color)) fail(`magnetSchedule[${turn}].options`, `unknown color ${String(color)}`);
    }
  }

  return normalizeLevel(level);
}

export function createLevelBoard(level) {
  const valid = validateLevelDefinition(level);
  return allCells({ blockedCells: valid.blockedCells, tokens: valid.tokens });
}

function normalizeLevel(level) {
  return {
    ...level,
    geometry: { ...level.geometry },
    colors: [...level.colors],
    blockedCells: level.blockedCells.map((cell) => ({ ...cell })).sort((a, b) => a.row - b.row || a.col - b.col),
    tokens: level.tokens
      .map((token) => ({ ...token, cell: { ...token.cell } }))
      .sort((a, b) => compareIds(a.tokenId, b.tokenId)),
    goal: { ...level.goal },
    magnetSchedule: level.magnetSchedule.map((entry) => ({ options: [...entry.options] })),
    ...(level.solution ? {
      solution: {
        actions: level.solution.actions.map((action) => ({ ...action, cell: { ...action.cell } })),
        expected: { ...level.solution.expected },
      },
    } : {}),
  };
}

function compareIds(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
