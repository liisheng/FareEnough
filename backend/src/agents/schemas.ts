import { z } from 'zod';

export const AgentRoleSchema = z.enum(['rider_advocate', 'driver_advocate']);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const CitedClaimSchema = z.object({
  text: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
  policyRuleIds: z.array(z.string()).default([]),
});

export const AdvocateBriefSchema = z.object({
  role: AgentRoleSchema,
  position: z.string().min(1),
  claims: z.array(CitedClaimSchema).min(1),
  adverseEvidence: z.array(CitedClaimSchema),
  concessions: z.array(z.string()),
  unansweredQuestions: z.array(z.string()),
});
export type AdvocateBrief = z.infer<typeof AdvocateBriefSchema>;

export const RebuttalSchema = z.object({
  role: AgentRoleSchema,
  response: z.string().min(1),
  challengedClaim: z.string().min(1),
  claims: z.array(CitedClaimSchema).min(1),
  preservedConcessions: z.array(z.string()),
});
export type Rebuttal = z.infer<typeof RebuttalSchema>;

export const JudgeProposalSchema = z.object({
  outcome: z.enum(['uphold_fee', 'reverse_fee', 'human_review']),
  explanation: z.string().min(1),
  findings: z.array(CitedClaimSchema).min(1),
  evidenceIds: z.array(z.string()).min(1),
  policyRuleIds: z.array(z.string()).min(1),
  proposedAdjustmentCents: z.number().int(),
  uncertainty: z.array(z.string()),
});
export type JudgeProposal = z.infer<typeof JudgeProposalSchema>;

export type AgentStage = 'rider_brief' | 'driver_brief' | 'rider_rebuttal' | 'driver_rebuttal' | 'judge';

export interface SafeAgentEvent {
  sequence: number;
  stage: AgentStage;
  status: 'started' | 'completed' | 'failed';
  role: AgentRole | 'judge';
  message: string;
}
