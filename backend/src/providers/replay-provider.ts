import type { ModelProvider, ModelProviderRequest } from './model-provider.js';

/**
 * Deterministic demo fallback. This is explicitly not a live model.
 * Outputs cite only IDs present in the supplied safe evidence snapshot and do
 * not read the evaluation answer key.
 */
export class ReplayModelProvider implements ModelProvider {
  readonly id = 'fareenough-structured-replay-v1';
  readonly mode = 'replay' as const;

  async generate(request: ModelProviderRequest): Promise<unknown> {
    if (request.evidence.policyProfile.profileId === 'demo-route-erp-v1') return this.routeOutput(request);
    switch (request.stage) {
      case 'rider_brief': return {
        role: 'rider_advocate',
        position: 'The rider disputes the fee because they report being at the pickup lobby and unable to locate the vehicle.',
        claims: [{ text: 'The complaint states the rider was at the pickup point and could not find the car.', evidenceIds: ['dispute-001'], policyRuleIds: [] }],
        adverseEvidence: [
          { text: 'GPS records place a stationary vehicle at the pickup coordinates from arrival through cancellation.', evidenceIds: ['gps-005', 'gps-006', 'gps-007', 'gps-008'], policyRuleIds: [] },
          { text: 'The record contains multiple driver contact attempts and an unanswered call.', evidenceIds: ['chat-001', 'chat-002', 'chat-003', 'chat-004', 'chat-005'], policyRuleIds: [] },
        ],
        concessions: ['The structured record does not corroborate the rider complaint with a rider message, call, or location record.'],
        unansweredQuestions: ['The record does not establish the rider\'s exact physical position within the lobby.'],
      };
      case 'driver_brief': return {
        role: 'driver_advocate',
        position: 'The driver record supports arrival, waiting, attempted contact, and cancellation after the configured threshold.',
        claims: [
          { text: 'GPS and the arrival event corroborate arrival at the pickup point at 08:43.', evidenceIds: ['gps-005', 'evt-004'], policyRuleIds: [] },
          { text: 'The deterministic waiting fact records 480 seconds between the wait anchor and cancellation.', evidenceIds: ['derived_wait_duration'], policyRuleIds: ['ORG-NS-03', 'ORG-NS-05'] },
          { text: 'The driver attempted contact before cancellation.', evidenceIds: ['chat-001', 'chat-002', 'chat-003', 'chat-004', 'chat-005'], policyRuleIds: [] },
        ],
        adverseEvidence: [{ text: 'The rider directly asserts that they were at the lobby.', evidenceIds: ['dispute-001'], policyRuleIds: [] }],
        concessions: ['GPS establishes the vehicle location, not whether the parties visually encountered one another.'],
        unansweredQuestions: ['No rider-device location record is available.'],
      };
      case 'rider_rebuttal': return {
        role: 'rider_advocate',
        response: 'Vehicle GPS supports the driver location but cannot alone disprove that the rider was elsewhere in the pickup lobby.',
        challengedClaim: 'The operational record conclusively establishes rider absence.',
        claims: [{ text: 'The complaint reports presence at the lobby, while GPS describes only the vehicle.', evidenceIds: ['dispute-001', 'gps-005'], policyRuleIds: [] }],
        preservedConcessions: ['The record strongly corroborates that the vehicle was stationary at the pickup coordinates.'],
      };
      case 'driver_rebuttal': return {
        role: 'driver_advocate',
        response: 'Even if the rider was somewhere in the lobby, the driver arrival, notification, contact attempts, and elapsed wait are independently recorded.',
        challengedClaim: 'The rider assertion alone establishes that the driver failed to appear.',
        claims: [{ text: 'Arrival, rider notification, contact, and waiting are corroborated by separate records.', evidenceIds: ['evt-004', 'evt-005', 'chat-003', 'derived_wait_duration'], policyRuleIds: ['ORG-NS-03'] }],
        preservedConcessions: ['The evidence cannot establish the rider\'s exact position.'],
      };
      case 'judge': return {
        outcome: 'uphold_fee',
        explanation: 'The rider account is acknowledged, but the available operational evidence corroborates arrival, contact attempts, and the configured eight-minute waiting threshold. The rider\'s precise position is not independently recorded; it does not change the elapsed-time test in this organizer profile. This is a proposal pending deterministic validation.',
        findings: [
          { text: 'The vehicle arrived at and remained at the pickup coordinates.', evidenceIds: ['gps-005', 'gps-006', 'gps-007', 'gps-008', 'evt-004'], policyRuleIds: [] },
          { text: 'The derived waiting duration is 480 seconds, matching the selected no-show threshold.', evidenceIds: ['derived_wait_duration'], policyRuleIds: ['ORG-NS-03', 'ORG-NS-05'] },
          { text: 'The driver made multiple contact attempts before cancellation.', evidenceIds: ['chat-001', 'chat-002', 'chat-003', 'chat-004', 'chat-005'], policyRuleIds: [] },
        ],
        evidenceIds: ['dispute-001', 'gps-005', 'gps-006', 'gps-007', 'gps-008', 'chat-001', 'chat-002', 'chat-003', 'chat-004', 'chat-005', 'evt-004', 'evt-005', 'derived_wait_duration'],
        policyRuleIds: ['ORG-NS-03', 'ORG-NS-05'],
        proposedAdjustmentCents: 0,
        // This field is reserved for unresolved material questions, per Judge contract.
        uncertainty: [],
      };
    }
  }

