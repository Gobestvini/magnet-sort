import {createHmac,timingSafeEqual} from 'node:crypto';

export const MAGNET_SORT_BOT_ID='8820798959';
export function commerceError(code,status=400) {const error=new Error(code);error.code=code;error.status=status;return error;}

// Telegram's bot-token HMAC method. All received fields except hash remain in
// the signed data, including future/unknown fields. Decode exactly once.
export function verifyTelegramInitData(initData,{botToken,botId=MAGNET_SORT_BOT_ID,now=Date.now()}={}) {
  const invalid=()=>{throw commerceError('telegram-auth-invalid',401);};
  if(typeof botToken!=='string'||!botToken.startsWith(botId+':')||botId!==MAGNET_SORT_BOT_ID)invalid();
  if(typeof initData!=='string'||initData.length===0||initData.length>16384)invalid();
  const fields=new Map();
  try {
    for(const part of initData.split('&')){
      const split=part.indexOf('=');if(split<1)invalid();
      const decode=value=>decodeURIComponent(value.replace(/\+/g,' '));
      const key=decode(part.slice(0,split)),value=decode(part.slice(split+1));
      if(fields.has(key)||/[\u0000\r\n]/.test(key))invalid();
      fields.set(key,value);
    }
  } catch {invalid();}
  const hash=fields.get('hash');fields.delete('hash');
  if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))invalid();
  const check=[...fields].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>key+'='+value).join('\n');
  const key=createHmac('sha256','WebAppData').update(botToken).digest();
  const expected=createHmac('sha256',key).update(check).digest();
  if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))invalid();
  const dateText=fields.get('auth_date');
  if(!/^\d{1,12}$/.test(dateText??''))invalid();
  const date=Number(dateText),seconds=Math.floor(now/1000);
  if(!Number.isSafeInteger(date)||seconds-date>300||date-seconds>30)throw commerceError('telegram-launch-expired',401);
  let user;
  try{user=JSON.parse(fields.get('user')??'null');}catch{invalid();}
  if(!user||!Number.isSafeInteger(user.id)||user.id<=0)invalid();
  return {userId:String(user.id)};
}
