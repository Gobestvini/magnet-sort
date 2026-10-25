import { createAdProvider } from './providers.js';
import { ADS_ENABLED } from '../growth/config.js';
export function loadAdScript(url, {attributes={},timeoutMs=10_000}={}) {
  return new Promise((resolve,reject)=>{
    const node=document.createElement('script');node.async=true;node.src=url;
    for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);
    const done=error=>{clearTimeout(timer);node.onload=node.onerror=null;if(error){node.remove();reject(error);}else resolve();};
    const timer=setTimeout(()=>done(Error('Ad SDK unavailable')),timeoutMs);
    node.onload=()=>done();node.onerror=()=>done(Error('Ad SDK unavailable'));document.head.append(node);
  });
}
export async function createConfiguredAds(target,{load=loadAdScript,scope=globalThis,enabled=ADS_ENABLED,
  publisherId=import.meta.env?.VITE_ADSENSE_PUBLISHER_ID??'',
  rewardedBlock=import.meta.env?.VITE_ADSGRAM_REWARDED_BLOCK_ID??'',
  interstitialBlock=import.meta.env?.VITE_ADSGRAM_INTERSTITIAL_BLOCK_ID??''}={}) {
  if(!enabled)return undefined;
  if(target==='web'&&/^ca-pub-\d{16}$/.test(publisherId)){
    scope.adsbygoogle??=[];
    scope.adBreak=scope.adConfig=function(config){scope.adsbygoogle.push(config);};
    try{
      await load('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+publisherId,{attributes:{crossorigin:'anonymous'}});
      scope.adConfig({preloadAdBreaks:'on'});
      return createAdProvider({id:'adsense-h5',sdk:{adBreak:scope.adBreak,adConfig:scope.adConfig},enabled:true});
    }catch{return undefined;}
  }
  if(target==='telegram'&&(rewardedBlock||interstitialBlock)){
    try{
      await load('https://sad.adsgram.ai/js/sad.min.js');
      const controllers={};
      if(rewardedBlock)controllers.rewarded=scope.Adsgram?.init({blockId:rewardedBlock});
      if(interstitialBlock)controllers.interstitial=scope.Adsgram?.init({blockId:interstitialBlock});
      return createAdProvider({id:'adsgram',controllers,enabled:true});
    }catch{return undefined;}
  }
  return undefined;
}
