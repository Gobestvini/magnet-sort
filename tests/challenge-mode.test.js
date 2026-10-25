import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createV4ChallengeSession} from '../src/prototype/challenge-session.js';
import {createV4Session} from '../src/prototype/session.js';
import {createV4ModeSession,DAILY_V4_KEY} from '../src/prototype/daily-v4.js';
import {DAILY_RULES} from '../src/prototype/daily-rules.js';
import {createV4State} from '../src/prototype/model-v4.js';
import {v4Levels} from '../src/prototype/levels-v4.js';
import {PROGRESS_V4_KEY} from '../src/prototype/progress-v4.js';
import {findV4Hint} from '../src/prototype/hint-v4.js';
import {encodeChallenge,rulesForChallenge,challengeForState,CONTENT_VERSION,CHALLENGE_RULES_HASH,
  CAMPAIGN_PRESET_ID,SHORT_PRESET_ID} from '../src/prototype/challenge-v4.js';

const campaignWitnesses=JSON.parse(readFileSync(new URL('../tools/fixtures/v4-progression-witnesses.json',import.meta.url)));
const dailyWitnesses=JSON.parse(readFileSync(new URL('../tools/fixtures/daily-v4-witnesses.json',import.meta.url))).entries;
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const descriptor=(presetId=CAMPAIGN_PRESET_ID,levelNumber=1,seed=0)=>({schema:1,levelNumber,seed,presetId,contentVersion:CONTENT_VERSION,rulesHash:CHALLENGE_RULES_HASH,moves:12,assisted:false});
const open=(storage,d=descriptor(),more={})=>createV4ChallengeSession({storage,newSeed:()=>123,launch:{payload:encodeChallenge(d),error:null},...more});
const action=state=>{const h=findV4Hint(state);assert(h);return {type:'placeMagnet',color:h.color,cell:h.cell};};
const snapshot=storage=>[storage.getItem(PROGRESS_V4_KEY),storage.getItem(DAILY_V4_KEY)];

test('incoming A/B at zero/max seed is preview-only and Play creates exactly the shared initial state',()=>{
 for(const preset of [CAMPAIGN_PRESET_ID,SHORT_PRESET_ID])for(const seed of [0,0xffffffff]){
  const storage=memory(),d=descriptor(preset,6,seed),s=open(storage,d),before=snapshot(storage);
  assert.equal(s.challenge.preview,true);assert.equal(s.challenge.error,null);assert.equal(s.mode,'campaign');assert.equal(s.canUndo,false);
  assert.equal(s.submit(action(s.state)).accepted,false);assert.equal(s.markAssisted(),false);assert.equal(s.undo().accepted,false);
  assert(s.playChallenge('blue'));assert.equal(s.mode,'challenge');assert.equal(s.challenge.preview,false);
  assert.deepEqual(s.state,rulesForChallenge(d).createV4State(v4Levels[5],seed));assert.deepEqual(s.attempt.actions,[]);
  assert.equal(s.attempt.assisted,false);assert.equal(s.playChallenge('coral'),false);assert.deepEqual(snapshot(storage),before);
 }
});

test('preview, Cancel, invalid and unsupported launches do not consume seeds, create saves, or overwrite a won campaign',()=>{
 for(const launch of [{payload:encodeChallenge(descriptor()),error:null},{payload:'broken!',error:null},{payload:null,error:'duplicate'}]){
  let draws=0;const storage=memory(),s=createV4ChallengeSession({storage,newSeed:()=>{draws++;return 42;},launch});
  assert.equal(draws,0);assert.deepEqual(snapshot(storage),[null,null]);assert(s.cancelPreview());assert.equal(draws,0);assert.deepEqual(snapshot(storage),[null,null]);
  s.dispose();assert.equal(s.playChallenge(),false);
 }
 const storage=memory(),campaign=createV4Session({storage,newSeed:()=>0}),w=campaignWitnesses.find(row=>row.number===1);
 campaign.start(0,w.seed);for(const a of w.actions)assert(campaign.submit(a).accepted);
 const raw=snapshot(storage),won=structuredClone(campaign.state);assert.equal(won.terminal,'won');
 const bytes=Buffer.from(encodeChallenge(descriptor()),'base64url');bytes[0]=2;
 const incompatible=createV4ChallengeSession({storage,newSeed:()=>{throw Error('Seed must stay suspended');},launch:{payload:bytes.toString('base64url'),error:null}});
 assert.equal(incompatible.challenge.error,'unsupported');assert.equal(incompatible.playChallenge(),false);
 assert.deepEqual(incompatible.state,won);assert(incompatible.cancelPreview());assert.deepEqual(incompatible.state,won);assert.deepEqual(snapshot(storage),raw);
});

