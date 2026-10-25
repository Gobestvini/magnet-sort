export function createTelegramStarsProvider({endpoint='',bridge,fetch:request=globalThis.fetch,enabled=false,id=()=>crypto.randomUUID(),pollDelay=500,pollAttempts=12,readTimeoutMs=8000}={}) {
  let token='',disposed=false;
  const inFlight=new Set();
  const base=endpoint.replace(/\/$/,'');
  const supported=()=>enabled&&!disposed&&/^https:\/\//.test(base)&&typeof bridge?.initData==='string'&&Boolean(bridge.initData)&&typeof bridge?.openInvoice==='function'&&typeof request==='function';
  async function call(path,body,signal,auth=true) {
    if(!supported())throw new Error('Unavailable');
    const abort=new AbortController();inFlight.add(abort);
    const cancelled=()=>{const error=new Error('Request cancelled');error.name='AbortError';return error;};
    const forwardAbort=()=>abort.abort();
    if(signal?.aborted)abort.abort();else signal?.addEventListener('abort',forwardAbort,{once:true});
    let abortListener;
    const timer=setTimeout(()=>abort.abort(),readTimeoutMs);
    try {
      return await Promise.race([
        (async()=>{
          if(abort.signal.aborted)throw cancelled();
          if(auth&&!token){const login=await call('/commerce/auth',{initData:bridge.initData},abort.signal,false);if(disposed||abort.signal.aborted)throw cancelled();token=login.token;}
          const result=await request(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},credentials:'omit',body:body?JSON.stringify(body):undefined,signal:abort.signal});
          if(disposed||abort.signal.aborted)throw cancelled();
          if(!result.ok){
            if(result.status===401){token='';const error=new Error('Reopen Magnet Sort from Telegram to restore purchases.');error.code='reopen-telegram';throw error;}
            throw new Error('Service unavailable');
          }
          return result.json();
        })(),
        new Promise((_,reject)=>{abortListener=()=>reject(cancelled());if(abort.signal.aborted)abortListener();else abort.signal.addEventListener('abort',abortListener,{once:true});})
      ]);
    } finally {clearTimeout(timer);abort.signal.removeEventListener('abort',abortListener);signal?.removeEventListener('abort',forwardAbort);inFlight.delete(abort);abort.abort();}
  }
  // Accept the former direct AbortSignal signature as well as the shared read options.
  const signalFrom=options=>options&&typeof options.addEventListener==='function'?options:options?.signal;
  const entitlements=async options=>{const value=await call('/commerce/entitlements',null,signalFrom(options));if(!Array.isArray(value.entitlements))throw new Error('Invalid entitlements');return value.entitlements;};
  return {
    id:'telegram',capabilities:()=>({rewarded:false,interstitial:false,purchases:supported()}),
    async products(options){const value=await call('/commerce/catalog',null,signalFrom(options),false);if(!Array.isArray(value.products))throw new Error('Invalid catalog');return value.products;},
    entitlements,
    async purchase(productId,{signal}={}) {
      if(!supported())return {status:'unavailable'};
      const invoice=await call('/commerce/invoice',{productId,idempotencyKey:id()},signal);
      if(typeof invoice.url!=='string'||!/^https:\/\/(t\.me|telegram\.me)\//.test(invoice.url))return {status:'error',reason:'invalid-invoice'};
      const status=await new Promise(resolve=>{
        let done=false;
        const finish=value=>{if(done)return;done=true;signal?.removeEventListener('abort',cancel);resolve(value);};
        const cancel=()=>finish('cancelled');
        if(signal?.aborted)return cancel();
        signal?.addEventListener('abort',cancel,{once:true});
        try{bridge.openInvoice(invoice.url,finish);}catch{finish('failed');}
      });
      if(status==='cancelled')return {status:'cancelled'};
      if(!['paid','pending'].includes(status))return {status:'error',reason:'invoice-failed'};
      // UI callback may race the webhook. Only the server can grant the right.
      for(let attempt=0;attempt<pollAttempts&&!disposed&&!signal?.aborted;attempt++){
        const owned=await entitlements(signal);
        if(owned.includes(productId))return {status:'completed',entitlements:owned};
        await new Promise(resolve=>{
          const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};
          const timer=setTimeout(finish,pollDelay);signal?.addEventListener('abort',finish,{once:true});
        });
      }
      return {status:'pending',reason:'awaiting-server'};
    },
    dispose(){disposed=true;token='';for(const abort of inFlight)abort.abort();}
  };
}
