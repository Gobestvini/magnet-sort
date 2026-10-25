import { createV4ModeSession } from './daily-v4.js';
import { createV4Session } from './session.js';
import { parseChallenge, rulesForChallenge, challengeForState, compareChallengeResult,
  CAMPAIGN_PRESET_ID, SHORT_PRESET_ID } from './challenge-v4.js';

// The launch descriptor is a claim, never a saved attempt or completed level.
// Preview and challenge play are read-only guests of the existing mode owner.
export function createV4ChallengeSession({launch={payload:null,error:null},...options}={}) {
  const incoming=launch.payload!==null||Boolean(launch.error);
  const parsed=incoming&&!launch.error?parseChallenge(launch.payload):null;
  let preview=Boolean(incoming),failure=incoming?(launch.error?'invalid':parsed?.ok?null:parsed?.error??'invalid'):null;
  let descriptor=parsed?.ok?parsed.descriptor:null,active=null,disposed=false,selection=null,hasSelection=false;
  // A fresh installation needs a board behind the preview, but preview/Cancel
  // must not consume the caller's seed source or commit a new campaign.
  const seedSource=()=>preview?0:options.newSeed();
  // A launch link owns only its challenge seed/profile. Unrelated DEV query
  // options must not turn the recipient's suspended campaign into a transient.
  const baseOptions=incoming?{...options,fixedSeed:null,rules:undefined,initialLevelIndex:0}:options;
  const base=createV4ModeSession({...baseOptions,newSeed:seedSource,suspendedStartup:Boolean(incoming||options.suspendedStartup)});
  const owner=()=>active??base;
  const locked=()=>disposed||preview;
  const preset=()=>active?descriptor.presetId:base.mode==='daily'?SHORT_PRESET_ID:CAMPAIGN_PRESET_ID;
  function info(){return {preview,error:failure,descriptor:descriptor?structuredClone(descriptor):null,
    comparison:active?compareChallengeResult(descriptor,active.state,active.attempt):null};}
  return {
    get mode(){return active?'challenge':base.mode;},get challenge(){return info();},
    get daily(){return base.daily;},get campaign(){return base.campaign;},
    get base(){return {mode:base.mode,state:structuredClone(base.state),attempt:base.attempt,campaign:base.campaign,daily:base.daily};},
    get returnSelection(){return hasSelection?selection:base.returnSelection;},
    get state(){return owner().state;},get attempt(){return owner().attempt;},get progress(){return owner().progress;},
    get rules(){return active?rulesForChallenge(descriptor):base.rules;},get canUndo(){return !locked()&&owner().canUndo;},
    get shareDescriptor(){return challengeForState(owner().state,owner().attempt,preset());},
    status(){return owner().status();},checkConflict(){base.checkConflict();},
    submit(action){return locked()?{accepted:false,reason:'locked',state:owner().state,events:[]}:owner().submit(action);},
    markAssisted(){return !locked()&&owner().markAssisted();},
    undo(){return locked()?{accepted:false,reason:'locked',state:owner().state}:owner().undo();},
    start(index,seed){if(locked())return owner().state;return active?active.start(descriptor.levelNumber-1,descriptor.seed):base.start(index,seed);},
    enterDaily(color){return !locked()&&!active&&base.enterDaily(color);},
    playChallenge(color=null){
      if(disposed||!preview||!descriptor||failure)return false;
      selection=base.mode==='daily'?base.returnSelection:color;hasSelection=true;preview=false;
      active=createV4Session({newSeed:options.newSeed,fixedSeed:descriptor.seed,rules:rulesForChallenge(descriptor),initialLevelIndex:descriptor.levelNumber-1});
      return true;
    },
    cancelPreview(){if(disposed||!preview)return false;preview=false;failure=null;return true;},
    returnCampaign(){
      if(disposed)return base.state;
      active?.dispose();active=null;preview=false;failure=null;
      return base.returnCampaign();
    },
    recoverSave(){return !locked()&&!active&&base.recoverSave();},
    dispose(){disposed=true;active?.dispose();base.dispose();}
  };
}
