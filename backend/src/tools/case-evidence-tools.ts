import type { CaseEvidenceResponse } from '../schemas/api.js';

export interface EvidenceRecord {
  id: string;
  kind: 'dispute' | 'trip' | 'gps' | 'chat' | 'app_event' | 'derived_fact' | 'fare_line' | 'payment' | 'route_context' | 'party_statement';
  timestamp?: string;
  data: Readonly<Record<string, unknown>>;
}

export interface PolicyRule {
  id: string;
  text: string;
  value: number | string | boolean;
}

export interface AgentEvidenceSnapshot {
  caseId: string;
  evidence: readonly EvidenceRecord[];
  policyRules: readonly PolicyRule[];
  policyProfile: Readonly<CaseEvidenceResponse['policyProfile']>;
}

function redactAgentText(value: string): string {
  return value
    .replaceAll('Lim Wei Ming', '[driver name redacted]')
    .replaceAll('Michael Wong', '[rider name redacted]')
    .replaceAll('SGP 4521 M', '[vehicle plate redacted]');
}

function sanitiseRecord<T>(value: T): T {
  if (typeof value === 'string') return redactAgentText(value) as T;
  if (Array.isArray(value)) return value.map(sanitiseRecord) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitiseRecord(nested)]),
    ) as T;
  }
  return value;
}

/** Read-only, case-scoped retrieval over the already-sanitised projection. */
export class CaseEvidenceTools {
  readonly caseId: string;
  private readonly evidence: EvidenceRecord[];
  private readonly policyRules: PolicyRule[];
  private readonly policyProfile: CaseEvidenceResponse['policyProfile'];

  constructor(projection: CaseEvidenceResponse) {
    this.caseId = projection.caseId;
    this.policyProfile = structuredClone(projection.policyProfile);
    this.evidence = [
      { id: 'dispute-001', kind: 'dispute', timestamp: projection.dispute.filedAt, data: sanitiseRecord(structuredClone(projection.dispute)) },
      { id: 'trip-001', kind: 'trip', data: sanitiseRecord(structuredClone(projection.trip)) },
      ...projection.gpsTelemetry.map((item, i) => ({ id: `gps-${String(i + 1).padStart(3, '0')}`, kind: 'gps' as const, timestamp: item.timestamp, data: structuredClone(item) })),
      ...projection.chatLogs.map((item, i) => ({ id: `chat-${String(i + 1).padStart(3, '0')}`, kind: 'chat' as const, timestamp: item.timestamp, data: sanitiseRecord(structuredClone(item)) })),
      ...projection.appEvents.map((item, i) => ({ id: `evt-${String(i + 1).padStart(3, '0')}`, kind: 'app_event' as const, timestamp: item.timestamp, data: sanitiseRecord(structuredClone(item)) })),
      ...projection.derivedFacts.map((item) => ({ id: item.id, kind: 'derived_fact' as const, data: structuredClone(item) })),
      ...projection.additionalEvidence.map((item) => ({ id: item.id, kind: item.kind, timestamp: item.timestamp ?? undefined, data: sanitiseRecord(structuredClone(item.data)) })),
    ];
    this.policyRules = projection.projectedPolicyRules.length ? projection.projectedPolicyRules.map((rule) => ({
      id: rule.id,
      text: `[${rule.namespace}] ${rule.text}`,
      value: rule.value,
    })) : [
      { id: 'ORG-NS-01', text: 'Recorded cancellation charge in cents', value: projection.cancellationPolicy.cancellationFeeAfterWait * 100 },
      { id: 'ORG-NS-02', text: 'Free wait period in seconds', value: projection.cancellationPolicy.freeWaitTimeMin * 60 },
      { id: 'ORG-NS-03', text: 'No-show threshold in total elapsed seconds', value: projection.cancellationPolicy.noShowThresholdMin * 60 },
      { id: 'ORG-NS-04', text: 'Wait anchor is the corroborated driver wait start', value: projection.trip.driverWaitStart },
      { id: 'ORG-NS-05', text: 'Eligibility requires elapsed seconds to meet or exceed the no-show threshold', value: 'elapsed_seconds >= 480' },
    ];
  }

  getEvidence(ids?: readonly string[]): readonly EvidenceRecord[] {
    const records = ids ? this.evidence.filter((item) => ids.includes(item.id)) : this.evidence;
    return structuredClone(records);
  }

  getPolicyRules(ids?: readonly string[]): readonly PolicyRule[] {
    const rules = ids ? this.policyRules.filter((item) => ids.includes(item.id)) : this.policyRules;
    return structuredClone(rules);
  }

  hasEvidence(id: string): boolean { return this.evidence.some((item) => item.id === id); }
  hasPolicyRule(id: string): boolean { return this.policyRules.some((item) => item.id === id); }

  snapshot(): AgentEvidenceSnapshot {
    return {
      caseId: this.caseId,
      evidence: this.getEvidence(),
      policyRules: this.getPolicyRules(),
      policyProfile: structuredClone(this.policyProfile),
    };
  }
}

export function createCaseEvidenceTools(projection: CaseEvidenceResponse): CaseEvidenceTools {
  return new CaseEvidenceTools(projection);
}
