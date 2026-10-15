import { describe, expect, it } from 'vitest';
import { calculateConfidence } from '../src/decisions/confidence.js';

describe('deterministic confidence rubric', () => {
  it('uses the disclosed 35/30/25/10 weights', () => {
    expect(calculateConfidence({complete:true,corroboration:'nonmaterial_discrepancy',policyCoverage:'complete',citationsValid:true})).toMatchObject({score:0.85,completeness:1,corroboration:0.5,policyCoverage:1,citationValidity:1,rubricVersion:'1'});
  });

  it('never treats confidence as authority over a hard citation failure', () => {
    const result=calculateConfidence({complete:true,corroboration:'consistent',policyCoverage:'complete',citationsValid:false});
    expect(result.score).toBe(0.9);
    expect(result.citationValidity).toBe(0);
    expect(result.explanations.join(' ')).toContain('not a truthfulness probability');
  });
});
