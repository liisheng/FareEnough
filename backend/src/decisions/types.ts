export type Disposition = 'claim_upheld' | 'claim_rejected';
export type DecisionAction = 'reverse_fee' | 'uphold_fee' | 'none' | 'human_review';
export type ContractDisposition = Disposition | 'claim_partially_upheld' | 'needs_review';
export type ContractAction = 'no_change' | 'simulate_refund' | 'simulate_wallet_voucher' | 'request_human_review';
export interface DecisionConfidence {
  score: number;
  completeness: number;
  corroboration: number;
  policyCoverage: number;
  citationValidity: number;
  explanations: string[];
  rubricVersion: '1';
  assessmentVersion?: 'evidence-checklist-v1';
  threshold?: number;
  checks?: Array<{ id: string; component: 'completeness' | 'corroboration' | 'policyCoverage' | 'citationValidity'; passed: boolean; evidenceIds: string[]; reason: string }>;
}

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
  contractDisposition: ContractDisposition;
  contractAction: ContractAction;
  feeTreatment: 'upheld' | 'reversed' | 'partially_reversed' | 'offset_by_voucher' | 'not_applicable';
  confidence: DecisionConfidence;
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
  contractDisposition: 'needs_review';
  contractAction: 'request_human_review';
  feeTreatment: 'undetermined';
  confidence: DecisionConfidence;
}

export type DecisionResult = ValidatedDecision | HumanReviewDecision;