test('partial campaign history and selected color survive Play, Hint, Undo, Retry, Return and link reload without writes',()=>{
 const storage=memory(),campaign=createV4Session({storage,newSeed:()=>7});campaign.submit(action(campaign.state));campaign.submit(action(campaign.state));
 const state=structuredClone(campaign.state),attempt=campaign.attempt,raw=snapshot(storage),color=state.magnets.at(-1),s=open(storage);
 assert(s.playChallenge(color));const initial=structuredClone(s.state);s.submit(action(s.state));assert(s.markAssisted());assert(s.undo().accepted);assert.deepEqual(s.state,initial);assert(s.attempt.assisted);
 assert.deepEqual(snapshot(storage),raw);s.start(11,0xffffffff);assert.deepEqual(s.state,initial);assert.equal(s.attempt.assisted,false);
 s.submit(action(s.state));const reloaded=open(storage);assert(reloaded.challenge.preview);assert.deepEqual(reloaded.campaign,{state,attempt});assert.deepEqual(snapshot(storage),raw);
 assert.equal(s.returnSelection,color);s.returnCampaign();assert.equal(s.mode,'campaign');assert.equal(s.returnSelection,color);assert.deepEqual(s.state,state);assert.deepEqual(s.attempt,attempt);assert(s.canUndo);assert.deepEqual(snapshot(storage),raw);
});

test('a won campaign does not advance while incoming challenge is played or returned',()=>{
 const storage=memory(),campaign=createV4Session({storage,newSeed:()=>0}),w=campaignWitnesses.find(row=>row.number===1);
 campaign.start(0,w.seed);for(const a of w.actions)campaign.submit(a);
 const won=structuredClone(campaign.state),raw=snapshot(storage),s=open(storage);s.playChallenge(null);s.submit(action(s.state));s.returnCampaign();
 assert.deepEqual(s.state,won);assert.equal(s.state.puzzleId,'magnet-v4-01');assert.deepEqual(snapshot(storage),raw);
});

test('saved active daily stays pinned and untouched during preview/Cancel and challenge; explicit Return keeps its attempt',()=>{
 const storage=memory(),base=createV4ModeSession({storage,newSeed:()=>9,now:()=>new Date('2026-01-01T12:00:00Z')});
 base.submit(action(base.state));const selection=base.state.magnets[0];base.enterDaily(selection);base.submit(action(base.state));
 const daily=structuredClone(base.state),dailyAttempt=base.attempt,campaign=base.campaign,raw=snapshot(storage),cancel=open(storage);
 assert.equal(cancel.mode,'daily');assert(cancel.cancelPreview());assert.deepEqual(cancel.state,daily);assert.deepEqual(snapshot(storage),raw);
 const s=open(storage,descriptor(SHORT_PRESET_ID));s.playChallenge('coral');s.submit(action(s.state));s.markAssisted();s.undo();
 assert.deepEqual(s.base.state,daily);assert.deepEqual(s.base.attempt,dailyAttempt);assert.deepEqual(snapshot(storage),raw);assert.equal(s.returnSelection,selection);
 s.returnCampaign();assert.equal(s.mode,'campaign');assert.deepEqual(s.state,campaign.state);assert.deepEqual(s.attempt,campaign.attempt);
 const persisted=JSON.parse(storage.getItem(DAILY_V4_KEY));assert.equal(persisted.activeView,'campaign');assert.deepEqual(persisted.activeAttempt.actions,dailyAttempt.actions);assert.equal(storage.getItem(PROGRESS_V4_KEY),raw[0]);
});

