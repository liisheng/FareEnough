import type { DecisionConfidence } from './types.js';

export interface ConfidenceInput {
  complete: boolean;
  corroboration: 'consistent' | 'nonmaterial_discrepancy' | 'material_conflict';
  policyCoverage: 'complete' | 'nonmaterial_gap' | 'material_gap';
  citationsValid: boolean;
}

export function calculateConfidence(input: ConfidenceInput): DecisionConfidence {
  const completeness = input.complete ? 1 : 0;
  const corroboration = input.corroboration === 'consistent' ? 1 : input.corroboration === 'nonmaterial_discrepancy' ? 0.5 : 0;
  const policyCoverage = input.policyCoverage === 'complete' ? 1 : input.policyCoverage === 'nonmaterial_gap' ? 0.5 : 0;
  const citationValidity = input.citationsValid ? 1 : 0;
  const score = Number((0.35 * completeness + 0.30 * corroboration + 0.25 * policyCoverage + 0.10 * citationValidity).toFixed(2));
  return {
    score, completeness, corroboration, policyCoverage, citationValidity, rubricVersion: '1',
    explanations: [
      `Material evidence completeness: ${completeness}.`,
      `Independent corroboration quality: ${corroboration}.`,
      `Selected policy and remedy coverage: ${policyCoverage}.`,
      `Decisive citation validity: ${citationValidity}.`,
      'This score measures support under the selected profile; it is not a truthfulness probability.',
    ],
  };
}
