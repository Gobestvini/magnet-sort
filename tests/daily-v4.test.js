import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getDaily,createDailyAttempt,replayDailyAttempt,recordDailyResult,dailyCalendar,emptyDailyProgress,normalizeDailyProgress,
  createDailyStore,createV4ModeSession,DAILY_RULES,DAILY_V4_KEY as KEY,DAILY_CATALOG_VERSION} from '../src/prototype/daily-v4.js';
import {PROGRESS_V4_KEY as CAMPAIGN_KEY,createAttempt,emptyProgress} from '../src/prototype/progress-v4.js';
import {createV4State} from '../src/prototype/model-v4.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {canPlaceMagnet} from '../src/prototype/model.js';
import {findV4Hint} from '../src/prototype/hint-v4.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const fixed='2026-01-01T12:00:00.000Z';
const session=(storage,now=()=>new Date(fixed))=>createV4ModeSession({storage,newSeed:()=>0,now});
const action=state=>{const hint=findV4Hint(state);return {type:'placeMagnet',color:hint?.color??state.magnets[0],cell:hint?.cell??state.cells.find(c=>canPlaceMagnet(state,c))};};
const witnesses=JSON.parse(readFileSync(new URL('../tools/fixtures/daily-v4-witnesses.json',import.meta.url)));
const witnessEntries=()=>witnesses.entries??witnesses.witnesses;

test('UTC dates are stable across timezone offsets, DST, epoch and negative modulo',()=>{
 assert.equal(getDaily('2026-01-01T00:00:00Z').index,0);
 assert.equal(getDaily('2025-12-31T23:59:59.999Z').index,29);
 assert.equal(getDaily('2026-01-31T00:00:00Z').index,0);
 assert.deepEqual(getDaily('2026-03-29T03:30:00+02:00'),getDaily('2026-03-29T01:30:00Z'));
 assert.deepEqual(getDaily('2026-10-25T02:30:00+01:00'),getDaily('2026-10-24T21:30:00-04:00'));
 assert.throws(()=>getDaily('invalid'));assert.throws(()=>replayDailyAttempt({...createDailyAttempt(fixed),date:'2026-02-30'}));
});

test('all thirty catalog dates replay approved B witnesses; campaign goals remain A',()=>{
 for(const row of witnessEntries()){
  const date=new Date(Date.UTC(2026,0,1+row.index)),attempt={...createDailyAttempt(date),actions:row.actions};
  const {state}=replayDailyAttempt(attempt);assert.equal(state.terminal,'won');assert.equal(state.goal,30+10*state.levelNumber);
  assert.equal(state.movesUsed,row.moves);assert.equal(createV4State(v4Levels[state.levelNumber-1],state.seed).goal,50*state.levelNumber);
 }
});

test('daily entry, actions, Hint, Undo, Retry, Return and reload preserve exact campaign envelope and selection/history',()=>{
 const storage=memory(),s=session(storage);s.submit(action(s.state));const campaign=s.campaign,raw=storage.getItem(CAMPAIGN_KEY),selection=s.state.magnets.at(-1);
 assert(s.enterDaily(selection));assert.equal(s.mode,'daily');assert.equal(s.state.goal,40);assert.equal(s.enterDaily('blue'),false);
 const initial=structuredClone(s.state);s.submit(action(s.state));s.markAssisted();assert(s.undo().accepted);assert.deepEqual(s.state,initial);assert(s.attempt.assisted);
 const dailyRaw=storage.getItem(KEY),resumed=session(storage);assert.equal(resumed.mode,'daily');assert(resumed.attempt.assisted);assert.deepEqual(resumed.state,initial);
 assert.equal(storage.getItem(KEY),dailyRaw);assert.equal(storage.getItem(CAMPAIGN_KEY),raw);assert.deepEqual(resumed.campaign,campaign);
 assert.equal(resumed.returnSelection,selection);resumed.returnCampaign();assert.equal(resumed.mode,'campaign');assert.deepEqual(resumed.campaign,campaign);assert.equal(storage.getItem(CAMPAIGN_KEY),raw);
 assert(resumed.canUndo);assert(resumed.undo().accepted);assert.equal(resumed.state.turn,0);
 assert(resumed.enterDaily(null));resumed.start(11,0xffffffff);assert.equal(resumed.state.levelNumber,1);assert.equal(resumed.state.seed,0);assert.equal(resumed.attempt.assisted,false);
});