test('challenge victory is local only; share derives own won result, and comparisons separate help categories',()=>{
 for(const preset of [CAMPAIGN_PRESET_ID,SHORT_PRESET_ID]){
  const w=preset===CAMPAIGN_PRESET_ID?campaignWitnesses.find(row=>row.number===1):dailyWitnesses[0];
  const d=descriptor(preset,1,w.seed),storage=memory(),s=open(storage,d),raw=snapshot(storage);s.playChallenge(null);
  assert.equal(s.shareDescriptor,null);for(const a of w.actions)assert(s.submit(a).accepted);
  assert.equal(s.state.terminal,'won');assert.equal(s.canUndo,false);assert.deepEqual(snapshot(storage),raw);
  const shared=s.shareDescriptor;assert.equal(shared.moves,w.actions.length);assert.equal(shared.assisted,false);assert.equal(shared.presetId,preset);
  assert.deepEqual(shared,challengeForState(s.state,s.attempt,preset));assert.equal(s.challenge.comparison.verified,false);assert(s.challenge.comparison.comparable);
  s.start(0,0);s.markAssisted();for(const a of w.actions)assert(s.submit(a).accepted);assert.equal(s.challenge.comparison.comparable,false);assert.equal(s.shareDescriptor.assisted,true);assert.deepEqual(snapshot(storage),raw);
 }
});

test('newer campaign/daily writers are not overwritten by a challenge or Return; malformed launch cannot bypass isolation',()=>{
 const storage=memory(),campaign=createV4Session({storage,newSeed:()=>0}),s=open(storage);s.playChallenge(null);
 const newer=createV4Session({storage,newSeed:()=>1});newer.submit(action(newer.state));const raw=snapshot(storage);
 s.checkConflict();s.submit(action(s.state));s.returnCampaign();assert.deepEqual(snapshot(storage),raw);assert.equal(s.status().reason,'conflict');
 const bad=createV4ChallengeSession({storage,newSeed:()=>0,launch:{payload:'A'.repeat(161),error:null}});assert.equal(bad.challenge.error,'invalid');assert.equal(bad.playChallenge(),false);assert.deepEqual(snapshot(storage),raw);
 assert.equal(createV4State(v4Levels[0],0).goal,50);campaign.dispose();
});

test('incoming links ignore unrelated DEV seed/profile options and restore the recipient campaign; ordinary DEV attempts keep their options',()=>{
 for(const launch of [{payload:encodeChallenge(descriptor()),error:null},{payload:'broken!',error:null}]){
  const storage=memory(),saved=createV4Session({storage,newSeed:()=>17});saved.start(3,17);saved.submit(action(saved.state));
  const expected=saved.state,history=saved.attempt,raw=snapshot(storage);
  const s=createV4ChallengeSession({storage,newSeed:()=>99,fixedSeed:42,rules:DAILY_RULES,initialLevelIndex:0,launch});
  assert.deepEqual(s.state,expected);assert.deepEqual(s.attempt,history);assert.deepEqual(snapshot(storage),raw);
  if(!s.challenge.error){assert(s.playChallenge(expected.magnets[0]));assert.equal(s.state.seed,0);assert.equal(s.state.goal,50);}
  s.returnCampaign();assert.deepEqual(s.state,expected);assert.deepEqual(s.attempt,history);assert.deepEqual(snapshot(storage),raw);
 }
 const storage=memory(),dev=createV4ChallengeSession({storage,newSeed:()=>99,fixedSeed:42,rules:DAILY_RULES,initialLevelIndex:3});
 assert.equal(dev.state.seed,42);assert.equal(dev.state.levelNumber,4);assert.equal(dev.state.goal,70);assert.deepEqual(snapshot(storage),[null,null]);
});
