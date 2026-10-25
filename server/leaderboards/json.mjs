import { bad } from './config.mjs';

// JSON.parse alone accepts duplicate object names. Signed user data and HTTP
// bodies use this small bounded parser so there is one unambiguous meaning.
export function strictJson(source) {
  if (typeof source !== 'string') throw bad();
  let at = 0;
  const space = () => { while (/[\x20\t\r\n]/.test(source[at] ?? 'x')) at++; };
  function string() {
    const start = at++;
    while (at < source.length) {
      const char = source[at++];
      if (char === '\\') { at++; continue; }
      if (char === '"') {
        let value;
        try { value = JSON.parse(source.slice(start, at)); } catch { throw bad(); }
        if (!value.isWellFormed()) throw bad();
        return value;
      }
    }
    throw bad();
  }
  function value(depth) {
    if (depth > 32) throw bad();
    space(); const char = source[at];
    if (char === '"') return string();
    if (char === '{') {
      at++; const result = Object.create(null), names = new Set(); space();
      if (source[at] === '}') { at++; return result; }
      while (at < source.length) {
        space(); if (source[at] !== '"') throw bad();
        const key = string(); if (names.has(key)) throw bad('DUPLICATE_FIELD'); names.add(key);
        space(); if (source[at++] !== ':') throw bad(); result[key] = value(depth + 1); space();
        const close = source[at++]; if (close === '}') return result;
        if (close !== ',') throw bad();
      }
      throw bad();
    }
    if (char === '[') {
      at++; const result = []; space(); if (source[at] === ']') { at++; return result; }
      while (at < source.length) {
        result.push(value(depth + 1)); space(); const close = source[at++];
        if (close === ']') return result; if (close !== ',') throw bad();
      }
      throw bad();
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literal, at)) { at += literal.length; return result; }
    }
    const token = source.slice(at).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!token) throw bad();
    at += token[0].length; const result = Number(token[0]); if (!Number.isFinite(result)) throw bad(); return result;
  }
  const result = value(0); space(); if (at !== source.length) throw bad(); return result;
}