test('daily midnight is pinned until voluntary exit/entry, including reload; no campaign advancement after daily victory',()=>{
 let instant='2026-01-01T23:59:59Z';const storage=memory(),now=()=>new Date(instant),s=session(storage,now);s.enterDaily('blue');
 const initial=structuredClone(s.state);instant='2026-01-02T00:00:00Z';assert.equal(s.daily.date,'2026-01-01');assert.equal(s.daily.today,'2026-01-02');assert.deepEqual(s.state,initial);
 const loaded=session(storage,now);assert.equal(loaded.daily.date,'2026-01-01');assert.deepEqual(loaded.state,initial);
 const raw=storage.getItem(CAMPAIGN_KEY),w=witnessEntries()[0];for(const a of w.actions)assert(loaded.submit(a).accepted);
 assert.equal(loaded.state.terminal,'won');assert.equal(loaded.campaign.state.turn,0);assert.equal(storage.getItem(CAMPAIGN_KEY),raw);
 assert.equal(loaded.daily.calendar.find(c=>c.date==='2026-01-01').completed,true);
 const wonReload=session(storage,now);assert.equal(wonReload.mode,'daily');assert.equal(wonReload.state.terminal,'won');assert.equal(storage.getItem(CAMPAIGN_KEY),raw);
 wonReload.returnCampaign();assert.equal(wonReload.state.puzzleId,'magnet-v4-01');assert(wonReload.enterDaily(null));assert.equal(wonReload.daily.date,'2026-01-02');assert.equal(wonReload.state.seed,1);
});

test('a won campaign is suspended on daily reload without advancing or rewriting its envelope',()=>{
 const storage=memory();const legacy=JSON.parse(readFileSync(new URL('../tools/fixtures/v4-progression-witnesses.json',import.meta.url))).find(w=>w.number===1);
 const active={...createAttempt(v4Levels[0].id,legacy.seed),actions:legacy.actions};storage.setItem(CAMPAIGN_KEY,JSON.stringify(emptyProgress(active)));
 // Construct an ordinary session suspended explicitly through daily startup.
 const daily={...emptyDailyProgress(),activeView:'daily',activeAttempt:createDailyAttempt(fixed)};storage.setItem(KEY,JSON.stringify(daily));const raw=storage.getItem(CAMPAIGN_KEY);
 const s=session(storage);assert.equal(s.campaign.state.terminal,'won');assert.equal(s.campaign.state.puzzleId,'magnet-v4-01');assert.equal(storage.getItem(CAMPAIGN_KEY),raw);
 s.returnCampaign();assert.equal(s.state.terminal,'won');assert.equal(storage.getItem(CAMPAIGN_KEY),raw);
});

