import { z } from 'zod';

export const DecisionContractSchema=z.object({
  disposition:z.enum(['claim_upheld','claim_partially_upheld','claim_rejected','needs_review']),
  feeTreatment:z.enum(['upheld','reversed','partially_reversed','offset_by_voucher','undetermined','not_applicable']),
  action:z.object({type:z.enum(['no_change','simulate_refund','simulate_wallet_voucher','request_human_review']),money:z.object({currency:z.literal('SGD'),amountMinor:z.number().int().nonnegative()}).strict(),calculationFactId:z.string().nullable()}).strict(),
}).strict();

export function validateDecisionContract(value:unknown){
  const parsed=DecisionContractSchema.safeParse(value);
  if(!parsed.success)return {valid:false as const,reasons:['invalid_agent_output']};
  const {disposition,action}=parsed.data,reasons:string[]=[];
  if(['no_change','request_human_review'].includes(action.type)&&action.money.amountMinor!==0)reasons.push('amount_mismatch');
  if(['simulate_refund','simulate_wallet_voucher'].includes(action.type)&&(action.money.amountMinor<=0||!action.calculationFactId))reasons.push('amount_mismatch');
  if(disposition==='needs_review'&&(action.type!=='request_human_review'||action.money.amountMinor!==0))reasons.push('amount_mismatch');
  if(disposition!=='needs_review'&&action.type==='request_human_review')reasons.push('invalid_agent_output');
  return reasons.length?{valid:false as const,reasons}:{valid:true as const,value:parsed.data,reasons:[]};
}
