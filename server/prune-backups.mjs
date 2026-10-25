import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function pruneVerifiedBackups(directory,{now=Date.now(),maxCount=8,maxBytes=2*1024**3}={}){
  const root=path.resolve(directory);
  if(root===path.parse(root).root||fs.lstatSync(root).isSymbolicLink())throw Error('Unsafe backup root');
  const allowed=new Set(['telemetry.sqlite','commerce.sqlite','verified.json','telemetry.sqlite-wal','telemetry.sqlite-shm','commerce.sqlite-wal','commerce.sqlite-shm']);
  const entries=[];
  for(const name of fs.readdirSync(root)){
    if(!/^\d{8}T\d{6}Z$/.test(name))continue;
    const target=path.resolve(root,name),relative=path.relative(root,target);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Backup outside root');
    const stat=fs.lstatSync(target);if(!stat.isDirectory()||stat.isSymbolicLink())continue;
    const files=fs.readdirSync(target);
    if(!files.includes('verified.json')||files.some(file=>!allowed.has(file)||!fs.lstatSync(path.join(target,file)).isFile()||fs.lstatSync(path.join(target,file)).isSymbolicLink()))continue;
    let stamp;try{stamp=JSON.parse(fs.readFileSync(path.join(target,'verified.json'),'utf8'));}catch{continue;}
    const created=Date.parse(stamp.createdAt);
    if(stamp.databases!==2||!Number.isFinite(created))continue;
    entries.push({target,files,created,bytes:files.reduce((sum,file)=>sum+fs.statSync(path.join(target,file)).size,0)});
  }
  entries.sort((a,b)=>a.created-b.created);
  let total=entries.reduce((sum,item)=>sum+item.bytes,0),remaining=entries.length,removed=0;
  for(const item of entries){
    // Preserve two verified recovery points even when alerting about capacity.
    if(remaining<=2)break;
    if(remaining>maxCount||total>maxBytes||item.created<now-2*86400000){
      for(const file of item.files)fs.unlinkSync(path.join(item.target,file));
      fs.rmdirSync(item.target);remaining--;total-=item.bytes;removed++;
    }
  }
  return {removed,remaining,bytes:total,overLimit:total>maxBytes};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=pruneVerifiedBackups('/backups');console.log(JSON.stringify(result));if(result.overLimit)process.exitCode=1;
}
