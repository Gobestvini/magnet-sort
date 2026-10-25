import { DatabaseSync, backup } from 'node:sqlite';
import {mkdirSync,chmodSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const output=resolve(process.argv[2]||('/backups/'+new Date().toISOString().replaceAll(':','-')));
const source=resolve(process.env.GROWTH_DATA_DIR||'/data');
if(output===source||source.startsWith(output+'/'))throw Error('Backup must be outside the source directory');
mkdirSync(output,{recursive:true,mode:0o700});
for(const name of ['telemetry.sqlite','commerce.sqlite']){
  const from=join(source,name),to=join(output,name);
  if(from===to)throw Error('Backup source overlap');
  const db=new DatabaseSync(from,{readOnly:true});
  try{await backup(db,to);}finally{db.close();}
  const copy=new DatabaseSync(to,{readOnly:true});
  try{if(copy.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Backup integrity failed');}
  finally{copy.close();}
  chmodSync(to,0o600);
}
writeFileSync(join(output,'verified.json'),JSON.stringify({databases:2,createdAt:new Date().toISOString()}),{mode:0o600});
console.log(JSON.stringify({verifiedDatabases:2,directory:output}));
