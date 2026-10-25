import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createCommerceService} from '../server/commerce.mjs';
import {verifyTelegramInitData} from '../server/telegram-auth.mjs';

const TOKEN='8820798959:FAKE_TEST_TOKEN_NOT_A_SECRET',SECRET='test_webhook_secret_0123456789',NOW=Date.UTC(2026,9,25,12);
function signed({user=12,date=Math.floor(NOW/1000),extra=''}={}){
  const values=new URLSearchParams({auth_date:String(date),query_id:'query',user:JSON.stringify({id:user,first_name:'Player'})});
  if(extra)values.set('future_field',extra);
  const data=[...values].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>key+'='+value).join('\n');
  const key=createHmac('sha256','WebAppData').update(TOKEN).digest();values.set('hash',createHmac('sha256',key).update(data).digest('hex'));return values.toString();
}
function setup(t,options={}){
  const calls=[];
  const service=createCommerceService({botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW,fetch:async(url,{body})=>{const method=url.split('/').at(-1);calls.push({method,body:JSON.parse(body)});return {ok:true,json:async()=>({ok:true,result:method==='createInvoiceLink'?'https://t.me/$test':true})};},...options});
  t.after(()=>service.close());return {service,calls,token:service.authenticate(signed()).token};
}
function paid(order,{user=12,amount=50,charge='charge-1',currency='XTR'}={}){return {update_id:1,message:{from:{id:user},successful_payment:{invoice_payload:order.orderId,currency,total_amount:amount,telegram_payment_charge_id:charge}}};}

test('auth rejects forged, stale, malformed, duplicate and wrong-bot launch data',()=>{
  assert.equal(verifyTelegramInitData(signed({extra:'signed future value'}),{botToken:TOKEN,now:NOW}).userId,'12');
  for(const value of [signed().replace('query_id=query','query_id=forged'),signed({date:Math.floor(NOW/1000)-301}),signed({date:Math.floor(NOW/1000)+31}),signed()+'&auth_date=1',signed()+'&bad=%FF','user=%ZZ',signed({user:-1})])assert.throws(()=>verifyTelegramInitData(value,{botToken:TOKEN,now:NOW}));
  assert.throws(()=>verifyTelegramInitData(signed(),{botToken:'999:wrong',now:NOW}));
});

test('no configuration disables catalog and payments',t=>{
  const service=createCommerceService();t.after(()=>service.close());assert.equal(service.available(),false);assert.deepEqual(service.catalog(),{products:[]});assert.throws(()=>service.authenticate(signed()),{status:503});
});

test('one pending invoice per account/product and no client-controlled price',async t=>{
  const {service,calls,token}=setup(t);
  const first=await service.createInvoice(token,'supporter_aurora','key-1'),again=await service.createInvoice(token,'supporter_aurora','key-1'),newClick=await service.createInvoice(token,'supporter_aurora','key-2');
  assert.equal(first.orderId,again.orderId);assert.equal(first.orderId,newClick.orderId);assert.equal(calls.filter(value=>value.method==='createInvoiceLink').length,1);
  assert.deepEqual(calls[0].body.prices,[{label:'Aurora Supporter',amount:50}]);assert.equal(calls[0].body.currency,'XTR');
  await assert.rejects(service.createInvoice(token,'forged','key-3'),{status:400});
  assert.deepEqual(service.entitlements(token),{entitlements:[]});
});

test('pre-checkout rejects another user, changed amount and unavailable orders',async t=>{
  const {service,calls,token}=setup(t),order=await service.createInvoice(token,'supporter_aurora','key-1');
  for(const [user,amount,expected] of [[13,50,false],[12,51,false],[12,50,true]]){
    await service.webhook({pre_checkout_query:{id:'pre-'+user+'-'+amount,from:{id:user},invoice_payload:order.orderId,currency:'XTR',total_amount:amount}},SECRET);
    assert.equal(calls.at(-1).body.ok,expected);
  }
  await assert.rejects(service.webhook({pre_checkout_query:{}},'wrong'),{status:401});
});

