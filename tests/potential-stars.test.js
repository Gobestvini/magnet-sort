import test from 'node:test';
import assert from 'node:assert/strict';
import { potentialStars, earnedStars } from '../src/prototype/model-v4.js';

test('potential reward includes both thresholds and matches victory without awarding live/lost stars',()=>{
  for(const goal of [50,100,600]){
    const t3=Math.ceil(goal/12),t2=Math.ceil(goal/6);
    for(const [moves,expected] of [[0,3],[t3,3],[t3+1,2],[t2,2],[t2+1,1]]){
      assert.equal(potentialStars(goal,moves),expected);
      assert.equal(earnedStars(goal,moves,'won'),expected);
      assert.equal(earnedStars(goal,moves,null),0);
      assert.equal(earnedStars(goal,moves,'lost'),0);
    }
  }
});