  private routeOutput(request: ModelProviderRequest): unknown {
    const adjustmentClaim = { text: 'The paid 325-cent ERP line is unsupported by the complete synthetic gantry record.', evidenceIds: ['fare-erp-001','payment-001','gantry-coverage-001','derived_supported_adjustment'], policyRuleIds: ['PUB-ERP-01','DEMO-ERP-01'] };
    const routeClaim = { text: 'The actual route was longer, but the recorded rider agreement settles the detour question without a distance-based refund.', evidenceIds: ['route-reference-001','route-actual-001','route-consent-001','derived_route_distance_difference'], policyRuleIds: ['DEMO-RT-01','DEMO-RT-02'] };
    switch (request.stage) {
      case 'rider_brief': return { role:'rider_advocate', position:'The rider seeks return of the unsupported ERP line, not a distance-proportional refund.', claims:[adjustmentClaim], adverseEvidence:[routeClaim], concessions:['The rider-approved detour is not itself grounds for a refund.'], unansweredQuestions:[] };
      case 'driver_brief': return { role:'driver_advocate', position:'The detour was agreed, while the separate ERP line must still be supported by a recorded gantry.', claims:[routeClaim], adverseEvidence:[adjustmentClaim], concessions:['The complete synthetic gantry record does not support the ERP line.'], unansweredQuestions:[] };
      case 'rider_rebuttal': return { role:'rider_advocate', response:'Agreement to the route does not establish that an ERP gantry was passed.', challengedClaim:'Route consent supports every additional fare line.', claims:[adjustmentClaim], preservedConcessions:['No distance-based refund is requested.'] };
      case 'driver_rebuttal': return { role:'driver_advocate', response:'The route issue is settled, but the unsupported ERP line should be handled independently.', challengedClaim:'A longer route alone determines the refund.', claims:[routeClaim,adjustmentClaim], preservedConcessions:['The ERP line lacks gantry support.'] };
      case 'judge': return { outcome:'refund_unsupported_charge', explanation:'The rider-approved detour resolves the route allegation. Separately, the complete synthetic gantry and payment evidence establishes that the paid 325-cent ERP line has no supported allowed amount. Deterministic validation must cap any simulated refund at that line and remaining relief.', findings:[routeClaim,adjustmentClaim], evidenceIds:['route-reference-001','route-actual-001','route-consent-001','fare-erp-001','payment-001','gantry-coverage-001','derived_supported_adjustment','derived_supported_total'], policyRuleIds:['DEMO-RT-01','DEMO-RT-02','DEMO-ERP-01','PUB-ERP-01'], proposedAdjustmentCents:325, uncertainty:[] };
    }
  }
}