test('only a matching successful payment grants, duplicate delivery is idempotent',async t=>{
  const {service,token}=setup(t),order=await service.createInvoice(token,'supporter_aurora','key');
  for(const [index,values] of [{user:13},{amount:1},{currency:'USD'}].entries()){
    const result=await service.webhook(paid(order,{...values,charge:'quarantined-'+index}),SECRET);
    assert.equal(result.handled,true);assert.equal(result.quarantined,true);assert.deepEqual(service.entitlements(token).entitlements,[]);
  }
  assert.equal(service.reconciliation().length,3);
  assert.equal((await service.webhook(paid(order),SECRET)).handled,true);
  assert.deepEqual(service.entitlements(token).entitlements,['supporter_aurora']);
  assert.equal((await service.webhook(paid(order),SECRET)).duplicate,true);
  await assert.rejects(service.createInvoice(token,'supporter_aurora','new-key'),{status:409});
  assert.equal((await service.webhook(paid(order,{charge:'second-charge'}),SECRET)).refunded,true);
  assert.deepEqual(service.entitlements(token).entitlements,['supporter_aurora']);
});

test('concurrent pre-checkouts reserve account/product once; same query retries are idempotent',async t=>{
  const {service,calls,token}=setup(t),order=await service.createInvoice(token,'supporter_aurora','key');
  const checkout=id=>service.webhook({pre_checkout_query:{id,from:{id:12},invoice_payload:order.orderId,currency:'XTR',total_amount:50}},SECRET);
  await Promise.all([checkout('query-one'),checkout('query-two')]);
  assert.deepEqual(calls.filter(row=>row.method==='answerPreCheckoutQuery').map(row=>row.body.ok),[true,false]);
  await checkout('query-one');assert.equal(calls.at(-1).body.ok,true);
  await service.webhook(paid(order),SECRET);await checkout('query-one');assert.equal(calls.at(-1).body.ok,false);
});

test('every matching charge is recorded; duplicate payment refunds independently of the granted receipt',async t=>{
  const {service,calls,token}=setup(t),order=await service.createInvoice(token,'supporter_aurora','key');
  await service.webhook(paid(order),SECRET);
  const second=await service.webhook(paid(order,{charge:'charge-two'}),SECRET);
  assert.equal(second.handled,true);assert.equal(second.refunded,true);
  assert.deepEqual(service.entitlements(token).entitlements,['supporter_aurora']);
  assert.deepEqual(await service.refund('charge-two'),{refunded:true,duplicate:true});
  assert.equal(calls.filter(row=>row.method==='refundStarPayment'&&row.body.telegram_payment_charge_id==='charge-two').length,1);
  await service.refund('charge-1');assert.deepEqual(service.entitlements(token).entitlements,[]);
});

test('failed automatic duplicate refund stays in durable reconciliation and can be retried',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'magnet-reconciliation-')),dbPath=join(directory,'commerce.sqlite');
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  let fail=true;
  const request=async url=>({ok:!(fail&&url.endsWith('/refundStarPayment')),json:async()=>({ok:!(fail&&url.endsWith('/refundStarPayment')),result:url.endsWith('/createInvoiceLink')?'https://t.me/$test':true})});
  const first=createCommerceService({dbPath,botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW,fetch:request});
  const token=first.authenticate(signed()).token,order=await first.createInvoice(token,'supporter_aurora','key');
  await first.webhook(paid(order),SECRET);
  assert.equal((await first.webhook(paid(order,{charge:'charge-two'}),SECRET)).refundPending,true);
  assert.equal(first.reconciliation()[0].chargeId,'charge-two');first.close();
  const second=createCommerceService({dbPath,botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW,fetch:request});
  try{
    assert.equal(second.reconciliation()[0].refundRequested,1);fail=false;
    assert.deepEqual(await second.reconcile(),{refunded:1,failed:0,pending:0});
    assert.deepEqual(second.entitlements(second.authenticate(signed()).token).entitlements,['supporter_aurora']);
  }finally{second.close();}
});

test('manual quarantine rows do not starve automatic duplicate refunds',async t=>{
  let fail=false;
  const {service,token}=setup(t,{fetch:async url=>({ok:!fail,json:async()=>({ok:!fail,result:url.endsWith('/createInvoiceLink')?'https://t.me/$test':true})})});
  for(let index=0;index<20;index++)await service.webhook(paid({orderId:'unknown-'+index},{charge:'unknown-charge-'+index}),SECRET);
  const order=await service.createInvoice(token,'supporter_aurora','key');await service.webhook(paid(order),SECRET);fail=true;
  assert.equal((await service.webhook(paid(order,{charge:'zz-duplicate'}),SECRET)).refundPending,true);
  fail=false;const result=await service.reconcile({limit:20});assert.equal(result.refunded,1);assert.equal(result.failed,0);
  assert.equal(service.reconciliation().filter(row=>row.chargeId==='zz-duplicate').length,0);
  assert.deepEqual(service.entitlements(token).entitlements,['supporter_aurora']);
});