test('local best separates assistance, prefers wins then fewer moves, keeps existing ties and counts one completion per date',()=>{
 const attempt=createDailyAttempt(fixed),won=moves=>({terminal:'won',movesUsed:moves}),lost=moves=>({terminal:'lost',movesUsed:moves});
 let results=recordDailyResult({},attempt,lost(2),fixed);results=recordDailyResult(results,attempt,won(9),fixed);
 results=recordDailyResult(results,attempt,lost(1),'2026-01-01T13:00:00Z');assert.equal(results[attempt.date].bestUnassisted.moves,9);
 results=recordDailyResult(results,attempt,won(7),'2026-01-01T14:00:00Z');const first=results[attempt.date].bestUnassisted;
 results=recordDailyResult(results,attempt,won(7),'2026-01-01T15:00:00Z');assert.deepEqual(results[attempt.date].bestUnassisted,first);
 results=recordDailyResult(results,{...attempt,assisted:true},won(3),fixed);assert.equal(results[attempt.date].bestAssisted.moves,3);assert.equal(results[attempt.date].bestUnassisted.moves,7);
 assert.equal(dailyCalendar(results,fixed).filter(day=>day.completed).length,1);
 for(let day=0;day<100;day++){const date=new Date(Date.UTC(2026,0,1+day));results=recordDailyResult(results,createDailyAttempt(date),won(4),date);}
 assert.equal(Object.keys(results).length,90);assert.equal(Object.keys(results).includes('2026-01-01'),false);assert.equal(dailyCalendar(results,'2026-04-10').length,7);
 assert.deepEqual(recordDailyResult(results,createDailyAttempt('2026-08-01'),{terminal:null},'2026-08-01'),{},'an unfinished entry after a long absence also expires old history');
});

test('corrupt/unknown/mismatched daily boards are retained, show an issue and never replace campaign or another seed',()=>{
 for(const mutate of [p=>({...p,catalogVersion:'future'}),p=>({...p,activeAttempt:{...p.activeAttempt,contentVersion:'future'}}),
  p=>({...p,activeAttempt:{...p.activeAttempt,seed:99}}),p=>({...p,activeAttempt:{...p.activeAttempt,date:'2026-02-30'}})]){
  const storage=memory(),s=session(storage);s.enterDaily(null);const raw=JSON.stringify(mutate(JSON.parse(storage.getItem(KEY))));storage.setItem(KEY,raw);
  const campaignRaw=storage.getItem(CAMPAIGN_KEY),loaded=session(storage);assert.equal(loaded.mode,'campaign');assert(loaded.daily.error);assert.equal(loaded.enterDaily(null),false);
  loaded.returnCampaign();assert.equal(loaded.daily.error,null);assert.equal(storage.getItem(KEY),raw);assert.equal(storage.getItem(CAMPAIGN_KEY),campaignRaw);
 }
 const storage=memory();storage.setItem(KEY,'{broken');const s=session(storage);assert.equal(s.enterDaily(null),false);assert.equal(storage.getItem(KEY),'{broken');
 assert.throws(()=>normalizeDailyProgress({...emptyDailyProgress(),revision:-1}));assert.throws(()=>normalizeDailyProgress({...emptyDailyProgress(),activeView:'daily'}));
});

test('concurrent daily writers and campaign writers are detected without overwriting newer values',()=>{
 const storage=memory(),s=session(storage);s.enterDaily(null);const second=session(storage);second.submit(action(second.state));const newer=storage.getItem(KEY);
 s.submit(action(s.state));assert.equal(s.status().reason,'conflict');assert.equal(storage.getItem(KEY),newer);
 const campaignBefore=storage.getItem(CAMPAIGN_KEY);s.returnCampaign();assert.equal(storage.getItem(CAMPAIGN_KEY),campaignBefore);
 const store=createDailyStore({storage}),value=normalizeDailyProgress(JSON.parse(newer)).progress;
 storage.setItem(KEY,JSON.stringify({...value,revision:value.revision+3}));assert.equal(store.save(value),false);assert.equal(store.status().reason,'conflict');
});

test('denied storage allows explicit transient daily play with honest status; disposed owners do not enter',()=>{
 const storage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}},s=session(storage);assert(s.enterDaily(null));assert.equal(s.status().saved,false);
 assert(s.submit(action(s.state)).accepted);s.returnCampaign();s.dispose();assert.equal(s.enterDaily(null),false);
 assert.equal(DAILY_CATALOG_VERSION,'daily-30-2026-10-25.1');assert.equal(DAILY_RULES.spawnInterval(12),3);
});
