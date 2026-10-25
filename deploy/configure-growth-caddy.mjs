import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function configureGrowthCaddy(source) {
  const start='# Magnet Sort growth API',end='# End Magnet Sort growth API';
  if(source.includes(start)||source.includes(end)) {
    if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Ambiguous growth marker');
    if(!source.includes('reverse_proxy magnet-sort-growth:8080'))throw Error('Unexpected existing growth route');
    return source;
  }
  const anchor='{$API_DOMAIN} {';
  if(source.split(anchor).length!==2)throw Error('Expected exactly one API host block');
  const block='\n    '+start+'\n    redir /magnet-sort-growth /magnet-sort-growth/ 308\n    handle_path /magnet-sort-growth/* {\n        header Cache-Control "no-store"\n        reverse_proxy magnet-sort-growth:8080\n    }\n    '+end+'\n';
  return source.replace(anchor,anchor+block);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=process.argv[2];if(!file)throw Error('Pass the active mounted Caddyfile path');
  const source=fs.readFileSync(file,'utf8'),next=configureGrowthCaddy(source);
  if(next===source)console.log('Growth API route already configured');
  else {
    const snapshot=file+'.before-growth-'+Date.now();fs.writeFileSync(snapshot,source,{flag:'wx'});
    if(fs.readFileSync(file,'utf8')!==source)throw Error('Caddyfile changed concurrently; nothing overwritten');
    // Keep the inode of the Docker bind-mounted file.
    fs.writeFileSync(file,next);
    console.log(JSON.stringify({backup:snapshot,sha256:createHash('sha256').update(next).digest('hex')}));
  }
}