test('refund delivered before successful payment persists a tombstone across restart',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'magnet-refund-first-')),dbPath=join(directory,'commerce.sqlite');
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const options={dbPath,botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW,fetch:async()=>({ok:true,json:async()=>({ok:true,result:'https://t.me/$test'})})};
  const first=createCommerceService(options),token=first.authenticate(signed()).token;
  const order=await first.createInvoice(token,'supporter_aurora','key'),receipt=paid(order).message.successful_payment;
  const refundFirst=await first.webhook({message:{from:{id:12},refunded_payment:receipt}},SECRET);
  assert.equal(refundFirst.handled,true);assert.deepEqual(first.entitlements(token).entitlements,[]);
  assert.equal(first.refundAudit()[0].reason,'refund-before-payment');first.close();
  const second=createCommerceService(options);
  try{
    assert.equal((await second.webhook(paid(order),SECRET)).duplicate,true);
    const restored=second.authenticate(signed()).token;assert.deepEqual(second.entitlements(restored).entitlements,[]);
    assert.deepEqual(await second.refund('charge-1'),{refunded:true,duplicate:true});
  }finally{second.close();}
});

test('incomplete and unknown refund notifications remain in audit and block their late charge',async t=>{
  const {service,token}=setup(t),order=await service.createInvoice(token,'supporter_aurora','key');
  assert.equal((await service.webhook({message:{refunded_payment:{telegram_payment_charge_id:'charge-1'}}},SECRET)).quarantined,true);
  await service.webhook(paid(order),SECRET);assert.deepEqual(service.entitlements(token).entitlements,[]);
  assert.equal(service.refundAudit()[0].reason,'incomplete-refund');
  assert.equal((await service.webhook({message:{refunded_payment:{}}},SECRET)).quarantined,true);
  assert.equal(service.refundAudit().length,2);
});

test('unknown signed payment is quarantined and remains refundable by its real charge',async t=>{
  const {service,token}=setup(t);
  const result=await service.webhook(paid({orderId:'unknown-order'},{charge:'unknown-charge'}),SECRET);
  assert.equal(result.quarantined,true);assert.equal(service.reconciliation()[0].reason,'unknown-order');
  assert.deepEqual(service.entitlements(token).entitlements,[]);
  assert.equal((await service.refund('unknown-charge')).refunded,true);assert.deepEqual(service.reconciliation(),[]);
});

test('checkout reservation expires, but delayed genuine successful payments are never dropped',async t=>{
  let time=NOW;const {service,calls,token}=setup(t,{now:()=>time}),order=await service.createInvoice(token,'supporter_aurora','key');
  const checkout=id=>service.webhook({pre_checkout_query:{id,from:{id:12},invoice_payload:order.orderId,currency:'XTR',total_amount:50}},SECRET);
  await checkout('query-old');time+=15*60*1000+1;
  await checkout('query-new');assert.equal(calls.at(-1).body.ok,true);
  time+=86400000;
  assert.equal((await service.webhook(paid(order),SECRET)).handled,true);
  const restored=service.authenticate(signed({date:Math.floor(time/1000)})).token;
  assert.deepEqual(service.entitlements(restored).entitlements,['supporter_aurora']);
  assert.equal((await service.webhook(paid(order,{charge:'delayed-second'}),SECRET)).refunded,true);
  assert.deepEqual(service.entitlements(restored).entitlements,['supporter_aurora']);
});

test('refund calls Telegram once, revokes and cannot be replayed into ownership',async t=>{
  const {service,calls,token}=setup(t),order=await service.createInvoice(token,'supporter_aurora','key');await service.webhook(paid(order),SECRET);
  assert.equal((await service.refund('charge-1')).refunded,true);assert.deepEqual(service.entitlements(token).entitlements,[]);
  assert.equal((await service.refund('charge-1')).duplicate,true);assert.equal(calls.filter(value=>value.method==='refundStarPayment').length,1);
  await service.webhook(paid(order),SECRET);assert.deepEqual(service.entitlements(token).entitlements,[]);
});

