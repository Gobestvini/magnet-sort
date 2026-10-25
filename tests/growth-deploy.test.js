import test from 'node:test';
import assert from 'node:assert/strict';
import {configureGrowthCaddy} from '../deploy/configure-growth-caddy.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pruneVerifiedBackups} from '../server/prune-backups.mjs';
test('growth routing is isolated, preserves other applications and is idempotent',()=>{
  const old='{$GAME_DOMAIN} {\n file_server\n}\n{$API_DOMAIN} {\n handle_path /carwars/* {\n reverse_proxy carwars:2577\n }\n reverse_proxy white-tower-help:8080\n}\n';
  const next=configureGrowthCaddy(old);
  assert.equal(next.includes('handle_path /magnet-sort-growth/*'),true);
  assert.equal(next.replace(/\n    # Magnet Sort growth API[\s\S]*?# End Magnet Sort growth API\n/,''),old);
  assert.equal(configureGrowthCaddy(next),next);
  assert.throws(()=>configureGrowthCaddy('no-host'),/API host/);
});
test('backup retention only removes verified owned directories and keeps recovery points',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'magnet-backups-'));
  try{
    fs.mkdirSync(path.join(root,'unrelated'));fs.writeFileSync(path.join(root,'unrelated','keep.txt'),'keep');
    for(let i=1;i<=12;i++){
      const dir=path.join(root,'202610'+String(i).padStart(2,'0')+'T000000Z');fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir,'verified.json'),JSON.stringify({databases:2,createdAt:'2026-10-'+String(i).padStart(2,'0')+'T00:00:00Z'}));
      fs.writeFileSync(path.join(dir,'telemetry.sqlite'),'fixture');fs.writeFileSync(path.join(dir,'commerce.sqlite'),'fixture');
    }
    const result=pruneVerifiedBackups(root,{now:Date.parse('2026-10-12T01:00:00Z')});
    assert.ok(result.remaining>=2&&result.remaining<=8);assert.equal(fs.readFileSync(path.join(root,'unrelated','keep.txt'),'utf8'),'keep');
    assert.equal(fs.existsSync(path.join(root,'20261012T000000Z')),true);
  }finally{
    const resolved=path.resolve(root);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
