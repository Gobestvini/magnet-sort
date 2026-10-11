import fs from 'node:fs';
import assert from 'node:assert/strict';
import { progressiveLevels } from '../src/prototype/progressive-levels.js';
import { analyzeLevel } from './v3-level-search.mjs';
const evidence=progressiveLevels.map(level=>{
  const report=analyzeLevel(level);
  assert.equal(report.witnesses.length,3,level.id);
  assert.ok(report.branch && report.differentRoutes,level.id);
  assert.ok(report.winningFirst>=2 && report.losingFirst>0,level.id);
  return {id:level.id,...report};
});
fs.writeFileSync('docs/design/v3-level-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log(evidence.map(r=>`${r.id}: min=${r.min}, winning=${r.winningFirst}/${r.usefulFirst}, losing=${r.losingFirst}, states=${r.visited}, ${r.milliseconds}ms`).join('\n'));
