const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reviewControls,reviewErrorMessage}=require('../scripts/participation.js');
const ready={supported:true,driverResponded:true,status:'ready'};

test('review controls offer live AI without an offline selector',()=>{
  const html=reviewControls(ready,true,true);
  assert.match(html,/Start AI review/);
  assert.doesNotMatch(html,/Replay|offline|<select|disabled/);
  assert.match(reviewControls(ready,false,true),/AI review is unavailable/);
  assert.match(reviewControls(ready,false,true),/disabled/);
});
test('technical failures allow explicit retry while genuine human-review decisions do not',()=>{
  assert.match(reviewControls({...ready,status:'human_review',technicalFailure:true},true,true),/Retry AI review/);
  const review=reviewControls({...ready,status:'human_review',mode:'live',result:{validatedDecision:{}}},true,true);
  assert.match(review,/requested human judgment/);
  assert.doesNotMatch(review,/case-start-review/);
  assert.doesNotMatch(reviewControls({...ready,status:'running'},true,true),/case-start-review/);
  assert.doesNotMatch(reviewControls({...ready,status:'queued'},true,true),/case-start-review/);
  assert.doesNotMatch(reviewControls({...ready,status:'retrying',reason:'Retrying automatically'},true,true),/case-start-review/);
  const exhausted=reviewControls({...ready,status:'review_failed',technicalFailure:true,automaticAttempts:3,automaticAttemptLimit:3},true,true);
  assert.match(exhausted,/retry limit reached after 3 attempts/);
  assert.match(exhausted,/Retry AI review/);
});
test('lost connections require a status check and cannot start another run',()=>{
  const html=reviewControls(ready,true,false);
  assert.match(html,/may still be running/);
  assert.match(html,/Check service status/);
  assert.match(html,/disabled/);
});
test('technical error messages explain recovery without exposing upstream content',()=>{
  assert.match(reviewErrorMessage({status:502,code:'CALL_TIMEOUT',message:'SECRET'}),/timed out/);
  assert.match(reviewErrorMessage({status:429}),/usage limit/);
  assert.match(reviewErrorMessage({status:409}),/already be running/);
  assert.match(reviewErrorMessage({status:400}),/provider configuration/);
  assert.doesNotMatch(reviewErrorMessage({status:502,message:'SECRET'}),/SECRET/);
});
