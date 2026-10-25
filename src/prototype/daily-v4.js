import { DAILY_CATALOG } from './daily-catalog-v1.js';
import { DAILY_RULES, DAILY_PRESET_ID, DAILY_CONTENT_VERSION, DAILY_CATALOG_VERSION } from './daily-rules.js';
import { createAttempt, replayAttempt, MAX_ATTEMPT_ACTIONS } from './progress-v4.js';
import { createV4Session } from './session.js';

export { DAILY_CATALOG, DAILY_RULES, DAILY_PRESET_ID, DAILY_CONTENT_VERSION, DAILY_CATALOG_VERSION };
export const DAILY_V4_KEY = 'magnet-sort.v4.daily.v1';
const DAY=86400000, EPOCH=Date.UTC(2026,0,1), MAX_BYTES=512*1024;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
function dayNumber(date) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new TypeError('Invalid daily date');
  const millis=Date.parse(date+'T00:00:00.000Z');
  if(!Number.isFinite(millis)||new Date(millis).toISOString().slice(0,10)!==date)throw new TypeError('Invalid daily date');
  return Math.floor(millis/DAY);
}
export function getDaily(instant=new Date()) {
  const value=new Date(instant);
  if(!Number.isFinite(value.getTime()))throw new TypeError('Invalid daily instant');
  const date=value.toISOString().slice(0,10), delta=dayNumber(date)-EPOCH/DAY;
  const index=((delta%30)+30)%30;
  return {date,index,catalogVersion:DAILY_CATALOG_VERSION,...DAILY_CATALOG[index]};
}
export function createDailyAttempt(instant=new Date()) { return {...getDaily(instant),...createAttempt(getDaily(instant).levelId,getDaily(instant).seed)}; }
export function replayDailyAttempt(value) {
  if(!object(value))throw new TypeError('Invalid daily attempt');
  dayNumber(value.date);
  if(value.catalogVersion!==DAILY_CATALOG_VERSION||value.presetId!==DAILY_PRESET_ID||value.contentVersion!==DAILY_CONTENT_VERSION)
    throw new TypeError('Unsupported daily version');
  const descriptor=getDaily(value.date);
  if(value.levelId!==descriptor.levelId||value.seed!==descriptor.seed||value.index!==descriptor.index)throw new TypeError('Invalid daily board');
  const replay=replayAttempt(value,DAILY_RULES);
  return {attempt:{...descriptor,...replay.attempt},state:replay.state};
}
export function recordDailyResult(results, attempt, state, instant=new Date()) {
  const trim=value=>{
    const newest=Math.max(dayNumber(getDaily(instant).date),...Object.keys(value).map(dayNumber));
    return Object.fromEntries(Object.entries(value).filter(([key])=>newest-dayNumber(key)<90).sort(([a],[b])=>b.localeCompare(a)).slice(0,90));
  };
  if(!state.terminal)return trim(results);
  const date=attempt.date, category=attempt.assisted?'bestAssisted':'bestUnassisted', previous=results[date]?.[category];
  const candidate={outcome:state.terminal,moves:state.movesUsed,recordedAt:new Date(instant).toISOString()};
  const better=!previous||(candidate.outcome==='won'&&previous.outcome!=='won')||
    (candidate.outcome===previous.outcome&&candidate.moves<previous.moves);
  const next=better?{...results,[date]:{...results[date],[category]:candidate}}:{...results};
  return trim(next);
}
export function dailyCalendar(results, instant=new Date()) {
  const end=dayNumber(getDaily(instant).date);
  return Array.from({length:7},(_,index)=>{
    const date=new Date((end-6+index)*DAY).toISOString().slice(0,10),record=results[date];
    return {date,completed:Boolean(record&&(record.bestAssisted?.outcome==='won'||record.bestUnassisted?.outcome==='won'))};
  });
}
export function emptyDailyProgress() { return {schemaVersion:1,catalogVersion:DAILY_CATALOG_VERSION,revision:0,activeView:'campaign',campaignSelection:null,activeAttempt:null,results:{}}; }
export function normalizeDailyProgress(value) {
  if(!object(value)||value.schemaVersion!==1||value.catalogVersion!==DAILY_CATALOG_VERSION)throw new TypeError('Unsupported daily version');
  if(!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>=Number.MAX_SAFE_INTEGER||
    !['campaign','daily'].includes(value.activeView)||!(value.campaignSelection===null||typeof value.campaignSelection==='string')||
    !object(value.results)||Object.keys(value.results).length>90)throw new TypeError('Invalid daily progress');
  const active=value.activeAttempt===null?null:replayDailyAttempt(value.activeAttempt);
  if(value.activeView==='daily'&&!active)throw new TypeError('Invalid daily active view');
  const results={};
  for(const [date,record] of Object.entries(value.results)) {
    dayNumber(date);if(!object(record))throw new TypeError('Invalid daily result');results[date]={};
    for(const category of ['bestUnassisted','bestAssisted'])if(record[category]!==undefined){
      const best=record[category];
      if(!object(best)||!['won','lost'].includes(best.outcome)||!Number.isInteger(best.moves)||best.moves<1||best.moves>MAX_ATTEMPT_ACTIONS||
        typeof best.recordedAt!=='string'||!Number.isFinite(Date.parse(best.recordedAt)))throw new TypeError('Invalid daily result');
      results[date][category]={outcome:best.outcome,moves:best.moves,recordedAt:best.recordedAt};
    }
  }
  return {progress:{schemaVersion:1,catalogVersion:DAILY_CATALOG_VERSION,revision:value.revision,activeView:value.activeView,
    campaignSelection:value.campaignSelection,activeAttempt:active?.attempt??null,results},state:active?.state??null};
}
export function createDailyStore({storage,getStorage=()=>globalThis.localStorage}={}) {
  let target, expected=null, reason=null, loaded=null, failedLaunch=false;
  try{target=storage===undefined?getStorage():storage;if(!target)throw Error();expected=target.getItem(DAILY_V4_KEY);}catch{reason='storage-unavailable';}
  if(!reason&&expected!==null)try{
    if(typeof expected!=='string'||expected.length>MAX_BYTES)throw new TypeError('Invalid daily progress');
    const value=JSON.parse(expected);failedLaunch=value?.activeView==='daily';loaded=normalizeDailyProgress(value);
  }catch(error){reason=error.message.includes('Unsupported')?'unsupported-version':'invalid-data';}
  function checkConflict(){if(reason)return;try{if(target.getItem(DAILY_V4_KEY)!==expected)reason='conflict';}catch{reason='storage-unavailable';}}
  return {loaded,failedLaunch,get reason(){return reason;},status:()=>({saved:!reason,reason}),checkConflict,
    save(progress){checkConflict();if(reason)return false;try{const next={...progress,revision:progress.revision+1},raw=JSON.stringify(next);if(raw.length>MAX_BYTES){reason='action-limit';return false;}
      target.setItem(DAILY_V4_KEY,raw);expected=raw;progress.revision=next.revision;return true;
    }catch{reason='storage-write-failed';return false;}}
  };
}

