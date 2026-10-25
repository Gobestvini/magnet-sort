const unavailable = reason => ({status:'unavailable',reason});
const completed = () => ({status:'completed',completed:true});
const cancelled = () => ({status:'cancelled',completed:false});

function callbackRequest(register, signal) {
  return new Promise(resolve => {
    let settled=false,cleanup=()=>{};
    const finish=result=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);cleanup();resolve(result);};
    const abort=()=>finish(unavailable('aborted'));
    if(signal?.aborted)return abort();
    signal?.addEventListener('abort',abort,{once:true});
    try {cleanup=register(finish)??cleanup;if(settled)cleanup();} catch {finish({status:'error',reason:'sdk-error'});}
  });
}

// SDKs are explicitly injected by a platform-specific bootstrap. Merely finding
// a similarly named window property never activates advertising.
export function createAdProvider({id='none',sdk,enabled=false,adMode='full',subscribe,controllers,interstitialType='next'}={}) {
  let disposed=false;
  const supported = kind => {
    if(!enabled||disposed||adMode!=='full')return false;
    if(id==='adsense-h5')return typeof sdk?.adBreak==='function';
    if(id==='crazygames')return typeof sdk?.ad?.requestAd==='function';
    if(id==='poki')return typeof sdk?.[kind==='rewarded'?'rewardedBreak':'commercialBreak']==='function';
    if(id==='yandex')return typeof sdk?.adv?.[kind==='rewarded'?'showRewardedVideo':'showFullscreenAdv']==='function';
    if(id==='playgama')return sdk?.advertisement?.[kind==='rewarded'?'isRewardedSupported':'isInterstitialSupported']===true&&typeof sdk?.advertisement?.on==='function'&&typeof sdk?.advertisement?.off==='function';
    if(id==='gamedistribution')return typeof sdk?.showAd==='function'&&typeof subscribe==='function';
    if(id==='gamepix')return typeof sdk?.ads?.[kind==='rewarded'?'reward':'interstitial']==='function';
    if(id==='adsgram')return typeof controllers?.[kind]?.show==='function';
    return false;
  };
  async function request(kind,placement,{signal}={}) {
    if(!['rewarded','interstitial'].includes(kind)||!supported(kind))return unavailable('provider-unavailable');
    if(signal?.aborted)return unavailable('aborted');
    if(id==='adsense-h5')return callbackRequest(finish=>{
      let viewed=false,dismissed=false,shown=false,promptStarted=false;
      sdk.adBreak({
        type:kind==='rewarded'?'reward':interstitialType==='start'?'start':'next',
        name:placement,
        beforeAd:()=>{shown=true;},
        // This request is reached only through the game's explicit watch-ad
        // button. Never call showAdFn from a timer or an automatic placement.
        ...(kind==='rewarded'?{
          beforeReward:showAdFn=>{if(!disposed&&!signal?.aborted&&!promptStarted&&typeof showAdFn==='function'){promptStarted=true;showAdFn();}},
          adViewed:()=>{viewed=true;},
          adDismissed:()=>{dismissed=true;}
        }:{}),
        adBreakDone:()=>finish(kind==='rewarded'?(viewed&&!dismissed?completed():dismissed?cancelled():unavailable('no-fill')):(shown?completed():unavailable('no-fill')))
      });
    },signal);
    if(id==='crazygames')return callbackRequest(finish=>{
      Promise.resolve(sdk.ad.requestAd(kind==='rewarded'?'rewarded':'midgame',{adFinished:()=>finish(completed()),adError:()=>finish(unavailable('no-fill'))})).catch(()=>finish(unavailable('no-fill')));
    },signal);
    if(id==='poki') {
      const result=await sdk[kind==='rewarded'?'rewardedBreak':'commercialBreak']();
      return kind==='interstitial'||result===true?completed():cancelled();
    }
    if(id==='yandex')return callbackRequest(finish=>{
      let rewarded=false;
      const callbacks={onRewarded:()=>{rewarded=true;},onClose:shown=>finish(kind==='rewarded'?(rewarded?completed():cancelled()):(shown?completed():unavailable('no-fill'))),onError:()=>finish(unavailable('no-fill'))};
      sdk.adv[kind==='rewarded'?'showRewardedVideo':'showFullscreenAdv']({callbacks});
    },signal);
    if(id==='playgama')return callbackRequest(finish=>{
      const ads=sdk.advertisement;
      const event=kind==='rewarded'?(sdk.EVENT_NAME?.REWARDED_STATE_CHANGED??'rewarded_state_changed'):(sdk.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED??'interstitial_state_changed');
      let rewarded=false;
      const listener=state=>{if(state==='rewarded')rewarded=true;if(state==='closed')finish(kind==='rewarded'?(rewarded?completed():cancelled()):completed());if(state==='failed')finish(unavailable('no-fill'));};
      ads.on(event,listener);
      ads[kind==='rewarded'?'showRewarded':'showInterstitial'](placement);
      return ()=>ads.off(event,listener);
    },signal);
    if(id==='gamedistribution')return callbackRequest(finish=>{
      let rewarded=false;
      const unsubscribe=subscribe(event=>{if(event?.name==='SDK_REWARDED_WATCH_COMPLETE')rewarded=true;if(event?.name==='SDK_GAME_START')finish(kind==='rewarded'?(rewarded?completed():cancelled()):completed());if(event?.name==='SDK_ERROR')finish(unavailable('no-fill'));});
      Promise.resolve(sdk.showAd(kind==='rewarded'?'rewarded':undefined)).then(()=>{
        // showAd resolution alone is not rewarded proof.
        finish(kind==='rewarded'?(rewarded?completed():cancelled()):completed());
      },()=>finish(unavailable('no-fill')));
      return unsubscribe;
    },signal);
    if(id==='gamepix') {
      const result=await sdk.ads[kind==='rewarded'?'reward':'interstitial']();
      return result?.success===true?completed():cancelled();
    }
    if(id==='adsgram') {
      try {const result=await controllers[kind].show();return result?.done===true&&result?.error!==true?completed():cancelled();}
      catch {return cancelled();}
    }
    return unavailable('unsupported');
  }
  return {id,capabilities:()=>({rewarded:supported('rewarded'),interstitial:supported('interstitial'),purchases:false}),request,dispose(){disposed=true;}};
}

export function combineProviders(adProvider,purchaseProvider) {
  return {
    id:purchaseProvider?.id??adProvider?.id??'none',
    providerFor:kind=>kind==='purchases'?(purchaseProvider?.id??'none'):(adProvider?.id??'none'),
    capabilities:()=>({...adProvider?.capabilities?.(),purchases:purchaseProvider?.capabilities?.().purchases===true}),
    request:(...args)=>adProvider?.request(...args)??Promise.resolve(unavailable('provider-unavailable')),
    products:(...args)=>purchaseProvider?.products(...args)??Promise.resolve([]),
    purchase:(...args)=>purchaseProvider?.purchase(...args)??Promise.resolve(unavailable('provider-unavailable')),
    entitlements:(...args)=>purchaseProvider?.entitlements(...args)??Promise.resolve([]),
    dispose(){adProvider?.dispose?.();purchaseProvider?.dispose?.();}
  };
}
