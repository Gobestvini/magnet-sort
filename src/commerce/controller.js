// SDK completion is an opportunity to grant a non-financial game reward. It is
// never proof of a purchase; paid rights always come from the server ledger.
export function createCommerce({provider, getContext = () => null, onPause = () => {}, onEvent = () => {}, timeoutMs = 120000, readTimeoutMs = 8000} = {}) {
  let disposed = false, busy = false, currentAbort;
  let verifiedEntitlements = [], verificationVersion = 0;
  const readAborts = new Set();
  const capabilities = () => disposed ? {provider:provider?.id ?? 'none',rewarded:false,interstitial:false,purchases:false} :
    {provider:provider?.id ?? 'none',rewarded:false,interstitial:false,purchases:false,...provider?.capabilities?.()};
  function emit(name, values) { try { onEvent(name, values); } catch { /* telemetry must not block play */ } }
  const contextKey = () => JSON.stringify(getContext());
  async function read(execute) {
    if(disposed)return {status:'error',reason:'disposed'};
    if(!capabilities().purchases)return {status:'error',reason:'provider-unavailable'};
    const abort=new AbortController();readAborts.add(abort);
    let timer,abortListener;
    try {
      const result=await Promise.race([
        Promise.resolve().then(()=>execute(abort.signal)).then(value=>({status:'ok',value})),
        new Promise(resolve=>{abortListener=()=>resolve({status:'error',reason:disposed?'disposed':'aborted'});abort.signal.addEventListener('abort',abortListener,{once:true});}),
        new Promise(resolve=>{timer=setTimeout(()=>{resolve({status:'error',reason:'timeout'});abort.abort();},readTimeoutMs);})
      ]);
      return disposed?{status:'error',reason:'disposed'}:result;
    } catch(error) {
      return {status:'error',reason:error?.code==='reopen-telegram'?'reopen-telegram':'provider-error'};
    } finally {
      clearTimeout(timer);abort.signal.removeEventListener('abort',abortListener);readAborts.delete(abort);abort.abort();
    }
  }
  async function verifyEntitlements() {
    const version=++verificationVersion;
    const result=await read(signal=>provider.entitlements({signal}));
    if(version!==verificationVersion)return {status:'error',reason:'superseded'};
    if(result.status!=='ok')return result;
    if(!Array.isArray(result.value)||result.value.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)))
      return {status:'error',reason:'invalid-provider-result'};
    verifiedEntitlements=[...new Set(result.value)];
    return {status:'ok',entitlements:[...verifiedEntitlements]};
  }
  async function run(kind, placement, execute) {
    if (disposed) return {status:'unavailable',reason:'disposed'};
    if (busy) return {status:'busy'};
    if (!capabilities()[kind]) return {status:'unavailable',reason:'provider-unavailable'};
    if (typeof placement !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(placement)) return {status:'unavailable',reason:'invalid-placement'};
    const context = contextKey(), abort = new AbortController();
    currentAbort = abort; busy = true;
    const isAd = kind !== 'purchases';
    const providerId=provider.providerFor?.(kind)??provider.id;
    if (isAd) onPause(true);
    emit(isAd ? 'ms_ad_started' : 'ms_purchase_started',{provider:providerId,placement,kind});
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => execute(abort.signal)),
        new Promise(resolve=>abort.signal.addEventListener('abort',()=>resolve({status:'unavailable',reason:'aborted'}),{once:true})),
        new Promise(resolve => {timer=setTimeout(() => {resolve({status:'error',reason:'timeout'});abort.abort();},timeoutMs);})
      ]);
      if (disposed || abort.signal.aborted && result?.reason !== 'timeout') return {status:'unavailable',reason:'disposed'};
      if (contextKey() !== context) return {status:'stale'};
      const valid = ['completed','cancelled','unavailable','error','pending'].includes(result?.status) ? result : {status:'error',reason:'invalid-provider-result'};
      emit(valid.status==='completed' ? (isAd?'ms_ad_completed':'ms_purchase_completed') : (isAd?'ms_ad_failed':'ms_purchase_failed'),{provider:providerId,placement,kind,outcome:valid.status});
      return valid;
    } catch(error) { emit(isAd?'ms_ad_failed':'ms_purchase_failed',{provider:providerId,placement,kind,outcome:'error'}); return error?.code==='reopen-telegram'?{status:'unavailable',reason:'reopen-telegram'}:{status:'error',reason:'provider-error'}; }
    finally {clearTimeout(timer);abort.abort();currentAbort=null;busy=false;if(isAd)onPause(false);}
  }
  return {
    capabilities,
    rewarded: placement => run('rewarded',placement,signal=>provider.request('rewarded',placement,{signal})),
    interstitial: placement => run('interstitial',placement,signal=>provider.request('interstitial',placement,{signal})),
    async products() { const result=await read(signal=>provider.products({signal}));return result.status==='ok'&&Array.isArray(result.value)?result.value:[]; },
    purchase: id => run('purchases',id,signal=>provider.purchase(id,{signal})),
    verifyEntitlements,
    async refreshEntitlements() {const result=await verifyEntitlements();return result.status==='ok'?result.entitlements:[...verifiedEntitlements];},
    snapshot:()=>({busy,disposed}),
    dispose(){disposed=true;currentAbort?.abort();for(const abort of readAborts)abort.abort();verifiedEntitlements=[];provider?.dispose?.();}
  };
}
