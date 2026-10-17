import { ReplayModelProvider } from './replay-provider.js';
import type { ModelProviderRequest } from './model-provider.js';

/** Offline pipeline exercise, never a model assessment of newly submitted accounts. */
export class SubmittedReplayProvider extends ReplayModelProvider {
  override async generate(request: ModelProviderRequest): Promise<unknown> {
    if (request.evidence.policyProfile.profileId === 'demo-route-erp-v1') return super.generate(request);
    const submissions = request.evidence.evidence.filter(e => e.kind === 'chat' && e.data.type === 'unverified_party_submission');
    const ids = submissions.map(e => e.id);
    const claim = { text: 'Both parties submitted accounts. Replay cannot assess their truth or resolve disagreements.', evidenceIds: ids, policyRuleIds: [] };
    if (request.stage === 'judge') return {
      outcome: 'human_review', explanation: 'Replay exercised the five-stage pipeline. Use Live AI or a human reviewer to assess these newly submitted accounts.',
      findings: [claim], evidenceIds: ids, policyRuleIds: ['ORG-NS-03'], proposedAdjustmentCents: 0,
      uncertainty: ['New statements have not been assessed by a live model or human reviewer.'],
    };
    const role = request.stage.startsWith('rider') ? 'rider_advocate' : 'driver_advocate';
    if (request.stage.endsWith('brief')) return { role,
      position: `Replay acknowledges the ${role === 'rider_advocate' ? 'rider' : 'driver'} account without adjudicating it.`,
      claims: [claim], adverseEvidence: [claim], concessions: ['Submitted statements require assessment against the trip records.'], unansweredQuestions: ['Do the submitted accounts raise material uncertainty?'] };
    return { role, response: 'Replay acknowledges the opposing account; it does not infer that either party is at fault.',
      challengedClaim: 'A submitted statement alone establishes liability.', claims: [claim], preservedConcessions: ['Human or live-model assessment is still required.'] };
  }
}