test('failed refund preserves ownership; authenticated charge refund revokes and audits metadata mismatch',async t=>{
  let failRefund=false;
  const {service,token}=setup(t,{fetch:async(url)=>({ok:!failRefund,json:async()=>({ok:!failRefund,result:url.endsWith('/createInvoiceLink')?'https://t.me/$test':true})})});
  const order=await service.createInvoice(token,'supporter_aurora','key');await service.webhook(paid(order),SECRET);failRefund=true;
  await assert.rejects(service.refund('charge-1'),{status:502});assert.deepEqual(service.entitlements(token).entitlements,['supporter_aurora']);
  const receipt={...paid(order).message.successful_payment};
  assert.equal((await service.webhook({message:{from:{id:99},refunded_payment:receipt}},SECRET)).quarantined,true);
  assert.deepEqual(service.entitlements(token).entitlements,[]);
  assert.equal(service.refundAudit()[0].reason,'refund-metadata-mismatch');
  assert.equal((await service.webhook({message:{from:{id:12},refunded_payment:receipt}},SECRET)).handled,true);
  assert.deepEqual(service.entitlements(token).entitlements,[]);
});

test('ownership restores from the same signed account across database restart',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'magnet-commerce-test-')),dbPath=join(directory,'commerce.sqlite');
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const first=createCommerceService({dbPath,botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW,fetch:async()=>({ok:true,json:async()=>({ok:true,result:'https://t.me/$test'})})});
  const token=first.authenticate(signed()).token,order=await first.createInvoice(token,'supporter_aurora','key');await first.webhook(paid(order),SECRET);first.close();
  const second=createCommerceService({dbPath,botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW});
  try{assert.deepEqual(second.entitlements(second.authenticate(signed()).token).entitlements,['supporter_aurora']);assert.deepEqual(second.entitlements(second.authenticate(signed({user:13})).token).entitlements,[]);}finally{second.close();}
});

test('legacy payment ledger migrates without losing paid rights or refund history',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'magnet-commerce-migration-')),dbPath=join(directory,'commerce.sqlite');
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const legacy=new DatabaseSync(dbPath);
  legacy.exec(`CREATE TABLE commerce_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product_id TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,idempotency_key TEXT NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL,invoice_url TEXT,UNIQUE(user_id,idempotency_key));
    CREATE TABLE commerce_charges(charge_id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES commerce_orders(id),user_id TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL);`);
  legacy.prepare("INSERT INTO commerce_orders VALUES('old-order','12','supporter_aurora',50,'XTR','old-key',?,'paid','https://t.me/$old')").run(NOW);
  legacy.prepare("INSERT INTO commerce_charges VALUES('old-charge','old-order','12','paid',?)").run(NOW);legacy.close();
  const options={dbPath,botToken:TOKEN,webhookSecret:SECRET,now:()=>NOW,fetch:async()=>({ok:true,json:async()=>({ok:true,result:true})})};
  const service=createCommerceService(options);
  try{const token=service.authenticate(signed()).token;assert.deepEqual(service.entitlements(token).entitlements,['supporter_aurora']);await service.refund('old-charge');assert.deepEqual(service.entitlements(token).entitlements,[]);}finally{service.close();}
  const reopened=createCommerceService(options);
  try{assert.deepEqual(reopened.entitlements(reopened.authenticate(signed()).token).entitlements,[]);assert.equal((await reopened.refund('old-charge')).duplicate,true);}finally{reopened.close();}
});

test('expired service session cannot inspect ownership; unrelated updates acknowledged',async t=>{
  let time=NOW;const {service,token}=setup(t,{now:()=>time});time+=86400001;
  assert.throws(()=>service.entitlements(token),{status:401});assert.deepEqual(await service.webhook({message:{text:'/start'}},SECRET),{ok:true,handled:false});
});

test('paysupport replies only to the incoming support command',async t=>{
  const {service,calls}=setup(t);
  await service.webhook({message:{text:'/paysupport',chat:{id:12}}},SECRET);
  assert.equal(calls.at(-1).method,'sendMessage');assert.equal(calls.at(-1).body.chat_id,12);assert.match(calls.at(-1).body.text,/support@plusvibegames.com/);
  const count=calls.length;await service.webhook({message:{text:'hello',chat:{id:12}}},SECRET);assert.equal(calls.length,count);
});
