import test from 'node:test';import assert from 'node:assert/strict';
import {setupTelegram,parseSetupArgs} from '../tools/platforms/telegram-setup.mjs';
const token='123456:PRIVATE_TEST_TOKEN', url='https://example.com/telegram/';
function fixture(){const calls=[];let menu={type:'commands'};return{calls,request:async(endpoint,options)=>{
 const parsed=new URL(endpoint),method=parsed.pathname.split('/').at(-1);calls.push(method);const body=Object.fromEntries(parsed.searchParams);assert.equal(options.method,'POST');
 if(method==='setChatMenuButton'){assert.equal(typeof body.menu_button,'string','Bot API expects a JSON-serialized menu_button parameter');menu=JSON.parse(body.menu_button);}
 return{ok:true,json:async()=>({ok:true,result:method==='getMe'?{is_bot:true,username:'ExampleGameBot'}:method==='setChatMenuButton'?true:menu})};
}};}
test('setup defaults to read-only check and applies once with verified read-back',async()=>{
 const f=fixture();const options={token,url,username:'@ExampleGameBot',request:f.request};
 assert.equal((await setupTelegram(options)).menuMatches,false);assert.deepEqual(f.calls,['getMe','getChatMenuButton']);
 const result=await setupTelegram({...options,mode:'apply'});assert.equal(result.changed,true);assert.equal(result.menuMatches,true);
 assert.deepEqual(f.calls.slice(2),['getMe','getChatMenuButton','setChatMenuButton','getChatMenuButton']);
 assert.equal((await setupTelegram({...options,mode:'apply'})).changed,false);
});
test('missing token, non-HTTPS URL and unknown bot cannot change settings',async()=>{
 const f=fixture(),options={token,url,username:'ExampleGameBot',mode:'apply',request:f.request};
 for(const patch of [{token:''},{url:'http://example.com/'},{url:'https://user:password@example.com/'},{url:'https://example.com/?secret=1'},{mode:'unknown'}])await assert.rejects(setupTelegram({...options,...patch}));
 assert.deepEqual(f.calls,[]);await assert.rejects(setupTelegram({...options,username:'DifferentBot'}),/mismatch/);assert.deepEqual(f.calls,['getMe']);
});
test('transport errors and timeouts redact tokens and read-back mismatch is reported',async()=>{
 const options={token,url,username:'ExampleGameBot'};
 for(const request of [async endpoint=>{throw Error(endpoint);},async()=>({ok:false,json:async()=>({description:token})}),async()=>({ok:true,json:async()=>({ok:false,description:token})})]){
  await assert.rejects(setupTelegram({...options,request}),error=>!error.message.includes(token)&&/withheld/.test(error.message));
 }
 await assert.rejects(setupTelegram({...options,timeoutMs:2,request:(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error(token))))}),/timed out/);
 await assert.rejects(setupTelegram({...options,mode:'apply',request:async endpoint=>({ok:true,json:async()=>({ok:true,result:new URL(endpoint).pathname.endsWith('getMe')?{is_bot:true,username:'ExampleGameBot'}:new URL(endpoint).pathname.endsWith('setChatMenuButton')?true:{type:'commands'}})})}),/read-back/);
});
test('CLI defaults to check and rejects missing/unknown arguments',()=>{
 assert.deepEqual(parseSetupArgs(['--username','ExampleGameBot','--url',url]),{mode:'check',username:'ExampleGameBot',url});
 assert.throws(()=>parseSetupArgs(['--token',token]),/Usage/);assert.throws(()=>parseSetupArgs(['--url']),/Usage/);
});
