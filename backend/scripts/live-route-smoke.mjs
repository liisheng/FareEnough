// Explicit, bounded route/ERP live test. Prints metadata only and never keys or model text.
if (!process.argv.includes('--run')) {
  console.error('Use --run to send the synthetic route case to the three configured ADP applications (up to five model calls).');
  process.exit(1);
}
process.env.AI_MODE='live';
process.env.MODEL_PROVIDER='adp';
const [{config},{AdpModelProvider,AdpProviderError},{loadRouteFixture},{projectRouteEvidence},{runThreeAgentReview},{validateAgentJudgeProposal},{createCaseEvidenceTools}]=await Promise.all([
  import('../dist/config.js'),import('../dist/providers/adp-provider.js'),import('../dist/fixtures/loader.js'),import('../dist/projections/route-projection.js'),import('../dist/agents/run-coordinator.js'),import('../dist/decisions/validator.js'),import('../dist/tools/case-evidence-tools.js'),
]);
const projection=projectRouteEvidence(loadRouteFixture());
const tools=createCaseEvidenceTools(projection);
const provider=new AdpModelProvider({riderAppKey:config.ADP_RIDER_APP_KEY,driverAppKey:config.ADP_DRIVER_APP_KEY,judgeAppKey:config.ADP_JUDGE_APP_KEY,chatUrl:config.ADP_CHAT_URL,callTimeoutMs:Number(config.MODEL_CALL_TIMEOUT_MS),runTimeoutMs:Number(config.RUN_TIMEOUT_MS)});
try{
  const run=await runThreeAgentReview(projection,provider);
  const fact=projection.derivedFacts.find(item=>item.id==='derived_supported_adjustment');
  const decision=validateAgentJudgeProposal(projection.caseId,run.judgeProposal,fact,{profileId:projection.policyProfile.profileId,evidenceIds:new Set(tools.getEvidence().map(item=>item.id)),policyRuleIds:new Set(tools.getPolicyRules().map(item=>item.id))});
  console.log(JSON.stringify({mode:'live',provider:{id:provider.id,mode:provider.mode},stagesCompleted:run.events.filter(event=>event.status==='completed').map(event=>event.stage),judgeOutcome:run.judgeProposal.outcome,validation:decision.status,contractAction:decision.contractAction,simulatedAdjustmentCents:decision.amountMinor},null,2));
}catch(error){
  console.error(JSON.stringify({status:'failed',code:error instanceof AdpProviderError?error.code:'INVALID_OR_INCOMPLETE_REVIEW'}));
  process.exitCode=1;
}finally{provider.abort();}
