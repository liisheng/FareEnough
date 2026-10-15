import {describe,expect,it} from 'vitest';
import {validateDecisionContract} from '../src/decisions/contract.js';

describe('complete decision vocabulary and money invariants',()=>{
  const base={disposition:'claim_rejected',feeTreatment:'upheld',action:{type:'no_change',money:{currency:'SGD',amountMinor:0},calculationFactId:null}};
  it('accepts no-change, refund, voucher, partial and review shapes',()=>{
    expect(validateDecisionContract(base).valid).toBe(true);
    expect(validateDecisionContract({disposition:'claim_upheld',feeTreatment:'reversed',action:{type:'simulate_refund',money:{currency:'SGD',amountMinor:325},calculationFactId:'derived_supported_adjustment'}}).valid).toBe(true);
    expect(validateDecisionContract({disposition:'claim_upheld',feeTreatment:'offset_by_voucher',action:{type:'simulate_wallet_voucher',money:{currency:'SGD',amountMinor:661},calculationFactId:'derived_public_waiver'}}).valid).toBe(true);
    expect(validateDecisionContract({disposition:'claim_partially_upheld',feeTreatment:'partially_reversed',action:{type:'simulate_refund',money:{currency:'SGD',amountMinor:100},calculationFactId:'derived_partial_adjustment'}}).valid).toBe(true);
    expect(validateDecisionContract({disposition:'needs_review',feeTreatment:'undetermined',action:{type:'request_human_review',money:{currency:'SGD',amountMinor:0},calculationFactId:null}}).valid).toBe(true);
  });
  it('blocks positive no-change, funded review and unreferenced positive actions',()=>{
    expect(validateDecisionContract({...base,action:{...base.action,money:{currency:'SGD',amountMinor:1}}}).valid).toBe(false);
    expect(validateDecisionContract({disposition:'needs_review',feeTreatment:'undetermined',action:{type:'simulate_refund',money:{currency:'SGD',amountMinor:325},calculationFactId:'x'}}).valid).toBe(false);
    expect(validateDecisionContract({disposition:'claim_upheld',feeTreatment:'reversed',action:{type:'simulate_refund',money:{currency:'SGD',amountMinor:325},calculationFactId:null}}).valid).toBe(false);
  });
});
