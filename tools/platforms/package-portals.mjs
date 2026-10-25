import { packageEmbed } from './package.mjs';
const output=process.argv[2]??('artifacts/portal-releases-'+Date.now());
for(const target of ['crazygames','poki','yandex','playgama','gamedistribution','gamepix']){
  const result=await packageEmbed({input:'dist/'+target,output:output+'/'+target,target});
  console.log(target+': '+result.zip.sha256+' '+result.zip.bytes+' bytes');
}