// Mode owner: daily is a different rules/session owner, not a campaign replay.
// The campaign is read without entry-policy writes while daily is resumed.
export function createV4ModeSession({now=()=>new Date(),...options}={}) {
  const store=createDailyStore(options);let progress=store.loaded?.progress??emptyDailyProgress();
  const resume=options.fixedSeed==null&&progress.activeView==='daily'&&progress.activeAttempt;
  const campaign=createV4Session({...options,suspendedStartup:Boolean(options.suspendedStartup||resume||store.failedLaunch)});
  let daily=null,mode='campaign',dailyError=store.failedLaunch?store.reason:null,disposed=false;
  let descriptor=progress.activeAttempt?getDaily(progress.activeAttempt.date):null;
  function open(attempt){
    daily?.dispose();daily=createV4Session({newSeed:options.newSeed,fixedSeed:attempt.seed,rules:DAILY_RULES});
    daily.replaceAttempt(attempt);descriptor=getDaily(attempt.date);mode='daily';
  }
  if(resume)open(progress.activeAttempt);
  const owner=()=>mode==='daily'?daily:campaign;
  function persist(){
    if(mode==='daily') {
      progress={...progress,activeView:'daily',activeAttempt:{...descriptor,...daily.attempt},
        results:recordDailyResult(progress.results,{...descriptor,...daily.attempt},daily.state,now())};
    }
    if(!disposed)store.save(progress);
  }
  function dailyInfo(){return {mode,date:mode==='daily'?descriptor.date:null,today:getDaily(now()).date,
    entry:mode==='daily'?clone(descriptor):null,calendar:dailyCalendar(progress.results,now()),
    best:mode==='daily'?clone(progress.results[descriptor.date]??{}):null,status:store.status(),error:dailyError};}
  return {
    get mode(){return mode;},get daily(){return dailyInfo();},get rules(){return mode==='daily'?DAILY_RULES:options.rules;},
    get state(){return owner().state;},get attempt(){return owner().attempt;},get canUndo(){return owner().canUndo;},
    get progress(){return owner().progress;},get campaign(){return {state:clone(campaign.state),attempt:campaign.attempt};},
    get returnSelection(){return progress.campaignSelection;},
    status(){return mode==='daily'?store.status():campaign.status();},
    checkConflict(){store.checkConflict();campaign.checkConflict();},
    submit(action){const result=owner().submit(action);if(mode==='daily'&&result.accepted)persist();return result;},
    markAssisted(){const before=owner().attempt.assisted,result=owner().markAssisted();if(mode==='daily'&&result&&!before)persist();return result;},
    undo(){const result=owner().undo();if(mode==='daily'&&result.accepted)persist();return result;},
    start(index,seed){if(mode==='daily'){daily.start(daily.state.levelNumber-1,descriptor.seed);persist();return daily.state;}return campaign.start(index,seed);},
    enterDaily(selection=null){
      if(disposed||mode==='daily')return false;
      store.checkConflict();
      if(['invalid-data','unsupported-version','conflict'].includes(store.reason)){dailyError=store.reason;return false;}
      const today=getDaily(now()),attempt=progress.activeAttempt?.date===today.date?progress.activeAttempt:createDailyAttempt(now());
      progress={...progress,campaignSelection:selection,activeView:'daily'};open(attempt);dailyError=null;persist();return true;
    },
    returnCampaign(){
      if(disposed)return campaign.state;
      if(mode==='daily'){progress={...progress,activeView:'campaign',activeAttempt:{...descriptor,...daily.attempt}};daily.dispose();daily=null;mode='campaign';persist();}
      dailyError=null;return campaign.state;
    },
    recoverSave(){return mode==='campaign'&&campaign.recoverSave();},
    dispose(){disposed=true;campaign.dispose();daily?.dispose();}
  };
}
