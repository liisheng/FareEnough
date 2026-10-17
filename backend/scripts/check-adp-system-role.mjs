// One synthetic diagnostic call. No case dataset is sent.
import { writeFileSync, mkdirSync } from 'node:fs';
if (!process.argv.includes('--live')) {
  console.log('No call made. Pass --live to test the configured Rider app SystemRole override.');
  process.exit(0);
}
process.env.AI_MODE='live';
process.env.MODEL_PROVIDER='adp';
const {config}=await import('../dist/config.js');
const {AdpModelProvider,AdpProviderError}=await import('../dist/providers/adp-provider.js');
const marker='FAREENOUGH_SYSTEM_ROLE_PROBE';
const provider=new AdpModelProvider({
  riderAppKey:config.ADP_RIDER_APP_KEY,driverAppKey:config.ADP_DRIVER_APP_KEY,judgeAppKey:config.ADP_JUDGE_APP_KEY,
  callTimeoutMs:60000,runTimeoutMs:60000,
  fetch(url,init){
    const body=JSON.parse(init.body);
    body.Contents=[{Type:'text',Text:'Reply to this synthetic diagnostic using the supplied role instruction.'}];
    return fetch(url,{...init,body:JSON.stringify(body)});
  },
});
const report={startedAt:new Date().toISOString(),scope:'One synthetic Rider app prompt-override diagnostic; no incident evidence or financial action.',calls:1};
try{
  const response=await provider.generate({stage:'rider_brief',conversationId:'synthetic-probe',systemPrompt:`You are an API integration diagnostic responder. Return exactly this raw JSON object and no other text: {"systemRoleProbe":"${marker}"}. Do not produce an advocate brief or ask for case evidence; this request is only an integration diagnostic.`,evidence:{caseId:'PROBE',policyProfile:{profileId:'probe',version:'1'},evidence:[{id:'PROBE-E1',kind:'derived_fact',data:{synthetic:true}}],policyRules:[{id:'PROBE-P1',text:'Diagnostic only',value:'Diagnostic only'}]},priorOutputs:[]});
  report.response=response;
  report.overrideObserved=response?.systemRoleProbe===marker && Object.keys(response).length===1;
}catch(error){report.errorCode=error instanceof AdpProviderError?error.code:'PROBE_FAILED';report.overrideObserved=false;}
report.completedAt=new Date().toISOString();
mkdirSync(new URL('../../eval/live-reports/',import.meta.url),{recursive:true});
const path=new URL('../../eval/live-reports/adp-system-role-probe.json',import.meta.url);
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({overrideObserved:report.overrideObserved,errorCode:report.errorCode}));
if(!report.overrideObserved)process.exitCode=1;
