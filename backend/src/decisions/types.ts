export type Disposition = 'claim_upheld' | 'claim_rejected';
export type DecisionAction = 'reverse_fee' | 'uphold_fee' | 'none' | 'human_review';

export interface JudgeProposal {
  disposition: Disposition;
  action: DecisionAction;
  amountMinor: number;
  currency: string;
  evidenceCitations: string[];
  policyCitations: string[];
  rationale?: string;
}

export interface DecisionFact {
  value: number;
  status: 'established' | 'uncertain' | 'not_applicable';
  sourceEvidenceIds?: string[];
  policyRuleIds?: string[];
}

export interface DecisionValidationInput {
  caseId: string;
  proposal: unknown;
  waitingDuration: DecisionFact;
}

export interface ValidatedDecision {
  status: 'validated';
  caseId: string;
  disposition: Disposition;
  action: 'reverse_fee' | 'uphold_fee';
  amountMinor: number;
  currency: 'SGD';
  evidenceCitations: string[];
  policyCitations: string[];
  reasonCodes: string[];
  proposal: JudgeProposal;
}

export interface HumanReviewDecision {
  status: 'human_review';
  caseId: string;
  disposition: null;
  action: 'human_review';
  amountMinor: 0;
  currency: 'SGD';
  evidenceCitations: string[];
  policyCitations: string[];
  reasonCodes: string[];
  proposal: unknown;
}

export type DecisionResult = ValidatedDecision | HumanReviewDecision;
