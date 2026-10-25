import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {commerceError,verifyTelegramInitData,MAGNET_SORT_BOT_ID} from './telegram-auth.mjs';

export const COMMERCE_CATALOG=Object.freeze([Object.freeze({id:'supporter_aurora',title:'Aurora Supporter',description:'Permanent Aurora cosmetic frame. No gameplay advantage. Restore with the same Telegram account.',currency:'XTR',amount:50,entitlement:'supporter_aurora'})]);
const hash=value=>createHash('sha256').update(value).digest('hex');
const validString=(value,max=200)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);
const SESSION_TTL=86400000,ORDER_TTL=86400000,CHECKOUT_TTL=15*60*1000;

export function createCommerceService({dbPath=':memory:',botToken='',botId=MAGNET_SORT_BOT_ID,webhookSecret='',now=Date.now,fetch:request=globalThis.fetch,supportContact='support@plusvibegames.com'}={}) {
  if(botId!==MAGNET_SORT_BOT_ID)throw commerceError('wrong-bot-id',500);
  const enabled=Boolean(botToken.startsWith(botId+':')&&/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret));
  const db=new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS commerce_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS commerce_session_user ON commerce_sessions(user_id);
    CREATE TABLE IF NOT EXISTS commerce_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product_id TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,idempotency_key TEXT NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','paid','refunded')),invoice_url TEXT,UNIQUE(user_id,idempotency_key));
    CREATE TABLE IF NOT EXISTS commerce_charges(charge_id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES commerce_orders(id),user_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('paid','refunded')),created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_receipts(charge_id TEXT PRIMARY KEY,order_id TEXT,user_id TEXT NOT NULL,amount INTEGER,currency TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('paid','refunded')),disposition TEXT NOT NULL CHECK(disposition IN ('granted','duplicate','quarantined')),reason TEXT NOT NULL,refund_requested INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS commerce_receipts_order ON commerce_receipts(order_id);
    CREATE TABLE IF NOT EXISTS commerce_refund_events(event_key TEXT PRIMARY KEY,charge_id TEXT NOT NULL,user_id TEXT NOT NULL,amount INTEGER,currency TEXT NOT NULL,payload TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS commerce_checkouts(query_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,user_id TEXT NOT NULL,product_id TEXT NOT NULL,expires INTEGER NOT NULL,completed INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS commerce_orders_user ON commerce_orders(user_id);`);
  // Add a lossless canonical receipt ledger. Keep the earlier table untouched;
  // existing paid/refunded charges remain recoverable across this migration.
  db.exec(`INSERT OR IGNORE INTO commerce_receipts(charge_id,order_id,user_id,amount,currency,payload,status,disposition,reason,created)
    SELECT c.charge_id,c.order_id,c.user_id,o.amount,o.currency,o.id,c.status,'granted','legacy-migrated',c.created
    FROM commerce_charges c JOIN commerce_orders o ON o.id=c.order_id;`);
  const stmt=sql=>db.prepare(sql);
  function ensureEnabled(){if(!enabled)throw commerceError('commerce-unavailable',503);}
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
  function userFor(token){
    ensureEnabled();
    if(!validString(token,128)||!/^[a-f0-9]{64}$/.test(token))throw commerceError('session-invalid',401);
    const session=stmt('SELECT user_id,expires FROM commerce_sessions WHERE token_hash=?').get(hash(token));
    if(!session||session.expires<=now())throw commerceError('session-expired',401);
    return session.user_id;
  }
  function owned(user){return stmt("SELECT DISTINCT o.product_id FROM commerce_receipts r JOIN commerce_orders o ON o.id=r.order_id WHERE r.user_id=? AND r.status='paid' AND r.disposition='granted' ORDER BY o.product_id").all(user).map(row=>row.product_id);}
  async function bot(method,body){
    ensureEnabled();
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
    try {
      const response=await request('https://api.telegram.org/bot'+botToken+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal});
      const result=await response.json();
      if(!response.ok||result?.ok!==true)throw commerceError('telegram-api-unavailable',502);
      return result.result;
    } catch(error){if(error?.code==='telegram-api-unavailable')throw error;throw commerceError('telegram-api-unavailable',502);}
    finally{clearTimeout(timer);}
  }
  function authenticate(initData){
    ensureEnabled();const {userId}=verifyTelegramInitData(initData,{botToken,botId,now:now()});
    const token=randomBytes(32).toString('hex'),expiresAt=now()+SESSION_TTL;
    transaction(()=>{
      stmt('DELETE FROM commerce_sessions WHERE expires<=?').run(now());
      const prior=stmt('SELECT token_hash FROM commerce_sessions WHERE user_id=? ORDER BY created DESC,token_hash').all(userId);
      for(const row of prior.slice(9))stmt('DELETE FROM commerce_sessions WHERE token_hash=?').run(row.token_hash);
      stmt('INSERT INTO commerce_sessions VALUES(?,?,?,?)').run(hash(token),userId,expiresAt,now());
    });
    return {token,expiresAt};
  }
  async function createInvoice(token,productId,idempotencyKey){
    const user=userFor(token),product=COMMERCE_CATALOG.find(value=>value.id===productId);
    if(!product||!validString(idempotencyKey,100))throw commerceError('invalid-product-or-key');
    let order=transaction(()=>{
      const old=stmt('SELECT * FROM commerce_orders WHERE user_id=? AND idempotency_key=?').get(user,idempotencyKey);
      if(old){if(old.product_id!==productId)throw commerceError('idempotency-conflict',409);return old;}
      if(owned(user).includes(productId))throw commerceError('already-owned',409);
      // A cancelled invoice can be reopened, rather than creating simultaneous
      // payable invoices for the same permanent cosmetic.
      const pending=stmt("SELECT * FROM commerce_orders WHERE user_id=? AND product_id=? AND status='pending' AND created>? ORDER BY created DESC LIMIT 1").get(user,productId,now()-ORDER_TTL);
      if(pending)return pending;
      const id=randomUUID();stmt("INSERT INTO commerce_orders(id,user_id,product_id,amount,currency,idempotency_key,created,status) VALUES(?,?,?,?,?,?,?,'pending')").run(id,user,productId,product.amount,product.currency,idempotencyKey,now());
      return stmt('SELECT * FROM commerce_orders WHERE id=?').get(id);
    });
    if(order.status!=='pending'||now()-order.created>ORDER_TTL)throw commerceError('order-unavailable',409);
    if(!order.invoice_url){
      const url=await bot('createInvoiceLink',{title:product.title,description:product.description,payload:order.id,provider_token:'',currency:'XTR',prices:[{label:product.title,amount:product.amount}]});
      if(typeof url!=='string'||!/^https:\/\/(t\.me|telegram\.me)\//.test(url))throw commerceError('telegram-api-unavailable',502);
      stmt('UPDATE commerce_orders SET invoice_url=? WHERE id=? AND invoice_url IS NULL').run(url,order.id);
      order=stmt('SELECT * FROM commerce_orders WHERE id=?').get(order.id);
    }
    return {url:order.invoice_url,orderId:order.id,productId,currency:order.currency,amount:order.amount};
  }
  function secretValid(secret){
    if(typeof secret!=='string'||!enabled)return false;
    const received=Buffer.from(secret),expected=Buffer.from(webhookSecret);
    return received.length===expected.length&&timingSafeEqual(received,expected);
  }
  const matching=(order,user,payment)=>order&&order.user_id===String(user)&&payment?.currency===order.currency&&payment?.total_amount===order.amount&&payment?.invoice_payload===order.id;
  async function webhook(update,secret){
    ensureEnabled();if(!secretValid(secret))throw commerceError('webhook-unauthorized',401);
    if(!update||typeof update!=='object'||Array.isArray(update))throw commerceError('webhook-invalid');
    if(update.pre_checkout_query){
      const query=update.pre_checkout_query;
      if(!validString(query.id))throw commerceError('webhook-invalid');
      const ok=transaction(()=>{
        const order=validString(query.invoice_payload)?stmt('SELECT * FROM commerce_orders WHERE id=?').get(query.invoice_payload):null;
        if(!matching(order,query.from?.id,query)||order.status!=='pending'||now()-order.created>ORDER_TTL||owned(order.user_id).includes(order.product_id))return false;
        const same=stmt('SELECT * FROM commerce_checkouts WHERE query_id=?').get(query.id);
        if(same)return same.order_id===order.id&&same.user_id===order.user_id&&same.completed===0&&same.expires>now();
        const active=stmt('SELECT 1 FROM commerce_checkouts WHERE user_id=? AND product_id=? AND completed=0 AND expires>?').get(order.user_id,order.product_id,now());
        if(active)return false;
        stmt('INSERT INTO commerce_checkouts(query_id,order_id,user_id,product_id,expires) VALUES(?,?,?,?,?)').run(query.id,order.id,order.user_id,order.product_id,now()+CHECKOUT_TTL);
        return true;
      });
      await bot('answerPreCheckoutQuery',{pre_checkout_query_id:query.id,ok,...(!ok?{error_message:'This order is no longer available. Return to the shop and try again.'}:{})});
      return {ok:true,handled:true};
    }
    const message=update.message;
    if(message?.successful_payment){
      const payment=message.successful_payment;
      if(!validString(payment.telegram_payment_charge_id))throw commerceError('payment-charge-id-invalid');
      const recorded=transaction(()=>{
        const previous=stmt('SELECT * FROM commerce_receipts WHERE charge_id=?').get(payment.telegram_payment_charge_id);
        if(previous)return {ok:true,handled:true,duplicate:true,refundNeeded:previous.disposition==='duplicate'&&previous.status!=='refunded'};
        const payload=validString(payment.invoice_payload)?payment.invoice_payload:'',user=Number.isSafeInteger(message.from?.id)&&message.from.id>0?String(message.from.id):'';
        const amount=Number.isSafeInteger(payment.total_amount)&&payment.total_amount>0?payment.total_amount:null;
        const currency=validString(payment.currency,8)?payment.currency:'';
        const order=payload?stmt('SELECT * FROM commerce_orders WHERE id=?').get(payload):null;
        let disposition='quarantined',reason='invalid-receipt';
        if(user&&amount!==null&&currency&&payload){
          if(!order)reason='unknown-order';
          else if(order.user_id!==user)reason='payer-mismatch';
          else if(order.currency!==currency)reason='currency-mismatch';
          else if(order.amount!==amount)reason='amount-mismatch';
          else if(order.status!=='pending'||owned(user).includes(order.product_id)){
            disposition='duplicate';reason=order.status==='refunded'?'order-refunded':'duplicate-payment';
          }else{disposition='granted';reason='matching-payment';}
        }
        // Record money before granting or attempting refunds. A second charge
        // and an unknown/mismatched order must never disappear behind a 200 ack.
        stmt('INSERT INTO commerce_receipts(charge_id,order_id,user_id,amount,currency,payload,status,disposition,reason,created) VALUES(?,?,?,?,?,?,\'paid\',?,?,?)').run(payment.telegram_payment_charge_id,order?.id??null,user,amount,currency,payload,disposition,reason,now());
        if(disposition==='granted')stmt("UPDATE commerce_orders SET status='paid' WHERE id=?").run(order.id);
        if(order&&matching(order,message.from?.id,payment))stmt('UPDATE commerce_checkouts SET completed=1 WHERE order_id=?').run(order.id);
        return {ok:true,handled:true,...(disposition==='quarantined'?{quarantined:true}:{}),refundNeeded:disposition==='duplicate'};
      });
      if(recorded.refundNeeded){
        try{await refund(payment.telegram_payment_charge_id);return {...recorded,refundNeeded:false,refunded:true};}
        catch{return {...recorded,refundPending:true};}
      }
      return recorded;
    }
    if(message?.refunded_payment){
      const payment=message.refunded_payment;
      return transaction(()=>{
        const chargeId=validString(payment.telegram_payment_charge_id)?payment.telegram_payment_charge_id:'';
        const user=Number.isSafeInteger(message.from?.id)&&message.from.id>0?String(message.from.id):'';
        const amount=Number.isSafeInteger(payment.total_amount)&&payment.total_amount>0?payment.total_amount:null;
        const currency=validString(payment.currency,8)?payment.currency:'';
        const payload=validString(payment.invoice_payload)?payment.invoice_payload:'';
        const charge=chargeId?stmt('SELECT * FROM commerce_receipts WHERE charge_id=?').get(chargeId):null;
        const valid=Boolean(chargeId&&user&&amount!==null&&currency&&payload);
        const exact=charge&&charge.user_id===user&&charge.amount===amount&&charge.currency===currency&&charge.payload===payload;
        const reason=!valid?'incomplete-refund':charge?(exact?'matching-refund':'refund-metadata-mismatch'):'refund-before-payment';
        const key=hash(JSON.stringify([chargeId,user,amount,currency,payload]));
        stmt('INSERT OR IGNORE INTO commerce_refund_events VALUES(?,?,?,?,?,?,?,?)').run(key,chargeId,user,amount,currency,payload,reason,now());
        if(!chargeId)return {ok:true,handled:true,quarantined:true};
        if(!charge){
          const order=payload?stmt('SELECT * FROM commerce_orders WHERE id=?').get(payload):null;
          stmt("INSERT INTO commerce_receipts(charge_id,order_id,user_id,amount,currency,payload,status,disposition,reason,created) VALUES(?,?,?,?,?,?,'refunded','quarantined',?,?)").run(chargeId,order?.id??null,user,amount,currency,payload,reason,now());
          if(order&&matching(order,message.from?.id,payment))stmt("UPDATE commerce_orders SET status='refunded' WHERE id=?").run(order.id);
        }
        // A trusted refund is durable even when delivered before its payment.
        // Never regrant this charge when a delayed successful_payment arrives.
        markRefunded(chargeId);
        return {ok:true,handled:true,...(!valid||charge&&!exact?{quarantined:true}:{})};
      });
    }
    if(typeof message?.text==='string'&&/^\/paysupport(?:@\w+)?(?:\s|$)/.test(message.text)&&Number.isSafeInteger(message.chat?.id)){
      await bot('sendMessage',{chat_id:message.chat.id,text:'Magnet Sort purchase support: '+supportContact+'. Include your Telegram payment receipt. We handle purchase issues and refunds; Telegram support cannot resolve purchases from this game.'});
      return {ok:true,handled:true};
    }
    return {ok:true,handled:false};
  }
  function markRefunded(chargeId){
    const charge=stmt('SELECT * FROM commerce_receipts WHERE charge_id=?').get(chargeId);if(!charge)return false;
    stmt("UPDATE commerce_receipts SET status='refunded' WHERE charge_id=?").run(chargeId);
    stmt("UPDATE commerce_charges SET status='refunded' WHERE charge_id=?").run(chargeId);
    if(charge.disposition==='granted')stmt("UPDATE commerce_orders SET status='refunded' WHERE id=?").run(charge.order_id);return true;
  }
  function revoke(chargeId){return transaction(()=>markRefunded(chargeId));}
  const refundFlights=new Map();
  async function refund(chargeId){
    ensureEnabled();const charge=validString(chargeId)?stmt('SELECT * FROM commerce_receipts WHERE charge_id=?').get(chargeId):null;
    if(!charge)throw commerceError('charge-not-found',404);
    if(charge.status==='refunded')return {refunded:true,duplicate:true};
    if(charge.currency!=='XTR'||!/^\d+$/.test(charge.user_id)||!Number.isSafeInteger(Number(charge.user_id)))throw commerceError('receipt-requires-manual-review',409);
    if(refundFlights.has(chargeId))return refundFlights.get(chargeId);
    const flight=(async()=>{
      stmt('UPDATE commerce_receipts SET refund_requested=1 WHERE charge_id=?').run(chargeId);
      const result=await bot('refundStarPayment',{user_id:Number(charge.user_id),telegram_payment_charge_id:chargeId});
      if(result!==true)throw commerceError('refund-unconfirmed',502);
      revoke(chargeId);return {refunded:true};
    })();
    refundFlights.set(chargeId,flight);
    try{return await flight;}finally{refundFlights.delete(chargeId);}
  }
  function reconciliation({limit=100}={}){
    const count=Number.isSafeInteger(limit)?Math.max(1,Math.min(limit,100)):100;
    return stmt("SELECT charge_id AS chargeId,order_id AS orderId,user_id AS userId,amount,currency,disposition,reason,refund_requested AS refundRequested,created FROM commerce_receipts WHERE status='paid' AND (disposition!='granted' OR refund_requested=1) ORDER BY created,charge_id LIMIT ?").all(count);
  }
  async function reconcile({limit=20}={}){
    const count=Number.isSafeInteger(limit)?Math.max(1,Math.min(limit,100)):20;
    // Select automatic work before LIMIT. Older manual quarantines must not
    // starve a later duplicate charge waiting for its automatic refund.
    const pending=stmt("SELECT charge_id AS chargeId FROM commerce_receipts WHERE status='paid' AND (disposition='duplicate' OR refund_requested=1) ORDER BY created,charge_id LIMIT ?").all(count);
    let refunded=0,failed=0;
    for(const row of pending){try{await refund(row.chargeId);refunded++;}catch{failed++;}}
    return {refunded,failed,pending:reconciliation({limit:100}).length};
  }
  function refundAudit({limit=100}={}){
    const count=Number.isSafeInteger(limit)?Math.max(1,Math.min(limit,100)):100;
    return stmt('SELECT charge_id AS chargeId,user_id AS userId,amount,currency,payload,reason,created FROM commerce_refund_events ORDER BY created DESC,event_key LIMIT ?').all(count);
  }
  return {
    available:()=>enabled,
    authenticate,
    catalog:()=>({products:enabled?COMMERCE_CATALOG.map(value=>({...value})):[]}),
    entitlements:token=>({entitlements:owned(userFor(token))}),
    createInvoice,webhook,refund,reconciliation,reconcile,refundAudit,
    close(){db.close();}
  };
}
